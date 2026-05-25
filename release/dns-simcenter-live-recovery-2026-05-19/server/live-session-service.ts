import { randomUUID } from "crypto";
import type { IncomingMessage, Server } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import type {
  LiveSimulationConfig,
  LiveSimulationMonitorSummary,
  LiveSimulationPresence,
  LiveSimulationSessionState,
  LiveSimulationSnapshot,
  LiveSimulationSocketMessage,
  LiveSimulationStatus,
} from "@shared/live-session";

type SocketRole = "assessor" | "student";

interface SocketContext {
  liveSessionId: string;
  role: SocketRole;
}

interface LiveSessionRecord {
  config: LiveSimulationConfig;
  snapshot: LiveSimulationSnapshot | null;
  presence: LiveSimulationPresence;
  status: LiveSimulationStatus;
  completedAt: number | null;
  updatedAt: number;
  lastSeenAt: {
    assessor: number | null;
    student: number | null;
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function generateAccessCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function normalizeAccessCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function safeSend(socket: WebSocket, message: LiveSimulationSocketMessage) {
  if (socket.readyState !== 1) {
    return;
  }

  socket.send(JSON.stringify(message));
}

class LiveSessionService {
  private readonly sessions = new Map<string, LiveSessionRecord>();
  private readonly accessCodeToSessionId = new Map<string, string>();
  private readonly sockets = new Map<WebSocket, SocketContext>();
  private serverAttached = false;

  createSession(
    input: Omit<LiveSimulationConfig, "liveSessionId" | "accessCode" | "createdAt">,
  ): LiveSimulationConfig {
    const createdAt = Date.now();
    let accessCode = "";
    do {
      accessCode = generateAccessCode();
    } while (this.accessCodeToSessionId.has(accessCode));

    const config: LiveSimulationConfig = {
      ...input,
      liveSessionId: randomUUID(),
      accessCode,
      createdAt,
    };

    this.sessions.set(config.liveSessionId, {
      config,
      snapshot: null,
      presence: {
        assessorConnected: true,
        studentConnected: false,
      },
      status: "waiting",
      completedAt: null,
      updatedAt: createdAt,
      lastSeenAt: {
        assessor: createdAt,
        student: null,
      },
    });
    this.accessCodeToSessionId.set(accessCode, config.liveSessionId);

    return config;
  }

  recoverSession(
    input: Omit<LiveSimulationConfig, "liveSessionId" | "accessCode" | "createdAt"> & {
      createdAt?: number;
      liveSessionId?: string;
      accessCode?: string;
      snapshot?: LiveSimulationSnapshot | null;
      status?: LiveSimulationStatus;
    },
  ): LiveSimulationConfig {
    const createdAt = input.createdAt || Date.now();
    let accessCode = input.accessCode ? normalizeAccessCode(input.accessCode) : "";
    do {
      accessCode = accessCode || generateAccessCode();
    } while (this.accessCodeToSessionId.has(accessCode));

    const config: LiveSimulationConfig = {
      ...input,
      liveSessionId: input.liveSessionId || randomUUID(),
      accessCode,
      createdAt,
    };

    const snapshot = input.snapshot
      ? {
          ...input.snapshot,
          liveSessionId: config.liveSessionId,
        }
      : null;

    this.sessions.set(config.liveSessionId, {
      config,
      snapshot,
      presence: {
        assessorConnected: true,
        studentConnected: false,
      },
      status: input.status || "running",
      completedAt: null,
      updatedAt: Date.now(),
      lastSeenAt: {
        assessor: Date.now(),
        student: null,
      },
    });
    this.accessCodeToSessionId.set(accessCode, config.liveSessionId);

    return config;
  }

  getSessionById(liveSessionId: string): LiveSimulationSessionState | null {
    const session = this.sessions.get(liveSessionId);
    if (!session) {
      return null;
    }

    return this.toSessionState(session);
  }

  getSessionByAccessCode(accessCode: string): LiveSimulationSessionState | null {
    const normalizedCode = normalizeAccessCode(accessCode);
    const liveSessionId = this.accessCodeToSessionId.get(normalizedCode);
    if (!liveSessionId) {
      return null;
    }

    return this.getSessionById(liveSessionId);
  }

  listSessions(): LiveSimulationMonitorSummary[] {
    return Array.from(this.sessions.values())
      .map((session) => this.toMonitorSummary(session))
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  touchPresence(liveSessionId: string, role: SocketRole): LiveSimulationSessionState | null {
    const session = this.sessions.get(liveSessionId);
    if (!session) {
      return null;
    }

    const previousPresence = { ...session.presence };
    const now = Date.now();
    session.lastSeenAt = {
      ...session.lastSeenAt,
      assessor: role === "assessor" ? now : session.lastSeenAt.assessor,
      student: role === "student" ? now : session.lastSeenAt.student,
    };
    session.updatedAt = now;
    this.refreshPresence(session);

    if (
      previousPresence.assessorConnected !== session.presence.assessorConnected ||
      previousPresence.studentConnected !== session.presence.studentConnected
    ) {
      this.broadcast(liveSessionId, { type: "presence", payload: session.presence });
    }

    return this.toSessionState(session);
  }

  syncStudentState(
    liveSessionId: string,
    accessCode: string,
    input: {
      snapshot?: LiveSimulationSnapshot | null;
      status?: LiveSimulationStatus;
    },
  ): LiveSimulationSessionState | null {
    const session = this.sessions.get(liveSessionId);
    const normalizedCode = normalizeAccessCode(accessCode);
    if (!session || session.config.accessCode !== normalizedCode) {
      return null;
    }

    const presenceChanged = !session.presence.studentConnected;
    session.presence = {
      ...session.presence,
      studentConnected: true,
    };
    session.lastSeenAt.student = Date.now();

    if (input.snapshot !== undefined) {
      session.snapshot = input.snapshot;
      this.broadcast(liveSessionId, { type: "snapshot", payload: session.snapshot });
    }

    if (input.status) {
      this.setStatus(session, input.status);
      this.broadcast(liveSessionId, { type: "status", payload: session.status });
    } else if (input.snapshot?.state && session.status === "waiting") {
      this.setStatus(session, "running");
      this.broadcast(liveSessionId, { type: "status", payload: session.status });
    }

    session.updatedAt = Date.now();
    if (presenceChanged) {
      this.broadcast(liveSessionId, { type: "presence", payload: session.presence });
    }

    return this.toSessionState(session);
  }

  closeSession(liveSessionId: string) {
    const session = this.sessions.get(liveSessionId);
    if (!session) {
      return false;
    }

    this.broadcast(liveSessionId, { type: "reset" });
    this.sessions.delete(liveSessionId);
    this.accessCodeToSessionId.delete(session.config.accessCode);

    for (const [socket, context] of Array.from(this.sockets.entries())) {
      if (context.liveSessionId !== liveSessionId) {
        continue;
      }

      safeSend(socket, { type: "reset" });
      socket.close();
      this.sockets.delete(socket);
    }

    return true;
  }

  attach(server: Server) {
    if (this.serverAttached) {
      return;
    }

    this.serverAttached = true;
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const targetUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      if (targetUrl.pathname !== "/ws/live") {
        return;
      }

      const liveSessionId = targetUrl.searchParams.get("liveSessionId") || "";
      const roleParam = targetUrl.searchParams.get("role");
      const role = roleParam === "student" ? "student" : roleParam === "assessor" ? "assessor" : null;
      if (!liveSessionId || !role || !this.sessions.has(liveSessionId)) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });

    wss.on("connection", (socket, request) => {
      const context = this.resolveSocketContext(request);
      if (!context) {
        socket.close();
        return;
      }

      this.sockets.set(socket, context);
      this.setPresence(context.liveSessionId, context.role, true);

      const session = this.sessions.get(context.liveSessionId);
      if (!session) {
        safeSend(socket, { type: "error", payload: { message: "Live session not found" } });
        socket.close();
        return;
      }

      safeSend(socket, {
        type: "hello",
        payload: {
          config: session.config,
          snapshot: session.snapshot,
          presence: session.presence,
          status: session.status,
        },
      });

      socket.on("message", (raw) => {
        this.handleSocketMessage(socket, raw.toString());
      });

      socket.on("close", () => {
        const known = this.sockets.get(socket);
        if (!known) {
          return;
        }

        this.sockets.delete(socket);
        this.setPresence(known.liveSessionId, known.role, false);
      });
    });

    setInterval(() => {
      const now = Date.now();
      for (const [liveSessionId, session] of Array.from(this.sessions.entries())) {
        const isStale = now - session.updatedAt > 1000 * 60 * 60 * 12;
        if (isStale) {
          this.closeSession(liveSessionId);
        }
      }
    }, 1000 * 60 * 10).unref();
  }

  private handleSocketMessage(socket: WebSocket, raw: string) {
    const context = this.sockets.get(socket);
    if (!context) {
      return;
    }

    const session = this.sessions.get(context.liveSessionId);
    if (!session) {
      safeSend(socket, { type: "error", payload: { message: "Live session not found" } });
      return;
    }

    let message: LiveSimulationSocketMessage | null = null;
    try {
      message = JSON.parse(raw) as LiveSimulationSocketMessage;
    } catch {
      safeSend(socket, { type: "error", payload: { message: "Malformed realtime payload" } });
      return;
    }

    switch (message.type) {
      case "snapshot":
        if (context.role !== "student") {
          return;
        }
        session.snapshot = message.payload;
        if (Boolean((message.payload?.state as Record<string, any> | undefined)?.isCompleted)) {
          this.setStatus(session, "completed");
        } else if (message.payload?.state && session.status === "waiting") {
          this.setStatus(session, "running");
        }
        session.updatedAt = Date.now();
        this.broadcast(context.liveSessionId, { type: "snapshot", payload: session.snapshot });
        if (session.status !== "waiting") {
          this.broadcast(context.liveSessionId, { type: "status", payload: session.status });
        }
        return;

      case "reset":
        if (session.status === "completed") {
          return;
        }
        session.snapshot = null;
        this.setStatus(session, "waiting");
        session.updatedAt = Date.now();
        this.broadcast(context.liveSessionId, { type: "reset" });
        this.broadcast(context.liveSessionId, { type: "status", payload: session.status });
        return;

      case "status":
        this.setStatus(session, message.payload);
        session.updatedAt = Date.now();
        this.broadcast(context.liveSessionId, { type: "status", payload: session.status });
        return;

      default:
        return;
    }
  }

  private resolveSocketContext(request: IncomingMessage): SocketContext | null {
    const targetUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const liveSessionId = targetUrl.searchParams.get("liveSessionId") || "";
    const roleParam = targetUrl.searchParams.get("role");
    const role = roleParam === "student" ? "student" : roleParam === "assessor" ? "assessor" : null;
    if (!liveSessionId || !role || !this.sessions.has(liveSessionId)) {
      return null;
    }

    return { liveSessionId, role };
  }

  private setPresence(liveSessionId: string, role: SocketRole, value: boolean) {
    const session = this.sessions.get(liveSessionId);
    if (!session) {
      return;
    }

    session.presence = {
      ...session.presence,
      assessorConnected: role === "assessor" ? value : session.presence.assessorConnected,
      studentConnected: role === "student" ? value : session.presence.studentConnected,
    };
    session.lastSeenAt = {
      ...session.lastSeenAt,
      assessor: role === "assessor" ? (value ? Date.now() : null) : session.lastSeenAt.assessor,
      student: role === "student" ? (value ? Date.now() : null) : session.lastSeenAt.student,
    };
    session.updatedAt = Date.now();
    this.broadcast(liveSessionId, { type: "presence", payload: session.presence });
  }

  private setStatus(session: LiveSessionRecord, status: LiveSimulationStatus) {
    if (session.status === "completed" && status !== "completed") {
      return;
    }

    session.status = status;
    if (status === "completed" && session.completedAt == null) {
      session.completedAt = Date.now();
    }
  }

  private refreshPresence(session: LiveSessionRecord) {
    const now = Date.now();
    const assessorConnected = session.lastSeenAt.assessor != null && now - session.lastSeenAt.assessor < 5000;
    const studentConnected = session.lastSeenAt.student != null && now - session.lastSeenAt.student < 5000;
    session.presence = {
      assessorConnected,
      studentConnected,
    };
  }

  private toSessionState(session: LiveSessionRecord): LiveSimulationSessionState {
    this.refreshPresence(session);
    return {
      config: session.config,
      snapshot: session.snapshot,
      presence: session.presence,
      status: session.status,
    };
  }

  private toMonitorSummary(session: LiveSessionRecord): LiveSimulationMonitorSummary {
    this.refreshPresence(session);
    const snapshotState = (session.snapshot?.state || null) as Record<string, any> | null;
    const runtimeSessionId = Number.isFinite(Number(snapshotState?.sessionId)) ? Number(snapshotState?.sessionId) : null;
    const elapsedSeconds = Number(snapshotState?.elapsedSeconds || 0);
    const timeRemaining = Number(snapshotState?.timeRemaining || 0);
    const timeLimitMinutes = Number(session.config.timeLimit || 0);
    const totalDurationSeconds = Math.max(timeLimitMinutes * 60, elapsedSeconds + timeRemaining, 1);
    const startedAt = snapshotState?.isRunning || snapshotState?.isCompleted || elapsedSeconds > 0
      ? session.config.createdAt
      : null;
    const endedAt = session.completedAt || (snapshotState?.isCompleted ? session.updatedAt : null);
    const decisions = Array.isArray(snapshotState?.decisions) ? snapshotState!.decisions as Array<Record<string, any>> : [];
    const scoreSum = decisions.reduce((sum, decision) => sum + Number(decision?.score || 0), 0);
    const currentAverageScore = decisions.length > 0 ? Math.round((scoreSum / decisions.length) * 10) / 10 : 0;

    return {
      liveSessionId: session.config.liveSessionId,
      runtimeSessionId,
      accessCode: session.config.accessCode,
      participantName: session.config.participantName,
      participantRole: session.config.participantRole || "",
      assessorName: session.config.assessorName,
      createdAt: session.config.createdAt,
      status: session.status,
      presence: session.presence,
      startedAt,
      endedAt,
      elapsedSeconds,
      timeLimitMinutes,
      progressPercent: clampNumber(Math.round((elapsedSeconds / totalDurationSeconds) * 100), 0, 100),
      decisionsCount: decisions.length,
      currentAverageScore,
      isPaused: Boolean(snapshotState?.isPaused),
      difficulty: session.config.difficulty,
    };
  }

  private broadcast(liveSessionId: string, message: LiveSimulationSocketMessage) {
    for (const [socket, context] of Array.from(this.sockets.entries())) {
      if (context.liveSessionId !== liveSessionId) {
        continue;
      }

      safeSend(socket, message);
    }
  }
}

export const liveSessionService = new LiveSessionService();

export function normalizeLiveAccessCode(value: string) {
  return normalizeAccessCode(value);
}
