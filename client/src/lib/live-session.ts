import type { SimulationState } from "@/context/SimulationContext";
import { API_BASE, apiRequest } from "@/lib/queryClient";
import type {
  LiveSimulationConfig,
  LiveSimulationPresence,
  LiveSimulationSessionState,
  LiveSimulationSnapshot,
  LiveSimulationSocketMessage,
  LiveSimulationStatus,
} from "@shared/live-session";

export type LiveSimulationRole = "standalone" | "student" | "assessor-setup" | "assessor-monitor";

const ROLE_KEY = "rrs.live.role";
const CONFIG_KEY = "rrs.live.config";
const JOIN_STATE_KEY = "rrs.live.join-state";
export const LIVE_SIMULATION_STATE_EVENT = "rrs.live.state-change";

export interface LiveSimulationSocketHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (message: string) => void;
  onHello?: (payload: LiveSimulationSessionState<SimulationState>) => void;
  onSnapshot?: (payload: LiveSimulationSnapshot<SimulationState> | null) => void;
  onPresence?: (payload: LiveSimulationPresence) => void;
  onStatus?: (payload: LiveSimulationStatus) => void;
  onReset?: () => void;
}

export interface LiveSimulationSocketController {
  close: () => void;
  sendSnapshot: (snapshot: LiveSimulationSnapshot<SimulationState> | null) => void;
  sendStatus: (status: LiveSimulationStatus) => void;
  sendReset: () => void;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function emitLiveSimulationStateChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(LIVE_SIMULATION_STATE_EVENT));
}

function getSocketBaseUrl() {
  if (typeof window === "undefined") {
    return new URL("ws://localhost/ws/live");
  }

  const baseOrigin = API_BASE || window.location.origin;
  const url = new URL(baseOrigin, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/live";
  url.search = "";
  return url;
}

export function getLiveSimulationRole(): LiveSimulationRole {
  if (typeof window === "undefined") {
    return "standalone";
  }

  const value = window.sessionStorage.getItem(ROLE_KEY) as LiveSimulationRole | null;
  return value || "standalone";
}

export function setLiveSimulationRole(role: LiveSimulationRole) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(ROLE_KEY, role);
  emitLiveSimulationStateChange();
}

export function clearLiveSimulationRole() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ROLE_KEY);
  emitLiveSimulationStateChange();
}

export function getLiveSimulationConfig(): LiveSimulationConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  const sessionConfig = safeParse<LiveSimulationConfig>(window.sessionStorage.getItem(CONFIG_KEY));
  if (sessionConfig) {
    return sessionConfig;
  }

  const legacyConfig = safeParse<LiveSimulationConfig>(window.localStorage.getItem(CONFIG_KEY));
  if (legacyConfig) {
    window.sessionStorage.setItem(CONFIG_KEY, JSON.stringify(legacyConfig));
    window.localStorage.removeItem(CONFIG_KEY);
    return legacyConfig;
  }

  return null;
}

export function setLiveSimulationConfig(config: LiveSimulationConfig | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!config) {
    window.sessionStorage.removeItem(CONFIG_KEY);
    window.localStorage.removeItem(CONFIG_KEY);
    emitLiveSimulationStateChange();
    return;
  }

  window.sessionStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  window.localStorage.removeItem(CONFIG_KEY);
  emitLiveSimulationStateChange();
}

export function resetLiveSimulation() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(CONFIG_KEY);
  window.localStorage.removeItem(CONFIG_KEY);
  window.sessionStorage.removeItem(JOIN_STATE_KEY);
  emitLiveSimulationStateChange();
}

export function setPendingLiveSimulationState<TState = unknown>(session: LiveSimulationSessionState<TState>) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(JOIN_STATE_KEY, JSON.stringify(session));
}

export function consumePendingLiveSimulationState<TState = unknown>(liveSessionId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const session = safeParse<LiveSimulationSessionState<TState>>(window.sessionStorage.getItem(JOIN_STATE_KEY));
  if (!session || session.config.liveSessionId !== liveSessionId) {
    return null;
  }

  window.sessionStorage.removeItem(JOIN_STATE_KEY);
  return session;
}

export async function createRemoteLiveSimulation(
  input: Omit<LiveSimulationConfig, "liveSessionId" | "accessCode" | "createdAt">,
) {
  const response = await apiRequest("POST", "/api/live-sessions", input);
  const config = (await response.json()) as LiveSimulationConfig;
  setLiveSimulationConfig(config);
  return config;
}

export async function joinRemoteLiveSimulation(accessCode: string) {
  const response = await apiRequest("POST", "/api/live-sessions/join", { accessCode });
  const session = (await response.json()) as LiveSimulationSessionState<SimulationState>;
  setLiveSimulationConfig(session.config);
  return session;
}

export async function syncRemoteStudentState(
  liveSessionId: string,
  accessCode: string,
  payload: {
    snapshot: LiveSimulationSnapshot<SimulationState>;
    status: LiveSimulationStatus;
  },
) {
  const response = await apiRequest("POST", `/api/live-sessions/${liveSessionId}/student-sync`, {
    accessCode,
    snapshot: payload.snapshot,
    status: payload.status,
  });

  return (await response.json()) as LiveSimulationSessionState<SimulationState>;
}

export async function fetchRemoteLiveSimulation(liveSessionId: string, accessCode?: string | null) {
  const search = accessCode ? `?accessCode=${encodeURIComponent(accessCode)}` : "";
  const response = await apiRequest("GET", `/api/live-sessions/${liveSessionId}${search}`);
  return (await response.json()) as LiveSimulationSessionState<SimulationState>;
}

export async function closeRemoteLiveSimulation(liveSessionId: string) {
  await apiRequest("DELETE", `/api/live-sessions/${liveSessionId}`);
  const currentConfig = getLiveSimulationConfig();
  if (currentConfig?.liveSessionId === liveSessionId) {
    setLiveSimulationConfig(null);
  }
}

export function connectToLiveSimulationSession(
  liveSessionId: string,
  role: "student" | "assessor",
  handlers: LiveSimulationSocketHandlers,
  accessCode?: string,
): LiveSimulationSocketController {
  const socketUrl = getSocketBaseUrl();
  socketUrl.searchParams.set("liveSessionId", liveSessionId);
  socketUrl.searchParams.set("role", role);
  if (role === "student" && accessCode) {
    socketUrl.searchParams.set("accessCode", accessCode);
  }
  const socket = new WebSocket(socketUrl);

  socket.addEventListener("open", () => {
    handlers.onOpen?.();
  });

  socket.addEventListener("close", () => {
    handlers.onClose?.();
  });

  socket.addEventListener("error", () => {
    handlers.onError?.("Не удалось подключиться к live-сессии");
  });

  socket.addEventListener("message", (event) => {
    let message: LiveSimulationSocketMessage<SimulationState> | null = null;
    try {
      message = JSON.parse(String(event.data)) as LiveSimulationSocketMessage<SimulationState>;
    } catch {
      handlers.onError?.("Получено повреждённое realtime-сообщение");
      return;
    }

    switch (message.type) {
      case "hello":
        handlers.onHello?.(message.payload);
        return;
      case "snapshot":
        handlers.onSnapshot?.(message.payload);
        return;
      case "presence":
        handlers.onPresence?.(message.payload);
        return;
      case "status":
        handlers.onStatus?.(message.payload);
        return;
      case "reset":
        handlers.onReset?.();
        return;
      case "error":
        handlers.onError?.(message.payload.message);
        return;
      default:
        return;
    }
  });

  const send = (message: LiveSimulationSocketMessage<SimulationState>) => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(message));
  };

  return {
    close: () => socket.close(),
    sendSnapshot: (snapshot) => send({ type: "snapshot", payload: snapshot }),
    sendStatus: (status) => send({ type: "status", payload: status }),
    sendReset: () => send({ type: "reset" }),
  };
}
