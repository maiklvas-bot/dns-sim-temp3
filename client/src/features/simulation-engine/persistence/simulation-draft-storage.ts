import type { LiveSimulationRole } from "@/lib/live-session";
import { getSimulationSessionToken } from "@/lib/simulation-session-access";

const RUNTIME_DRAFT_KEY = "rrs.runtime-draft";

export interface PersistedSimulationDraft<TState> {
  version: 1;
  updatedAt: number;
  liveRole: LiveSimulationRole;
  liveSessionId: string | null;
  state: TState;
  persistedAnswerCount: number;
  persistedMetricCount: number;
  completedSessionKey: string | null;
}

interface PersistableState {
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  sessionId: number | null;
  decisions: unknown[];
}

export function shouldPersistSimulationState(state: PersistableState) {
  return state.isRunning || state.isPaused || state.isCompleted || state.sessionId != null || state.decisions.length > 0;
}

export function clearPersistedSimulationState() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(RUNTIME_DRAFT_KEY);
}

export function persistSimulationState<TState>(
  state: TState,
  liveRole: LiveSimulationRole,
  liveSessionId: string | null,
  syncMeta: {
    persistedAnswerCount: number;
    persistedMetricCount: number;
    completedSessionKey: string | null;
  },
) {
  if (typeof window === "undefined") return;

  const payload: PersistedSimulationDraft<TState> = {
    version: 1,
    updatedAt: Date.now(),
    liveRole,
    liveSessionId,
    state,
    ...syncMeta,
  };
  window.sessionStorage.setItem(RUNTIME_DRAFT_KEY, JSON.stringify(payload));
}

export function readPersistedSimulationDraft<TState>(
  liveRole: LiveSimulationRole,
  liveSessionId: string | null,
): PersistedSimulationDraft<TState> | null {
  if (typeof window === "undefined" || liveRole === "assessor-monitor") return null;

  const raw = window.sessionStorage.getItem(RUNTIME_DRAFT_KEY);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as PersistedSimulationDraft<TState>;
    if (payload.version !== 1 || payload.liveRole !== liveRole) return null;
    if ((payload.liveSessionId || null) !== (liveSessionId || null)) return null;
    const sessionId = (payload.state as { sessionId?: number | null })?.sessionId;
    if (sessionId != null && !getSimulationSessionToken(sessionId)) {
      clearPersistedSimulationState();
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
