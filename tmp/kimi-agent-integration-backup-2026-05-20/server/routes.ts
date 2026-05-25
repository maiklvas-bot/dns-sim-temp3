import path from "path";
import { spawnSync } from "child_process";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { staffLoginSchema } from "@shared/schema";
import { buildWorkbookBuffer } from "./excel-export";
import { contentStorage } from "./content-storage";
import type { EditableEmailCase, EditableMessengerCase, EditableSimCase, EditableVideoCase } from "./content-storage";
import { liveSessionService, normalizeLiveAccessCode } from "./live-session-service";
import { sessionStorage } from "./session-storage";
import { staffStorage } from "./staff-storage";
import { requireAdmin, requireStaff, saveMediaUpload } from "./route-utils";

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

  app.post("/api/staff/login", (req, res) => {
    const parsed = staffLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login payload" });
    }

    const principal = staffStorage.authenticate(parsed.data);
    if (!principal) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    req.session.staff = principal;
    res.json(principal);
  });

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

  app.post("/api/sessions", (req, res) => {
    try {
      const participant = sessionStorage.createOrFindParticipant(
        req.body.participantName || "Участник",
        req.body.participantExternalId || null,
      );
      const staff = req.session.staff;
      const session = sessionStorage.createSimulationSession({
        participantId: participant?.id || null,
        participantName: req.body.participantName || participant?.fullName || "Участник",
        evaluatorAccountId: staff?.role === "evaluator" ? staff.id : null,
        evaluatorName: req.body.assessorName || staff?.displayName || "",
        difficulty: req.body.difficulty || "medium",
        selectedCaseIdsJson: JSON.stringify(req.body.selectedCaseIds || []),
        enabledChannelsJson: JSON.stringify(req.body.enabledChannels || {}),
        manualSelection: Boolean(req.body.manualSelection),
        timeLimit: req.body.timeLimit || 240,
        isTestMode: Boolean(req.body.isTestMode),
        speedMultiplier: req.body.speedMultiplier || 1,
        startedAt: req.body.startedAt || new Date().toISOString(),
        completedAt: null,
        technicalStatus: req.body.technicalStatus || "in_progress",
      });

      res.json(session);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.get("/api/sessions/:id", (req, res) => {
    const session = sessionStorage.getSimulationSession(parseInt(req.params.id, 10));
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json(session);
  });

  app.patch("/api/sessions/:id", (req, res) => {
    const updated = sessionStorage.updateSimulationSession(parseInt(req.params.id, 10), {
      completedAt: req.body.completedAt || null,
      technicalStatus: req.body.technicalStatus || req.body.status || "completed",
    });
    if (!updated) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json(updated);
  });

  app.post("/api/sessions/:id/answers", (req, res) => {
    try {
      const answer = sessionStorage.addSessionAnswer({
        sessionId: parseInt(req.params.id, 10),
        sourceType: req.body.sourceType,
        contentId: req.body.contentId,
        caseTitle: req.body.caseTitle,
        cycle: req.body.cycle || 1,
        optionLevel: req.body.optionLevel,
        optionText: req.body.optionText,
        score: req.body.score,
        rawEffectsJson: JSON.stringify(req.body.rawEffects || {}),
        competencyScoresJson: JSON.stringify(req.body.competencyScores || {}),
        detailsJson: JSON.stringify(req.body.details || {}),
        timestamp: req.body.timestamp || new Date().toISOString(),
        simTime: req.body.simTime || "",
      });
      res.json(answer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to save answer" });
    }
  });

  app.post("/api/sessions/:id/metrics", (req, res) => {
    try {
      const metrics = sessionStorage.addSessionMetrics({
        sessionId: parseInt(req.params.id, 10),
        timestamp: req.body.timestamp || new Date().toISOString(),
        queue: req.body.queue ?? 20,
        conversion: req.body.conversion ?? 50,
        morale: req.body.morale ?? 60,
        revenueImpact: req.body.revenueImpact ?? 0,
        deliveryStatus: req.body.deliveryStatus ?? 0,
      });
      res.json(metrics);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to save metrics" });
    }
  });

  app.put("/api/sessions/:id/result", (req, res) => {
    try {
      const result = sessionStorage.upsertSessionResult({
        sessionId: parseInt(req.params.id, 10),
        totalScore: req.body.totalScore || 0,
        averageScore: req.body.averageScore || 0,
        competencyAveragesJson: JSON.stringify(req.body.competencyAverages || {}),
        finalMetricsJson: JSON.stringify(req.body.finalMetrics || {}),
        timersJson: JSON.stringify(req.body.timers || []),
        pausesJson: JSON.stringify(req.body.pauses || []),
        exportedAt: req.body.exportedAt || null,
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to save result" });
    }
  });

  app.post("/api/live-sessions", requireStaff, (req, res) => {
    try {
      const config = liveSessionService.createSession({
        assessorName: req.body.assessorName || req.session.staff?.displayName || "",
        participantName: req.body.participantName || "Участник",
        participantRole: req.body.participantRole || "",
        difficulty: req.body.difficulty || "medium",
        selectedCaseIds: Array.isArray(req.body.selectedCaseIds) ? req.body.selectedCaseIds : [],
        manualSelection: Boolean(req.body.manualSelection),
        repeatCases: Boolean(req.body.repeatCases),
        timeLimit: Number(req.body.timeLimit || 60),
        isTestMode: Boolean(req.body.isTestMode),
        speedMultiplier: Number(req.body.speedMultiplier || 1),
        enabledChannels: req.body.enabledChannels || { audio: true, email: true, messenger: true, video: false },
        initialMetrics: req.body.initialMetrics || {},
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

  app.post("/api/live-sessions/join", (req, res) => {
    const accessCode = normalizeLiveAccessCode(String(req.body?.accessCode || ""));
    if (!accessCode) {
      return res.status(400).json({ message: "Access code is required" });
    }

    const session = liveSessionService.getSessionByAccessCode(accessCode);
    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    res.json(session);
  });

  app.post("/api/live-sessions/:id/student-sync", (req, res) => {
    const accessCode = normalizeLiveAccessCode(String(req.body?.accessCode || ""));
    if (!accessCode) {
      return res.status(400).json({ message: "Access code is required" });
    }

    const session = liveSessionService.syncStudentState(getSingleParam(req.params.id), accessCode, {
      snapshot: req.body?.snapshot || null,
      status: req.body?.status,
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

  app.get("/api/staff/results", requireStaff, (req, res) => {
    const results = sessionStorage.listSessionResults({
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      participantName: typeof req.query.participantName === "string" ? req.query.participantName : undefined,
    });
    res.json(results);
  });

  app.get("/api/staff/results/:id", requireStaff, (req, res) => {
    const result = sessionStorage.getSessionDetails(parseInt(getSingleParam(req.params.id), 10));
    if (!result) {
      return res.status(404).json({ message: "Result not found" });
    }
    res.json(result);
  });

  app.put("/api/admin/settings", requireAdmin, (req, res) => {
    const updated = contentStorage.updateSettings(req.body || {});
    res.json(updated);
  });

  app.post("/api/admin/assets", requireAdmin, (req, res) => {
    try {
      const upload = saveMediaUpload({
        data: req.body.data,
        mimeType: req.body.mimeType,
        originalFilename: req.body.originalFilename,
      });

      const asset = contentStorage.createAsset({
        name: req.body.name || req.body.originalFilename || "Медиафайл",
        kind: upload.kind,
        mimeType: req.body.mimeType,
        storagePath: upload.storagePath,
        originalFilename: upload.originalFilename,
        sizeBytes: upload.sizeBytes,
      });

      res.json(asset);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Upload failed" });
    }
  });

  app.post("/api/admin/cases", requireAdmin, (req, res) => {
    const id = contentStorage.saveCase(req.body as EditableSimCase);
    res.json({ id });
  });

  app.post("/api/admin/cases/reorder", requireAdmin, (req, res) => {
    contentStorage.reorderCases(req.body.ids || []);
    res.json({ ok: true });
  });

  app.delete("/api/admin/cases/:id", requireAdmin, (req, res) => {
    contentStorage.deleteCase(getSingleParam(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/admin/chats", requireAdmin, (req, res) => {
    const id = contentStorage.saveMessengerChat(req.body);
    res.json({ id });
  });

  app.delete("/api/admin/chats/:id", requireAdmin, (req, res) => {
    contentStorage.deleteMessengerChat(getSingleParam(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/admin/email-cases", requireAdmin, (req, res) => {
    const id = contentStorage.saveEmailCase(req.body as EditableEmailCase);
    res.json({ id });
  });

  app.post("/api/admin/messenger-cases", requireAdmin, (req, res) => {
    const id = contentStorage.saveMessengerCase(req.body as EditableMessengerCase);
    res.json({ id });
  });

  app.post("/api/admin/video-cases", requireAdmin, (req, res) => {
    const id = contentStorage.saveVideoCase(req.body as EditableVideoCase);
    res.json({ id });
  });

  app.delete("/api/admin/channel-items/:id", requireAdmin, (req, res) => {
    contentStorage.deleteChannelItem(getSingleParam(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/export-pdf", (req, res) => {
    try {
      const payload = req.body;
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
      res.send(pythonResult.stdout);
    } catch (err: any) {
      console.error("PDF export error:", err);
      res.status(500).json({ error: "Internal error", detail: err.message });
    }
  });

  app.post("/api/export-xlsx", (req, res) => {
    try {
      const sheets = Array.isArray(req.body?.sheets) ? req.body.sheets : [];
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
      res.send(workbook);
    } catch (error: any) {
      console.error("XLSX export error:", error);
      res.status(500).json({ message: error.message || "Не удалось сформировать Excel" });
    }
  });

  return httpServer;
}
