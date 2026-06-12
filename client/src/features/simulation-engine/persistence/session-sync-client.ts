import { apiRequest } from "@/lib/queryClient";
import {
  buildSimulationAccessHeaders,
  setSimulationSessionCredential,
} from "@/lib/simulation-session-access";

interface CreatedSimulationSession {
  id: number;
  sessionToken: string;
  [key: string]: unknown;
}

function sessionRequest(
  method: string,
  sessionId: number,
  suffix = "",
  data?: unknown,
  options?: { keepalive?: boolean },
) {
  return apiRequest(method, `/api/sessions/${sessionId}${suffix}`, data, {
    headers: buildSimulationAccessHeaders(sessionId),
    keepalive: options?.keepalive,
  });
}

export async function createPersistedSession(payload: unknown): Promise<CreatedSimulationSession> {
  const response = await apiRequest("POST", "/api/sessions", payload);
  const session = await response.json() as CreatedSimulationSession;
  const sessionId = Number(session.id);

  if (!Number.isSafeInteger(sessionId) || typeof session.sessionToken !== "string" || !session.sessionToken) {
    throw new Error("Server returned an invalid simulation session credential");
  }

  setSimulationSessionCredential(sessionId, session.sessionToken);
  return { ...session, id: sessionId };
}

export async function getPersistedSession(sessionId: number) {
  const response = await sessionRequest("GET", sessionId);
  return response.json();
}

export function updatePersistedSession(
  sessionId: number,
  payload: unknown,
  options?: { keepalive?: boolean },
) {
  return sessionRequest("PATCH", sessionId, "", payload, options);
}

export function appendPersistedAnswer(sessionId: number, payload: unknown) {
  return sessionRequest("POST", sessionId, "/answers", payload);
}

export function appendPersistedMetrics(sessionId: number, payload: unknown) {
  return sessionRequest("POST", sessionId, "/metrics", payload);
}

export function savePersistedResult(sessionId: number, payload: unknown) {
  return sessionRequest("PUT", sessionId, "/result", payload);
}
