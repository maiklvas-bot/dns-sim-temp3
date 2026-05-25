import path from "path";
import { spawnSync } from "child_process";
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { buildWorkbookBuffer } from "./excel-export";
import { contentStorage } from "./content-storage";
import type { EditableEmailCase, EditableMessengerCase, EditableSimCase, EditableVideoCase } from "./content-storage";
import { liveSessionService, normalizeLiveAccessCode } from "./live-session-service";
import { sessionStorage } from "./session-storage";
import { staffStorage } from "./staff-storage";
import { requireAdmin, requireStaff, saveMediaUpload } from "./route-utils";
import {
  adminRateLimiter,
  clearFailedAttempts,
  heavyOperationRateLimiter,
  loginRateLimiter,
  recordFailedLogin,
} from "./middleware/rate-limiter";
import { generateCsrfToken } from "./middleware/csrf";
import {
  addSessionAnswerSchema,
  addSessionMetricsSchema,
  createLiveSessionSchema,
  createSimulationSessionSchema,
  excelExportSchema,
  joinLiveSessionSchema,
  listResultsQuerySchema,
  mediaUploadSchema,
  patchSessionSchema,
  pdfExportSchema,
  sessionIdParamSchema,
  staffLoginBodySchema,
  studentSyncSchema,
  upsertSessionResultSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "./middleware/validation";

function getSingleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function parseStoredJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

function buildRecoveredLiveSnapshot(sessionDetails: NonNullable<ReturnType<typeof sessionStorage.getSessionDetails>>) {
  const { session, answers, metrics } = sessionDetails;
  const selectedCaseIds = parseStoredJson<string[]>(session.selectedCaseIdsJson, []);
  const enabledChannels = parseStoredJson(session.enabledChannelsJson, {
    audio: true,
    email: true,
    messenger: true,
    video: true,
  });
  const lastMetric = metrics[metrics.length - 1];
  const metricState = lastMetric
    ? {
        customersInStore: Number(lastMetric.queue || 0),
        avgCheck: 0,
        conversion: Number(lastMetric.conversion || 0),
        nps: 0,
        pickupSpeed: Math.round(clampNumber((100 - Number(lastMetric.deliveryStatus || 0)) / 3, 5, 45)),
        warehouseLoad: 0,
        teamMorale: Math.round((Number(lastMetric.morale || 0) / 10) * 10) / 10,
        dailyRevenue: Number(lastMetric.revenueImpact || 0),
      }
    : {
        customersInStore: 0,
        avgCheck: 0,
        conversion: 0,
        nps: 0,
        pickupSpeed: 0,
        warehouseLoad: 0,
        teamMorale: 7,
        dailyRevenue: 0,
      };

  const startedAtMs = new Date(session.startedAt).getTime();
  const lastAnswerMs = answers.reduce((latest, answer) => {
    const value = new Date(answer.timestamp).getTime();
    return Number.isFinite(value) ? Math.max(latest, value) : latest;
  }, startedAtMs);
  const timeLimitSeconds = Math.max(Number(session.timeLimit || 60) * 60, 60);
  const elapsedSeconds = clampNumber(Math.round((lastAnswerMs - startedAtMs) / 1000), 0, timeLimitSeconds - 1);
  const answeredMainCycles = new Set(
    answers
      .filter((answer) => answer.sourceType === "main_case")
      .map((answer) => `${answer.contentId}:${answer.cycle}`),
  );
  const caseQueue = selectedCaseIds.flatMap((caseId, caseIndex) => (
    [1, 2, 3]
      .filter((cycle) => !answeredMainCycles.has(`${caseId}:${cycle}`))
      .map((cycle) => caseIndex * 3 + (cycle - 1))
  ));
  const competencyTotals: Record<string, { total: number; count: number }> = {};
  const decisions = answers.map((answer) => {
    const details = (answer.details || {}) as Record<string, any>;
    const rawEffects = (answer.rawEffects || {}) as Record<string, any>;
    const competencyScores = (answer.competencyScores || {}) as Record<string, any>;
    const score = Number(answer.score || 0);
    const qualityRatio = clampNumber(score / 5, 0.1, 1);

    Object.entries(competencyScores).forEach(([competencyId, rawScore]) => {
      const value = Number(rawScore || 0);
      if (!competencyTotals[competencyId]) {
        competencyTotals[competencyId] = { total: 0, count: 0 };
      }
      competencyTotals[competencyId].total += value * qualityRatio;
      competencyTotals[competencyId].count += 1;
    });

    return {
      caseId: answer.contentId,
      sourceType: answer.sourceType,
      caseTitle: answer.caseTitle,
      cycle: answer.cycle,
      optionLevel: answer.optionLevel,
      optionText: answer.optionText,
      score,
      baseScore: Number(details.baseScore ?? score),
      timerPenalty: Number(details.timerPenalty || 0),
      timer: details.timer || null,
      responsibility: String(details.responsibility || ""),
      zoneLabel: String(details.zoneLabel || ""),
      taskType: String(details.channelLabel || answer.sourceType),
      rawEffects,
      consequences: [],
      competencyScores,
      timestamp: answer.timestamp,
      simTime: answer.simTime,
    };
  });
  const answeredEmailIds = answers.filter((answer) => answer.sourceType === "email").map((answer) => answer.contentId);
  const answeredMessengerIds = answers.filter((answer) => answer.sourceType === "messenger").map((answer) => answer.contentId);
  const answeredVideoIds = answers.filter((answer) => answer.sourceType === "video").map((answer) => answer.contentId);

  return {
    liveSessionId: "",
    updatedAt: Date.now(),
    state: {
      participantName: session.participantName,
      assessorName: session.evaluatorName,
      sessionId: session.id,
      difficulty: session.difficulty,
      selectedCaseIds,
      manualSelection: Boolean(session.manualSelection),
      repeatCases: false,
      timeLimit: Number(session.timeLimit || 60),
      isTestMode: Boolean(session.isTestMode),
      speedMultiplier: Number(session.speedMultiplier || 1),
      enabledChannels,
      startingMetrics: metricState,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
      timeRemaining: Math.max(1, timeLimitSeconds - elapsedSeconds),
      simDateTime: answers[answers.length - 1]?.simTime || "09:00",
      elapsedSeconds,
      pauseStartedAt: null,
      caseQueue,
      nextSignalAt: Math.min(timeLimitSeconds - 1, elapsedSeconds + 5),
      activeSignals: [],
      currentSignalId: null,
      toasts: [],
      actionPanelSource: null,
      actionPanelContentId: null,
      metrics: metricState,
      decisions,
      competencyTotals,
      showConsequence: false,
      lastConsequences: [],
      lastOptionText: "",
      journalOpen: false,
      arrivedEmailIds: answeredEmailIds,
      answeredEmailIds,
      openedEmailIds: answeredEmailIds,
      arrivedMessengerIds: answeredMessengerIds,
      answeredMessengerIds,
      openedMessengerIds: answeredMessengerIds,
      arrivedVideoIds: answeredVideoIds,
      answeredVideoIds,
      openedVideoIds: answeredVideoIds,
      emailSignalMeta: {},
      messengerSignalMeta: {},
      videoSignalMeta: {},
      pauses: [],
    },
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  liveSessionService.attach(httpServer);

  app.get("/api/simulation-content", (_req, res) => {
    res.json(contentStorage.getPublicContent(false));
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "dns-simcenter",
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || "development",
    });
  });

  app.post(
    "/api/staff/login",
    loginRateLimiter,
    validateBody(staffLoginBodySchema),
    asyncHandler(async (req, res) => {
      const body = req.validatedBody as { role?: "admin" | "evaluator"; username: string; password: string };
      const principal = await staffStorage.authenticate(body);
      if (!principal) {
        recordFailedLogin(req);
        res.status(401).json({ message: "Неверный логин или пароль" });
        return;
      }

      clearFailedAttempts(req);
      const csrfToken = generateCsrfToken();
      req.session.staff = principal;
      req.session.csrfToken = csrfToken;
      res.json({ ...principal, csrfToken });
    }),
  );

  app.post("/api/staff/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/staff/me", (req, res) => {
    if (!req.session.staff) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.session.staff);
  });

  app.post("/api/sessions", validateBody(createSimulationSessionSchema), (req, res) => {
    try {
      const body = req.validatedBody as z.infer<typeof createSimulationSessionSchema>;
      const participant = sessionStorage.createOrFindParticipant(
        body.participantName || "Участник",
        body.participantExternalId || null,
      );
      const staff = req.session.staff;
      const session = sessionStorage.createSimulationSession({
        participantId: participant?.id || null,
        participantName: body.participantName || participant?.fullName || "Участник",
        evaluatorAccountId: staff?.role === "evaluator" ? staff.id : null,
        evaluatorName: body.assessorName || staff?.displayName || "",
        difficulty: body.difficulty || "medium",
        selectedCaseIdsJson: JSON.stringify(body.selectedCaseIds || []),
        enabledChannelsJson: JSON.stringify(body.enabledChannels || {}),
        manualSelection: Boolean(body.manualSelection),
        timeLimit: body.timeLimit || 240,
        isTestMode: Boolean(body.isTestMode),
        speedMultiplier: body.speedMultiplier || 1,
        startedAt: body.startedAt || new Date().toISOString(),
        completedAt: null,
        technicalStatus: body.technicalStatus || "in_progress",
      });

      res.json(session);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.get("/api/sessions/:id", validateParams(sessionIdParamSchema), (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const session = sessionStorage.getSimulationSession(parseInt(id, 10));
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json(session);
  });

  app.patch("/api/sessions/:id", validateParams(sessionIdParamSchema), validateBody(patchSessionSchema), (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const body = req.validatedBody as z.infer<typeof patchSessionSchema>;
    const updated = sessionStorage.updateSimulationSession(parseInt(id, 10), {
      completedAt: body.completedAt || null,
      technicalStatus: body.technicalStatus || body.status || "completed",
    });
    if (!updated) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json(updated);
  });

  app.post("/api/sessions/:id/answers", validateParams(sessionIdParamSchema), validateBody(addSessionAnswerSchema), (req, res) => {
    try {
      const { id } = req.validatedParams as { id: string };
      const body = req.validatedBody as z.infer<typeof addSessionAnswerSchema>;
      const answer = sessionStorage.addSessionAnswer({
        sessionId: parseInt(id, 10),
        sourceType: body.sourceType,
        contentId: body.contentId,
        caseTitle: body.caseTitle || "",
        cycle: body.cycle || 1,
        optionLevel: body.optionLevel ?? 0,
        optionText: body.optionText || "",
        score: body.score ?? 0,
        rawEffectsJson: JSON.stringify(body.rawEffects || {}),
        competencyScoresJson: JSON.stringify(body.competencyScores || {}),
        detailsJson: JSON.stringify(body.details || {}),
        timestamp: body.timestamp || new Date().toISOString(),
        simTime: body.simTime || "",
      });
      res.json(answer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to save answer" });
    }
  });

  app.post("/api/sessions/:id/metrics", validateParams(sessionIdParamSchema), validateBody(addSessionMetricsSchema), (req, res) => {
    try {
      const { id } = req.validatedParams as { id: string };
      const body = req.validatedBody as z.infer<typeof addSessionMetricsSchema>;
      const metrics = sessionStorage.addSessionMetrics({
        sessionId: parseInt(id, 10),
        timestamp: body.timestamp || new Date().toISOString(),
        queue: body.queue ?? 20,
        conversion: body.conversion ?? 50,
        morale: body.morale ?? 60,
        revenueImpact: body.revenueImpact ?? 0,
        deliveryStatus: body.deliveryStatus ?? 0,
      });
      res.json(metrics);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to save metrics" });
    }
  });

  app.put("/api/sessions/:id/result", validateParams(sessionIdParamSchema), validateBody(upsertSessionResultSchema), (req, res) => {
    try {
      const { id } = req.validatedParams as { id: string };
      const body = req.validatedBody as z.infer<typeof upsertSessionResultSchema>;
      const result = sessionStorage.upsertSessionResult({
        sessionId: parseInt(id, 10),
        totalScore: body.totalScore || 0,
        averageScore: body.averageScore || 0,
        competencyAveragesJson: JSON.stringify(body.competencyAverages || {}),
        finalMetricsJson: JSON.stringify(body.finalMetrics || {}),
        timersJson: JSON.stringify(body.timers || []),
        pausesJson: JSON.stringify(body.pauses || []),
        exportedAt: body.exportedAt || null,
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to save result" });
    }
  });

  app.post("/api/live-sessions", requireStaff, validateBody(createLiveSessionSchema), (req, res) => {
    try {
      const body = req.validatedBody as z.infer<typeof createLiveSessionSchema>;
      const config = liveSessionService.createSession({
        assessorName: body.assessorName || req.session.staff?.displayName || "",
        participantName: body.participantName || "Участник",
        participantRole: body.participantRole || "",
        difficulty: body.difficulty || "medium",
        selectedCaseIds: body.selectedCaseIds || [],
        selectedChannelItemIds: body.selectedChannelItemIds || { email: [], messenger: [], video: [] },
        manualSelection: Boolean(body.manualSelection),
        repeatCases: Boolean(body.repeatCases),
        timeLimit: Number(body.timeLimit || 60),
        isTestMode: Boolean(body.isTestMode),
        speedMultiplier: Number(body.speedMultiplier || 1),
        enabledChannels: {
          audio: body.enabledChannels?.audio ?? true,
          email: body.enabledChannels?.email ?? true,
          messenger: body.enabledChannels?.messenger ?? true,
          video: body.enabledChannels?.video ?? false,
        },
        initialMetrics: (body.initialMetrics || {}) as any,
      });

      res.json(config);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create live session" });
    }
  });

  app.post("/api/live-sessions/recover/:sessionId", requireStaff, (req, res) => {
    try {
      const sessionId = Number.parseInt(getSingleParam(req.params.sessionId), 10);
      if (!Number.isFinite(sessionId)) {
        return res.status(400).json({ message: "Invalid session id" });
      }

      const details = sessionStorage.getSessionDetails(sessionId);
      if (!details) {
        return res.status(404).json({ message: "Persisted session not found" });
      }

      if (details.session.technicalStatus === "completed") {
        return res.status(409).json({ message: "Completed sessions cannot be recovered into live mode" });
      }

      const snapshot = buildRecoveredLiveSnapshot(details);
      const config = liveSessionService.recoverSession({
        assessorName: details.session.evaluatorName || req.session.staff?.displayName || "",
        participantName: details.session.participantName || "Участник",
        participantRole: "",
        difficulty: details.session.difficulty as any,
        selectedCaseIds: parseStoredJson<string[]>(details.session.selectedCaseIdsJson, []),
        manualSelection: Boolean(details.session.manualSelection),
        repeatCases: false,
        timeLimit: Number(details.session.timeLimit || 60),
        isTestMode: Boolean(details.session.isTestMode),
        speedMultiplier: Number(details.session.speedMultiplier || 1),
        enabledChannels: parseStoredJson(details.session.enabledChannelsJson, {
          audio: true,
          email: true,
          messenger: true,
          video: true,
        }),
        initialMetrics: snapshot.state.metrics,
        createdAt: new Date(details.session.startedAt).getTime() || Date.now(),
        snapshot: {
          ...snapshot,
          liveSessionId: "",
        },
        status: "running",
      });
      const recovered = liveSessionService.getSessionById(config.liveSessionId);

      sessionStorage.updateSimulationSession(sessionId, {
        technicalStatus: "in_progress",
        completedAt: null,
      });

      res.json(recovered || { config });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to recover live session" });
    }
  });

  app.post("/api/live-sessions/join", validateBody(joinLiveSessionSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof joinLiveSessionSchema>;
    const accessCode = normalizeLiveAccessCode(String(body.accessCode || ""));
    if (!accessCode) {
      return res.status(400).json({ message: "Access code is required" });
    }

    const session = liveSessionService.getSessionByAccessCode(accessCode);
    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    res.json(session);
  });

  app.post("/api/live-sessions/:id/student-sync", validateParams(z.object({ id: z.string().min(1).max(50) })), validateBody(studentSyncSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof studentSyncSchema>;
    const accessCode = normalizeLiveAccessCode(String(body.accessCode || ""));
    if (!accessCode) {
      return res.status(400).json({ message: "Access code is required" });
    }

    const session = liveSessionService.syncStudentState(getSingleParam(req.params.id), accessCode, {
      snapshot: (body.snapshot || null) as any,
      status: body.status as any,
    });

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    res.json(session);
  });

  app.get("/api/live-sessions/:id", (req, res) => {
    const session = liveSessionService.getSessionById(getSingleParam(req.params.id));
    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    const accessCode = normalizeLiveAccessCode(String(req.query?.accessCode || ""));
    const isStaff = Boolean(req.session.staff);
    const hasMatchingCode = Boolean(accessCode && session.config.accessCode === accessCode);

    if (!isStaff && !hasMatchingCode) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (isStaff) {
      const touchedSession = liveSessionService.touchPresence(session.config.liveSessionId, "assessor");
      if (touchedSession) {
        return res.json(touchedSession);
      }
    }

    res.json(session);
  });

  app.get("/api/staff/live-sessions", requireStaff, (_req, res) => {
    res.json(liveSessionService.listSessions());
  });

  app.delete("/api/live-sessions/:id", requireStaff, (req, res) => {
    const closed = liveSessionService.closeSession(getSingleParam(req.params.id));
    if (!closed) {
      return res.status(404).json({ message: "Live session not found" });
    }

    res.json({ ok: true });
  });

  app.get("/api/staff/content", requireStaff, (_req, res) => {
    res.json(contentStorage.getPublicContent(true));
  });

  app.get("/api/staff/results", requireStaff, validateQuery(listResultsQuerySchema), (req, res) => {
    const query = req.validatedQuery as z.infer<typeof listResultsQuerySchema>;
    const results = sessionStorage.listSessionResults({
      status: query.status,
      participantName: query.participantName,
    });
    res.json(results);
  });

  app.get("/api/staff/results/:id", requireStaff, validateParams(sessionIdParamSchema), (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const result = sessionStorage.getSessionDetails(parseInt(id, 10));
    if (!result) {
      return res.status(404).json({ message: "Result not found" });
    }
    res.json(result);
  });

  app.get("/api/admin/staff", requireAdmin, adminRateLimiter, (_req, res) => {
    res.json(staffStorage.listStaff());
  });

  app.delete("/api/admin/results/:id", requireAdmin, adminRateLimiter, validateParams(sessionIdParamSchema), (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const sessionId = parseInt(id, 10);
    const session = sessionStorage.getSimulationSession(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Сессия не найдена" });
    }

    sessionStorage.deleteSessionResult(sessionId);
    res.json({ ok: true, message: "Сессия и связанные данные удалены" });
  });

  app.put("/api/admin/settings", requireAdmin, adminRateLimiter, (req, res) => {
    const updated = contentStorage.updateSettings(req.body || {});
    res.json(updated);
  });

  app.post("/api/admin/assets", requireAdmin, heavyOperationRateLimiter, validateBody(mediaUploadSchema), (req, res) => {
    try {
      const body = req.validatedBody as z.infer<typeof mediaUploadSchema>;
      const upload = saveMediaUpload({
        data: body.data,
        mimeType: body.mimeType,
        originalFilename: body.originalFilename,
      });

      const asset = contentStorage.createAsset({
        name: body.name || body.originalFilename || "Медиафайл",
        kind: upload.kind,
        mimeType: body.mimeType,
        storagePath: upload.storagePath,
        originalFilename: upload.originalFilename,
        sizeBytes: upload.sizeBytes,
      });

      res.json(asset);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Upload failed" });
    }
  });

  app.post("/api/admin/cases", requireAdmin, adminRateLimiter, (req, res) => {
    const id = contentStorage.saveCase(req.body as EditableSimCase);
    res.json({ id });
  });

  app.post("/api/admin/cases/reorder", requireAdmin, adminRateLimiter, (req, res) => {
    contentStorage.reorderCases(req.body.ids || []);
    res.json({ ok: true });
  });

  app.delete("/api/admin/cases/:id", requireAdmin, adminRateLimiter, (req, res) => {
    contentStorage.deleteCase(getSingleParam(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/admin/chats", requireAdmin, adminRateLimiter, (req, res) => {
    const id = contentStorage.saveMessengerChat(req.body);
    res.json({ id });
  });

  app.delete("/api/admin/chats/:id", requireAdmin, adminRateLimiter, (req, res) => {
    contentStorage.deleteMessengerChat(getSingleParam(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/admin/email-cases", requireAdmin, adminRateLimiter, (req, res) => {
    const id = contentStorage.saveEmailCase(req.body as EditableEmailCase);
    res.json({ id });
  });

  app.post("/api/admin/messenger-cases", requireAdmin, adminRateLimiter, (req, res) => {
    const id = contentStorage.saveMessengerCase(req.body as EditableMessengerCase);
    res.json({ id });
  });

  app.post("/api/admin/video-cases", requireAdmin, adminRateLimiter, (req, res) => {
    const id = contentStorage.saveVideoCase(req.body as EditableVideoCase);
    res.json({ id });
  });

  app.delete("/api/admin/channel-items/:id", requireAdmin, adminRateLimiter, (req, res) => {
    contentStorage.deleteChannelItem(getSingleParam(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/export-pdf", heavyOperationRateLimiter, validateBody(pdfExportSchema), (req, res) => {
    try {
      const payload = req.validatedBody as any;
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const scriptPath = path.resolve(__dirname, "generate_pdf.py");
      const inputBuf = Buffer.from(JSON.stringify(payload), "utf-8");
      const pythonResult = spawnSync(
        "python3",
        [scriptPath],
        {
          input: inputBuf,
          maxBuffer: 20 * 1024 * 1024,
          timeout: 60000,
        },
      );

      if (pythonResult.error) {
        console.error("PDF spawn error:", pythonResult.error);
        return res.status(500).json({ error: "PDF generation failed", detail: pythonResult.error.message });
      }

      if (pythonResult.status !== 0) {
        const stderr = pythonResult.stderr ? (pythonResult.stderr as Buffer).toString("utf-8") : "unknown error";
        console.error("PDF script stderr:", stderr);
        return res.status(500).json({ error: "PDF generation error", detail: stderr.slice(0, 500) });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = `report_${dateStr}.pdf`;
      const utf8Name = encodeURIComponent((payload.participantName || "participant").replace(/\s+/g, "_") + `_${dateStr}.pdf`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"; filename*=UTF-8''${utf8Name}`);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.send(pythonResult.stdout);
    } catch (err: any) {
      console.error("PDF export error:", err);
      res.status(500).json({ error: "Internal error", detail: err.message });
    }
  });

  app.post("/api/export-xlsx", heavyOperationRateLimiter, validateBody(excelExportSchema), (req, res) => {
    try {
      const body = req.validatedBody as z.infer<typeof excelExportSchema>;
      const sheets = Array.isArray(body.sheets) ? body.sheets : [];
      if (sheets.length === 0) {
        return res.status(400).json({ message: "Не переданы листы для экспорта" });
      }

      const workbook = buildWorkbookBuffer({
        sheets: sheets.map((sheet: any, index: number) => ({
          name: typeof sheet?.name === "string" ? sheet.name : `Лист ${index + 1}`,
          rows: Array.isArray(sheet?.rows) ? sheet.rows : [],
        })),
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = `results_${dateStr}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.send(workbook);
    } catch (error: any) {
      console.error("XLSX export error:", error);
      res.status(500).json({ message: error.message || "Не удалось сформировать Excel" });
    }
  });

  return httpServer;
}
