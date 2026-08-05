import type { SimulationSettingsSnapshot } from "./simulation-content";

export interface LiveSimulationMetrics {
  customersInStore: number;
  avgCheck: number;
  conversion: number;
  nps: number;
  pickupSpeed: number;
  warehouseLoad: number;
  teamMorale: number;
  dailyRevenue: number;
}

export interface LiveSimulationConfig extends SimulationSettingsSnapshot {
  liveSessionId: string;
  accessCode: string;
  assessorName: string;
  participantName: string;
  participantRole?: string;
  /** участник вводит сам при входе по коду (не оценщик) — для обратной связи и дальнейшей коммуникации */
  participantEmail?: string;
  initialMetrics: LiveSimulationMetrics;
  createdAt: number;
}

export interface LiveSimulationMonitorSummary {
  liveSessionId: string;
  runtimeSessionId: number | null;
  accessCode: string;
  participantName: string;
  participantRole?: string;
  participantEmail?: string;
  assessorName: string;
  createdAt: number;
  status: LiveSimulationStatus;
  presence: LiveSimulationPresence;
  startedAt: number | null;
  endedAt: number | null;
  elapsedSeconds: number;
  timeLimitMinutes: number;
  progressPercent: number;
  decisionsCount: number;
  currentAverageScore: number;
  isPaused: boolean;
  difficulty: SimulationSettingsSnapshot["difficulty"];
}

export interface LiveSimulationSnapshot<TState = unknown> {
  liveSessionId: string;
  updatedAt: number;
  state: TState;
}

export interface LiveSimulationPresence {
  assessorConnected: boolean;
  studentConnected: boolean;
}

export type LiveSimulationStatus = "waiting" | "running" | "completed";

export interface LiveSimulationSessionState<TState = unknown> {
  config: LiveSimulationConfig;
  snapshot: LiveSimulationSnapshot<TState> | null;
  presence: LiveSimulationPresence;
  status: LiveSimulationStatus;
}

export type LiveSimulationSocketMessage<TState = unknown> =
  | {
      type: "hello";
      payload: LiveSimulationSessionState<TState>;
    }
  | {
      type: "snapshot";
      payload: LiveSimulationSnapshot<TState> | null;
    }
  | {
      type: "presence";
      payload: LiveSimulationPresence;
    }
  | {
      type: "status";
      payload: LiveSimulationStatus;
    }
  | {
      type: "reset";
    }
  | {
      type: "error";
      payload: { message: string };
    };
