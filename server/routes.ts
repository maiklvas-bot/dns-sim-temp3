import path from "path";
import fs from "fs";
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { accumulateCompetencyTotals } from "@shared/simulation-scoring";
import { buildWorkbookBuffer } from "./excel-export";
import { requireExportAccess } from "./export-access";
import { generatePdfBuffer } from "./pdf-export";
import { contentStorage } from "./content-storage";
import type { EditableEmailCase, EditableMessengerCase, EditableSimCase, EditableVideoCase } from "./content-storage";
import { liveSessionService, normalizeLiveAccessCode } from "./live-session-service";
import { sessionStorage } from "./session-storage";
import {
  createSimulationSessionToken,
  hashSimulationSessionToken,
  requireSimulationAccess,
  toPublicSimulationSession,
} from "./simulation-session-access";
import { staffStorage } from "./staff-storage";
import { auditStorage, type AuditRecordInput } from "./audit-storage";
import { requireAdmin, requireStaff, saveMediaUpload } from "./route-utils";
import {
  adminRateLimiter,
  clearFailedAttempts,
  heavyOperationRateLimiter,
  loginFailedAttemptLimiter,
  loginRateLimiter,
  recordFailedLogin,
} from "./middleware/rate-limiter";
import { generateCsrfToken, getCsrfToken } from "./middleware/csrf";
import { internalApiError } from "./middleware/error-handler";
import {
  addSessionAnswerSchema,
  addSessionMetricsSchema,
  auditLogsQuerySchema,
  adminCaseReorderSchema,
  adminSettingsSchema,
  createLiveSessionSchema,
  createSimulationSessionSchema,
  editableChatSchema,
  editableEmailCaseSchema,
  editableMessengerCaseSchema,
  editableSimCaseSchema,
  editableVideoCaseSchema,
  excelExportSchema,
  joinLiveSessionSchema,
  listResultsQuerySchema,
  liveRecoverSessionParamSchema,
  liveSessionAccessQuerySchema,
  liveSessionIdParamSchema,
  mediaUploadSchema,
  patchSessionSchema,
  pdfExportSchema,
  sessionIdParamSchema,
  staffElevationBodySchema,
  staffLoginBodySchema,
  stringIdParamSchema,
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

function getPdfFilenamePart(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\x00-\x1F<>:"/\\|?*]+/g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);

  return normalized || "participant";
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

function recordAudit(req: Request, input: AuditRecordInput) {
  try {
    return auditStorage.record(req, input);
  } catch (error) {
    console.error("Failed to persist audit event", error);
    return null;
  }
}

function getCaseSnapshot(id: string) {
  return contentStorage.getPublicContent(true).cases.find((item) => item.id === id) || null;
}

function getEmailSnapshot(id: string) {
  return contentStorage.getPublicContent(true).emailCases.find((item) => item.id === id) || null;
}

function getMessengerSnapshot(id: string) {
  return contentStorage.getPublicContent(true).messengerCases.find((item) => item.id === id) || null;
}

function getVideoSnapshot(id: string) {
  return contentStorage.getPublicContent(true).videoCases.find((item) => item.id === id) || null;
}

function getChatSnapshot(id: string) {
  return contentStorage.getPublicContent(true).messengerChats.find((item) => item.id === id) || null;
}

function getChannelEntitySnapshot(id: string) {
  const content = contentStorage.getPublicContent(true);
  const email = content.emailCases.find((item) => item.id === id);
  if (email) return { entityType: "email" as const, value: email };
  const messenger = content.messengerCases.find((item) => item.id === id);
  if (messenger) return { entityType: "messenger" as const, value: messenger };
  const video = content.videoCases.find((item) => item.id === id);
  if (video) return { entityType: "video" as const, value: video };
  return { entityType: "channel-item" as const, value: null };
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
        nps: 3.3,
        pickupSpeed: Math.round(clampNumber((100 - Number(lastMetric.deliveryStatus || 0)) / 3, 5, 45)),
        warehouseLoad: 0,
        teamMorale: Math.round((Number(lastMetric.morale || 0) / 10) * 10) / 10,
        dailyRevenue: Number(lastMetric.revenueImpact || 0),
      }
    : {
        customersInStore: 0,
        avgCheck: 0,
        conversion: 0,
        nps: 3.3,
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
  const content = contentStorage.getPublicContent(true);
  const selectedCases = selectedCaseIds
    .map((caseId) => content.cases.find((caseItem) => caseItem.id === caseId))
    .filter((caseItem): caseItem is NonNullable<typeof caseItem> => Boolean(caseItem));
  let queuePointer = 0;
  const caseQueue = selectedCases.flatMap((caseItem) => {
    const caseStartPointer = queuePointer;
    const cycles = caseItem.cycles.length > 0 ? caseItem.cycles : [{ cycle: 1 }];
    queuePointer += Math.max(1, cycles.length);

    return cycles
      .filter((cycle) => !answeredMainCycles.has(`${caseItem.id}:${cycle.cycle}`))
      .map((cycle) => caseStartPointer + Math.max(0, cycle.cycle - 1));
  });
  let competencyTotals: Record<string, { total: number; count: number }> = {};
  const decisions = answers.map((answer) => {
    const details = (answer.details || {}) as Record<string, any>;
    const rawEffects = (answer.rawEffects || {}) as Record<string, any>;
    const competencyScores = (answer.competencyScores || {}) as Record<string, any>;
    const score = Number(answer.score || 0);
    competencyTotals = accumulateCompetencyTotals(
      competencyTotals,
      competencyScores,
      answer.contentId,
      answer.sourceType,
      score,
      content.settings,
    );

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
  const requireSessionAccess = requireSimulationAccess(sessionStorage);
  const requireAuthorizedExport = requireExportAccess(sessionStorage);

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
    loginFailedAttemptLimiter,
    loginRateLimiter,
    validateBody(staffLoginBodySchema),
    asyncHandler(async (req, res) => {
      const body = req.validatedBody as { role?: "admin" | "evaluator"; username: string; password: string };
      const principal = await staffStorage.authenticate(body);
      if (!principal) {
        recordFailedLogin(req);
        recordAudit(req, {
          area: "security",
          action: "login_failed",
          outcome: "failure",
          actor: {
            username: body.username,
            displayName: body.username,
            role: body.role || null,
          },
          entityType: "staff-session",
          entityId: body.username,
          summary: `Неудачная попытка входа: ${body.username}`,
          metadata: {
            requestedRole: body.role || null,
            passwordProvided: body.password.length > 0,
          },
        });
        res.status(401).json({ message: "Неверный логин или пароль" });
        return;
      }

      clearFailedAttempts(req);
      const csrfToken = generateCsrfToken();
      req.session.staff = principal;
      req.session.csrfToken = csrfToken;
      recordAudit(req, {
        area: "security",
        action: "login_success",
        actor: principal,
        entityType: "staff-session",
        entityId: principal.id,
        summary: `Вход выполнен: ${principal.displayName}`,
        metadata: {
          requestedRole: body.role || principal.role,
          passwordProvided: body.password.length > 0,
        },
      });
      res.json({ ...principal, csrfToken });
    }),
  );

  app.post("/api/staff/logout", (req, res) => {
    const actor = req.session.staff || null;
    recordAudit(req, {
      area: "security",
      action: "logout",
      actor,
      entityType: "staff-session",
      entityId: actor?.id || null,
      summary: actor ? `Выход из системы: ${actor.displayName}` : "Выход из анонимной сессии",
    });
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.post(
    "/api/staff/elevate",
    requireStaff,
    loginFailedAttemptLimiter,
    loginRateLimiter,
    validateBody(staffElevationBodySchema),
    asyncHandler(async (req, res) => {
      const evaluatorActor = req.session.staff || null;
      if (req.session.staff?.role !== "evaluator") {
        recordAudit(req, {
          area: "security",
          action: "role_elevation_denied",
          outcome: "failure",
          actor: evaluatorActor,
          entityType: "staff-session",
          entityId: evaluatorActor?.id || null,
          summary: "Отклонена попытка перехода в меню администратора",
        });
        res.status(403).json({
          message: "Повышение роли доступно только из меню оценщика.",
          code: "EVALUATOR_REQUIRED",
        });
        return;
      }

      const body = req.validatedBody as { password: string };
      const principal = await staffStorage.authenticateAdminByPassword(body.password);
      if (!principal) {
        recordFailedLogin(req);
        recordAudit(req, {
          area: "security",
          action: "role_elevation_failed",
          outcome: "failure",
          actor: evaluatorActor,
          entityType: "staff-session",
          entityId: evaluatorActor?.id || null,
          summary: "Неверный пароль при переходе оценщика в меню администратора",
          metadata: { passwordProvided: body.password.length > 0 },
        });
        res.status(401).json({ message: "Неверный пароль администратора." });
        return;
      }

      clearFailedAttempts(req);
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });

      const csrfToken = generateCsrfToken();
      req.session.staff = principal;
      req.session.csrfToken = csrfToken;
      recordAudit(req, {
        area: "security",
        action: "role_elevation_success",
        actor: evaluatorActor,
        entityType: "staff-session",
        entityId: evaluatorActor?.id || null,
        summary: `Оценщик ${evaluatorActor?.displayName || ""} перешел в меню администратора`,
        before: evaluatorActor,
        after: principal,
        metadata: { passwordProvided: body.password.length > 0 },
      });
      res.json({ ...principal, csrfToken });
    }),
  );

  app.get("/api/staff/me", (req, res) => {
    if (!req.session.staff) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json({ ...req.session.staff, csrfToken: getCsrfToken(req) });
  });

  app.post("/api/sessions", validateBody(createSimulationSessionSchema), (req, res, next) => {
    try {
      const body = req.validatedBody as z.infer<typeof createSimulationSessionSchema>;
      const participant = sessionStorage.createOrFindParticipant(
        body.participantName || "Участник",
        body.participantExternalId || null,
      );
      const staff = req.session.staff;
      const sessionToken = createSimulationSessionToken();
      const session = sessionStorage.createSimulationSession({
        participantId: participant?.id || null,
        participantTokenHash: hashSimulationSessionToken(sessionToken),
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

      const publicSession = toPublicSimulationSession(session);
      recordAudit(req, {
        area: req.session.staff?.role === "admin" ? "admin" : "evaluator",
        action: "simulation_session_created",
        entityType: "simulation-session",
        entityId: session.id,
        summary: `Создана симуляция для участника ${session.participantName}`,
        after: publicSession,
      });
      res.json({ ...publicSession, sessionToken });
    } catch (error) {
      next(internalApiError(
        "SIMULATION_SESSION_CREATE_FAILED",
        "Не удалось создать сессию симуляции.",
        error,
      ));
    }
  });

  app.get(
    "/api/sessions/:id",
    validateParams(sessionIdParamSchema),
    requireSessionAccess,
    (req, res) => {
      res.json(toPublicSimulationSession(req.simulationSession!));
    },
  );

  app.patch("/api/sessions/:id", validateParams(sessionIdParamSchema), requireSessionAccess, validateBody(patchSessionSchema), (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const body = req.validatedBody as z.infer<typeof patchSessionSchema>;
    const sessionId = parseInt(id, 10);
    const before = sessionStorage.getSimulationSession(sessionId);
    const updated = sessionStorage.updateSimulationSession(sessionId, {
      completedAt: body.completedAt || null,
      technicalStatus: body.technicalStatus || body.status || "completed",
    });
    if (!updated) {
      return res.status(404).json({ message: "Session not found" });
    }
    recordAudit(req, {
      area: "simulation",
      action: "simulation_session_updated",
      entityType: "simulation-session",
      entityId: sessionId,
      summary: `Обновлен статус симуляции #${sessionId}`,
      before,
      after: updated,
    });
    res.json(toPublicSimulationSession(updated));
  });

  app.post("/api/sessions/:id/answers", validateParams(sessionIdParamSchema), requireSessionAccess, validateBody(addSessionAnswerSchema), (req, res, next) => {
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
      const session = sessionStorage.getSimulationSession(parseInt(id, 10));
      recordAudit(req, {
        area: "simulation",
        action: "simulation_answer_recorded",
        actor: req.session.staff || {
          username: session?.participantName || "participant",
          displayName: session?.participantName || "Участник",
          role: "participant",
        },
        entityType: "session-answer",
        entityId: answer.id,
        summary: `Сохранен ответ в симуляции #${id}: ${answer.caseTitle}`,
        after: answer,
        metadata: { sessionId: Number(id) },
      });
      res.json(answer);
    } catch (error) {
      next(internalApiError(
        "SIMULATION_ANSWER_SAVE_FAILED",
        "Не удалось сохранить ответ участника.",
        error,
      ));
    }
  });

  app.post("/api/sessions/:id/metrics", validateParams(sessionIdParamSchema), requireSessionAccess, validateBody(addSessionMetricsSchema), (req, res, next) => {
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
      next(internalApiError(
        "SIMULATION_METRICS_SAVE_FAILED",
        "Не удалось сохранить показатели симуляции.",
        error,
      ));
    }
  });

  app.put("/api/sessions/:id/result", validateParams(sessionIdParamSchema), requireSessionAccess, validateBody(upsertSessionResultSchema), (req, res, next) => {
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
      recordAudit(req, {
        area: "simulation",
        action: "simulation_result_saved",
        entityType: "simulation-result",
        entityId: result.id,
        summary: `Сохранен итог симуляции #${id}`,
        after: result,
        metadata: { sessionId: Number(id) },
      });
      res.json(result);
    } catch (error) {
      next(internalApiError(
        "SIMULATION_RESULT_SAVE_FAILED",
        "Не удалось сохранить результат симуляции.",
        error,
      ));
    }
  });

  app.post("/api/live-sessions", requireStaff, validateBody(createLiveSessionSchema), (req, res, next) => {
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

      recordAudit(req, {
        area: "evaluator",
        action: "live_session_started",
        entityType: "live-session",
        entityId: config.liveSessionId,
        summary: `Запущена live-сессия для ${config.participantName}`,
        after: config,
      });
      res.json(config);
    } catch (error) {
      next(internalApiError(
        "LIVE_SESSION_CREATE_FAILED",
        "Не удалось запустить live-сессию.",
        error,
      ));
    }
  });

  app.post("/api/live-sessions/recover/:sessionId", requireStaff, validateParams(liveRecoverSessionParamSchema), (req, res, next) => {
    try {
      const { sessionId: validatedSessionId } = req.validatedParams as z.infer<typeof liveRecoverSessionParamSchema>;
      const sessionId = Number.parseInt(validatedSessionId, 10);
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

      recordAudit(req, {
        area: "evaluator",
        action: "live_session_recovered",
        entityType: "live-session",
        entityId: config.liveSessionId,
        summary: `Восстановлена live-сессия из симуляции #${sessionId}`,
        after: recovered || { config },
        metadata: { persistedSessionId: sessionId },
      });
      res.json(recovered || { config });
    } catch (error) {
      next(internalApiError(
        "LIVE_SESSION_RECOVERY_FAILED",
        "Не удалось восстановить live-сессию.",
        error,
      ));
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
      recordAudit(req, {
        area: "security",
        action: "participant_join_failed",
        outcome: "failure",
        actor: { username: "participant", displayName: "Участник", role: "participant" },
        entityType: "live-session",
        summary: "Неудачная попытка входа участника по коду сессии",
        metadata: { accessCodeProvided: accessCode.length > 0 },
      });
      return res.status(404).json({ message: "Live session not found" });
    }

    recordAudit(req, {
      area: "simulation",
      action: "participant_joined",
      actor: {
        username: session.config.participantName,
        displayName: session.config.participantName,
        role: "participant",
      },
      entityType: "live-session",
      entityId: session.config.liveSessionId,
      summary: `Участник ${session.config.participantName} подключился к симуляции`,
      metadata: { accessCodeProvided: accessCode.length > 0 },
    });
    res.json(session);
  });

  app.post("/api/live-sessions/:id/student-sync", validateParams(liveSessionIdParamSchema), validateBody(studentSyncSchema), (req, res) => {
    const { id } = req.validatedParams as z.infer<typeof liveSessionIdParamSchema>;
    const body = req.validatedBody as z.infer<typeof studentSyncSchema>;
    const accessCode = normalizeLiveAccessCode(String(body.accessCode || ""));
    if (!accessCode) {
      return res.status(400).json({ message: "Access code is required" });
    }

    const session = liveSessionService.syncStudentState(id, accessCode, {
      snapshot: (body.snapshot || null) as any,
      status: body.status as any,
    });

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    res.json(session);
  });

  app.get("/api/live-sessions/:id", validateParams(liveSessionIdParamSchema), validateQuery(liveSessionAccessQuerySchema), (req, res) => {
    const { id } = req.validatedParams as z.infer<typeof liveSessionIdParamSchema>;
    const query = req.validatedQuery as z.infer<typeof liveSessionAccessQuerySchema>;
    const session = liveSessionService.getSessionById(id);
    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    const accessCode = normalizeLiveAccessCode(String(query.accessCode || ""));
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

  app.delete("/api/live-sessions/:id", requireStaff, validateParams(liveSessionIdParamSchema), (req, res) => {
    const { id } = req.validatedParams as z.infer<typeof liveSessionIdParamSchema>;
    const before = liveSessionService.getSessionById(id);
    const closed = liveSessionService.closeSession(id);
    if (!closed) {
      return res.status(404).json({ message: "Live session not found" });
    }

    recordAudit(req, {
      area: req.session.staff?.role === "admin" ? "admin" : "evaluator",
      action: "live_session_closed",
      entityType: "live-session",
      entityId: id,
      summary: `Закрыта live-сессия ${id}`,
      before,
      after: null,
    });
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

  app.get("/api/admin/audit-logs", requireAdmin, adminRateLimiter, validateQuery(auditLogsQuerySchema), (req, res) => {
    const query = req.validatedQuery as z.infer<typeof auditLogsQuerySchema>;
    res.json(auditStorage.list(query));
  });

  app.delete("/api/admin/results/:id", requireAdmin, adminRateLimiter, validateParams(sessionIdParamSchema), (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const sessionId = parseInt(id, 10);
    const session = sessionStorage.getSimulationSession(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Сессия не найдена" });
    }

    const before = sessionStorage.getSessionDetails(sessionId);
    sessionStorage.deleteSessionResult(sessionId);
    recordAudit(req, {
      area: "admin",
      action: "simulation_result_deleted",
      entityType: "simulation-result",
      entityId: sessionId,
      summary: `Удалены результаты симуляции #${sessionId}`,
      before,
      after: null,
    });
    res.json({ ok: true, message: "Сессия и связанные данные удалены" });
  });

  app.put("/api/admin/settings", requireAdmin, adminRateLimiter, validateBody(adminSettingsSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof adminSettingsSchema>;
    const before = contentStorage.getSettings();
    const updated = contentStorage.updateSettings(body);
    recordAudit(req, {
      area: "admin",
      action: "settings_updated",
      entityType: "simulation-settings",
      entityId: updated?.id || before?.id || "default",
      summary: "Изменены системные параметры симуляции",
      before,
      after: updated,
    });
    res.json(updated);
  });

  app.post("/api/admin/assets", requireAdmin, heavyOperationRateLimiter, validateBody(mediaUploadSchema), (req, res, next) => {
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

      recordAudit(req, {
        area: "admin",
        action: "media_uploaded",
        entityType: "media-asset",
        entityId: asset.id,
        summary: `Загружен медиафайл: ${asset.name}`,
        after: asset,
        metadata: {
          mimeType: body.mimeType,
          originalFilename: body.originalFilename,
          sizeBytes: upload.sizeBytes,
        },
      });
      res.json(asset);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/cases", requireAdmin, adminRateLimiter, validateBody(editableSimCaseSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof editableSimCaseSchema>;
    const before = body.id ? getCaseSnapshot(body.id) : null;
    const id = contentStorage.saveCase(body as EditableSimCase);
    const after = getCaseSnapshot(id);
    recordAudit(req, {
      area: "admin",
      action: before ? "case_updated" : "case_created",
      entityType: "case",
      entityId: id,
      summary: `${before ? "Изменен" : "Создан"} кейс: ${after?.title || id}`,
      before,
      after,
    });
    res.json({ id });
  });

  app.post("/api/admin/cases/reorder", requireAdmin, adminRateLimiter, validateBody(adminCaseReorderSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof adminCaseReorderSchema>;
    const before = contentStorage.getPublicContent(true).cases.map((item) => ({ id: item.id, title: item.title, sortOrder: item.sortOrder }));
    contentStorage.reorderCases(body.ids);
    const after = contentStorage.getPublicContent(true).cases.map((item) => ({ id: item.id, title: item.title, sortOrder: item.sortOrder }));
    recordAudit(req, {
      area: "admin",
      action: "cases_reordered",
      entityType: "case-order",
      entityId: "all",
      summary: "Изменен порядок основных кейсов",
      before,
      after,
    });
    res.json({ ok: true });
  });

  app.delete("/api/admin/cases/:id", requireAdmin, adminRateLimiter, validateParams(stringIdParamSchema), (req, res) => {
    const { id } = req.validatedParams as z.infer<typeof stringIdParamSchema>;
    const before = getCaseSnapshot(id);
    contentStorage.deleteCase(id);
    recordAudit(req, {
      area: "admin",
      action: "case_deleted",
      entityType: "case",
      entityId: id,
      summary: `Удален кейс: ${before?.title || id}`,
      before,
      after: null,
    });
    res.json({ ok: true });
  });

  app.post("/api/admin/chats", requireAdmin, adminRateLimiter, validateBody(editableChatSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof editableChatSchema>;
    const before = body.id ? getChatSnapshot(body.id) : null;
    const id = contentStorage.saveMessengerChat(body);
    const after = getChatSnapshot(id);
    recordAudit(req, {
      area: "admin",
      action: before ? "chat_updated" : "chat_created",
      entityType: "chat",
      entityId: id,
      summary: `${before ? "Изменен" : "Создан"} чат: ${after?.name || id}`,
      before,
      after,
    });
    res.json({ id });
  });

  app.delete("/api/admin/chats/:id", requireAdmin, adminRateLimiter, validateParams(stringIdParamSchema), (req, res) => {
    const { id } = req.validatedParams as z.infer<typeof stringIdParamSchema>;
    const before = getChatSnapshot(id);
    contentStorage.deleteMessengerChat(id);
    recordAudit(req, {
      area: "admin",
      action: "chat_deleted",
      entityType: "chat",
      entityId: id,
      summary: `Удален чат: ${before?.name || id}`,
      before,
      after: null,
    });
    res.json({ ok: true });
  });

  app.post("/api/admin/email-cases", requireAdmin, adminRateLimiter, validateBody(editableEmailCaseSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof editableEmailCaseSchema>;
    const before = body.id ? getEmailSnapshot(body.id) : null;
    const id = contentStorage.saveEmailCase(body as EditableEmailCase);
    const after = getEmailSnapshot(id);
    recordAudit(req, {
      area: "admin",
      action: before ? "email_updated" : "email_created",
      entityType: "email",
      entityId: id,
      summary: `${before ? "Изменено" : "Создано"} письмо: ${after?.subject || id}`,
      before,
      after,
    });
    res.json({ id });
  });

  app.post("/api/admin/messenger-cases", requireAdmin, adminRateLimiter, validateBody(editableMessengerCaseSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof editableMessengerCaseSchema>;
    const before = body.id ? getMessengerSnapshot(body.id) : null;
    const id = contentStorage.saveMessengerCase(body as EditableMessengerCase);
    const after = getMessengerSnapshot(id);
    recordAudit(req, {
      area: "admin",
      action: before ? "messenger_updated" : "messenger_created",
      entityType: "messenger",
      entityId: id,
      summary: `${before ? "Изменено" : "Создано"} сообщение: ${after?.senderName || id}`,
      before,
      after,
    });
    res.json({ id });
  });

  app.post("/api/admin/video-cases", requireAdmin, adminRateLimiter, validateBody(editableVideoCaseSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof editableVideoCaseSchema>;
    const before = body.id ? getVideoSnapshot(body.id) : null;
    const id = contentStorage.saveVideoCase(body as EditableVideoCase);
    const after = getVideoSnapshot(id);
    recordAudit(req, {
      area: "admin",
      action: before ? "video_updated" : "video_created",
      entityType: "video",
      entityId: id,
      summary: `${before ? "Изменено" : "Создано"} видео: ${after?.title || id}`,
      before,
      after,
    });
    res.json({ id });
  });

  app.delete("/api/admin/channel-items/:id", requireAdmin, adminRateLimiter, validateParams(stringIdParamSchema), (req, res) => {
    const { id } = req.validatedParams as z.infer<typeof stringIdParamSchema>;
    const before = getChannelEntitySnapshot(id);
    contentStorage.deleteChannelItem(id);
    recordAudit(req, {
      area: "admin",
      action: `${before.entityType}_deleted`,
      entityType: before.entityType,
      entityId: id,
      summary: `Удален элемент канала: ${id}`,
      before: before.value,
      after: null,
    });
    res.json({ ok: true });
  });

  app.post("/api/export-pdf", heavyOperationRateLimiter, validateBody(pdfExportSchema), requireAuthorizedExport, async (req, res, next) => {
    try {
      const payload = req.validatedBody as z.infer<typeof pdfExportSchema>;

      const scriptPath = path.resolve(__dirname, "generate_pdf.py");
      if (!fs.existsSync(scriptPath)) {
        next(internalApiError(
          "PDF_EXPORT_FAILED",
          "Не удалось сформировать PDF.",
          new Error(`PDF generator not found: ${scriptPath}`),
        ));
        return;
      }

      const pdf = await generatePdfBuffer(payload, scriptPath);

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = `report_${dateStr}.pdf`;
      const utf8Name = encodeURIComponent(`${getPdfFilenamePart(payload.participantName)}_${dateStr}.pdf`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"; filename*=UTF-8''${utf8Name}`);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.send(pdf);
    } catch (error) {
      next(internalApiError(
        "PDF_EXPORT_FAILED",
        "Не удалось сформировать PDF.",
        error,
      ));
    }
  });

  app.post("/api/export-xlsx", heavyOperationRateLimiter, validateBody(excelExportSchema), requireAuthorizedExport, (req, res, next) => {
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
    } catch (error) {
      next(internalApiError(
        "XLSX_EXPORT_FAILED",
        "Не удалось сформировать Excel.",
        error,
      ));
    }
  });

  return httpServer;
}
