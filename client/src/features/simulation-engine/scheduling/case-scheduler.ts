import type { SimulationRuntimeSettings } from "@shared/simulation-content";
import { getSimulationSettingsSnapshot } from "@/lib/runtime-content";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function midpointBetween(min: number, max: number) {
  return Math.round((Math.min(min, max) + Math.max(min, max)) / 2);
}

export function shuffleOptions<T extends { level: number }>(options: T[]): T[] {
  const result = [...options];
  for (let index = result.length - 1; index > 0; index--) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[targetIndex]] = [result[targetIndex], result[index]];
  }
  return result;
}

export function getNextSignalIntervalSeconds(_speedMultiplier: number): number {
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const rawMinSeconds = Number(settings?.signalIntervalMinSeconds ?? 120);
  const rawMaxSeconds = Number(settings?.signalIntervalMaxSeconds ?? 180);
  return Math.max(30, midpointBetween(rawMinSeconds, rawMaxSeconds));
}

export function getMainSignalEndBufferSeconds(totalDurationSeconds: number) {
  return clamp(Math.round(totalDurationSeconds * 0.08), 120, 240);
}

export function getFirstMainCaseDelaySeconds(totalDurationSeconds: number) {
  return clamp(Math.round(totalDurationSeconds * 0.05), 90, 150);
}

export function getEvenMainSignalIntervalSeconds(totalDurationSeconds: number, elapsedSeconds: number, remainingSignalCount: number) {
  const endBufferSeconds = getMainSignalEndBufferSeconds(totalDurationSeconds);
  const remainingWindowSeconds = Math.max(60, totalDurationSeconds - elapsedSeconds - endBufferSeconds);
  return Math.max(45, Math.round(remainingWindowSeconds / Math.max(1, remainingSignalCount + 1)));
}

export function getFirstSignalDelaySeconds(_speedMultiplier: number, totalDurationSeconds: number, signalCount: number): number {
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const rawMinSeconds = Number(settings?.firstSignalMinSeconds ?? 15);
  const rawMaxSeconds = Number(settings?.firstSignalMaxSeconds ?? 30);
  const configuredDelaySeconds = Math.max(20, midpointBetween(rawMinSeconds, rawMaxSeconds));
  const evenIntervalSeconds = getEvenMainSignalIntervalSeconds(totalDurationSeconds, 0, signalCount);
  return clamp(Math.min(Math.max(configuredDelaySeconds, 45), evenIntervalSeconds), 20, 120);
}

export function getCaseScheduledDelaySeconds(
  _speedMultiplier: number,
  totalDurationSeconds: number,
  elapsedSeconds: number,
  remainingSignalCount: number,
  timing?: { minIntervalSeconds?: number | null; maxIntervalSeconds?: number | null } | null,
) {
  const evenIntervalSeconds = getEvenMainSignalIntervalSeconds(totalDurationSeconds, elapsedSeconds, remainingSignalCount);
  if (timing?.minIntervalSeconds != null && timing?.maxIntervalSeconds != null) {
    const configuredSeconds = midpointBetween(timing.minIntervalSeconds, timing.maxIntervalSeconds);
    return clamp(configuredSeconds, Math.max(30, Math.round(evenIntervalSeconds * 0.75)), Math.max(60, Math.round(evenIntervalSeconds * 1.25)));
  }
  return evenIntervalSeconds;
}
