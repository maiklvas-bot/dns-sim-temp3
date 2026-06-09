import type { CaseOption } from "@/data/cases";
import type { ActiveSignal, SimulationState } from "./SimulationProvider";

export type SimulationAction =
  | { type: "SET_CONFIG"; payload: Partial<SimulationState> }
  | { type: "BOOTSTRAP_SIMULATION"; payload: Partial<SimulationState> }
  | { type: "RESTORE_STATE"; payload: SimulationState }
  | { type: "SET_SESSION_ID"; payload: number | null }
  | { type: "START_SIMULATION" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "TICK"; payload?: { stepSeconds?: number } }
  | { type: "FIRE_SIGNAL" }
  | { type: "SELECT_SIGNAL"; payload: string }
  | { type: "SNOOZE_SIGNAL"; payload: string }
  | { type: "SELECT_OPTION"; payload: { option: CaseOption; signal: ActiveSignal } }
  | { type: "DISMISS_CONSEQUENCE" }
  | { type: "DISMISS_TOAST"; payload: string }
  | { type: "CLEAR_ACTION_PANEL" }
  | { type: "EXPIRE_SIGNAL"; payload: string }
  | { type: "TOGGLE_JOURNAL" }
  | { type: "COMPLETE_SIMULATION" }
  | { type: "RESET" }
  | { type: "OPEN_EMAIL"; payload: string }
  | { type: "ANSWER_EMAIL"; payload: { emailId: string; option: any } }
  | { type: "OPEN_MESSENGER"; payload: string }
  | { type: "ANSWER_MESSENGER"; payload: { msgId: string; option: any } }
  | { type: "OPEN_VIDEO"; payload: string }
  | { type: "ANSWER_VIDEO"; payload: { videoId: string; option: any } }
  | { type: "TICK_CHANNELS" };
