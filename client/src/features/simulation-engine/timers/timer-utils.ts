import type { TimerSnapshot } from "@shared/simulation-content";

export function getSimulationTickStep(speedMultiplier: number) {
  return Math.max(1, Math.round(speedMultiplier || 1));
}

export function getNotificationIntervalSeconds(channel: "email" | "messenger", reminderIntervalSeconds?: number | null) {
  if (reminderIntervalSeconds != null && reminderIntervalSeconds > 0) {
    return Math.max(5, Math.round(reminderIntervalSeconds));
  }
  return channel === "email" ? 240 : 90;
}

export function getTimerPenalty(timer: TimerSnapshot | null) {
  if (!timer?.wasOverdue) return 0;
  return Math.min(2, Math.max(1, Math.ceil(timer.overdueSeconds / 120)));
}
