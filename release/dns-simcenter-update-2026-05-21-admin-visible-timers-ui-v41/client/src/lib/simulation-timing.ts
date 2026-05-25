export const SIM_START_MINUTES = 9 * 60;
export const SIM_END_MINUTES = 21 * 60;
export const SIM_DAY_SPAN_MINUTES = SIM_END_MINUTES - SIM_START_MINUTES;

export interface ScenarioDeadline {
  label: string;
  sourceText: string;
  totalSeconds: number;
  dueAtElapsed: number;
}

const RUSSIAN_NUMBER_WORDS: Record<string, number> = {
  один: 1,
  одна: 1,
  две: 2,
  два: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  двадцать: 20,
  "двадцать пять": 25,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  девяносто: 90,
  полчаса: 30,
  час: 60,
  часа: 60,
  часов: 60,
  "полтора часа": 90,
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[«»"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumber(fragment: string): number | null {
  const numeric = fragment.match(/\d+/);
  if (numeric) {
    return Number(numeric[0]);
  }

  const normalized = normalizeText(fragment);
  const exact = RUSSIAN_NUMBER_WORDS[normalized];
  if (exact != null) {
    return exact;
  }

  const match = Object.entries(RUSSIAN_NUMBER_WORDS).find(([key]) => normalized.includes(key));
  return match ? match[1] : null;
}

export function formatSimClock(totalMinutes: number): string {
  const bounded = Math.max(SIM_START_MINUTES, Math.min(SIM_END_MINUTES, totalMinutes));
  const hours = Math.floor(bounded / 60);
  const minutes = bounded % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function getSimTimeFromElapsed(elapsedSeconds: number, totalSessionSeconds: number): string {
  if (totalSessionSeconds <= 0) {
    return formatSimClock(SIM_START_MINUTES);
  }

  const ratio = Math.max(0, Math.min(1, elapsedSeconds / totalSessionSeconds));
  const simMinutes = Math.round(SIM_START_MINUTES + ratio * SIM_DAY_SPAN_MINUTES);
  return formatSimClock(simMinutes);
}

export function simTimeToMinutes(simTime: string): number {
  const [hours = "09", minutes = "00"] = simTime.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function simMinutesToRealSeconds(simMinutes: number, timeLimitMinutes: number): number {
  const sessionSeconds = Math.max(60, timeLimitMinutes * 60);
  return Math.max(10, Math.round((simMinutes / SIM_DAY_SPAN_MINUTES) * sessionSeconds));
}

export function buildConfiguredDeadline(
  totalSeconds: number | null | undefined,
  elapsedSeconds: number,
): ScenarioDeadline | null {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null;
  }

  const roundedSeconds = Math.max(5, Math.round(totalSeconds));
  const label = roundedSeconds >= 60
    ? `Срок: ${Math.round(roundedSeconds / 60)} мин`
    : `Срок: ${roundedSeconds} сек`;

  return {
    label,
    sourceText: "Настройка таймера из админ-панели",
    totalSeconds: roundedSeconds,
    dueAtElapsed: elapsedSeconds + roundedSeconds,
  };
}

function buildRelativeDeadline(
  label: string,
  simMinutes: number,
  sourceText: string,
  elapsedSeconds: number,
  timeLimitMinutes: number
): ScenarioDeadline {
  const totalSeconds = simMinutesToRealSeconds(simMinutes, timeLimitMinutes);
  return {
    label,
    sourceText,
    totalSeconds,
    dueAtElapsed: elapsedSeconds + totalSeconds,
  };
}

function buildAbsoluteDeadline(
  label: string,
  targetMinutes: number,
  currentSimMinutes: number,
  sourceText: string,
  elapsedSeconds: number,
  timeLimitMinutes: number
): ScenarioDeadline | null {
  const delta = targetMinutes - currentSimMinutes;
  if (delta <= 0) {
    return null;
  }

  return buildRelativeDeadline(label, delta, sourceText, elapsedSeconds, timeLimitMinutes);
}

export function extractScenarioDeadline(
  textParts: string[],
  simTime: string,
  elapsedSeconds: number,
  timeLimitMinutes: number
): ScenarioDeadline | null {
  const sourceText = textParts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (!sourceText) {
    return null;
  }

  const normalized = normalizeText(sourceText);
  const currentSimMinutes = simTimeToMinutes(simTime);

  const minutePatterns: Array<{ regex: RegExp; label: (value: number) => string }> = [
    { regex: /в течение ([а-яё0-9\s-]+?) минут/, label: (value) => `Срок: ${value} мин` },
    { regex: /через ([а-яё0-9\s-]+?) минут/, label: (value) => `Через ${value} мин` },
    { regex: /до [^.?!,;:]+? ([а-яё0-9\s-]+?) минут/, label: (value) => `Срок: ${value} мин` },
  ];

  for (const { regex, label } of minutePatterns) {
    const match = normalized.match(regex);
    if (!match) {
      continue;
    }

    const minutes = extractNumber(match[1]);
    if (minutes && minutes > 0) {
      return buildRelativeDeadline(label(minutes), minutes, sourceText, elapsedSeconds, timeLimitMinutes);
    }
  }

  if (normalized.includes("в течение часа") || normalized.includes("в ближайший час") || normalized.includes("через час")) {
    return buildRelativeDeadline("Срок: 1 час", 60, sourceText, elapsedSeconds, timeLimitMinutes);
  }

  if (normalized.includes("через полчаса")) {
    return buildRelativeDeadline("Через 30 мин", 30, sourceText, elapsedSeconds, timeLimitMinutes);
  }

  const hourMatch = normalized.match(/(?:в течение|через) ([а-яё0-9\s-]+?) час/);
  if (hourMatch) {
    const hours = extractNumber(hourMatch[1]);
    if (hours && hours > 0) {
      const simMinutes = hours * 60;
      return buildRelativeDeadline(`Срок: ${hours} ч`, simMinutes, sourceText, elapsedSeconds, timeLimitMinutes);
    }
  }

  const absoluteMatch = normalized.match(/(?:до|к)\s(\d{1,2}):(\d{2})/);
  if (absoluteMatch) {
    const hours = Number(absoluteMatch[1]);
    const minutes = Number(absoluteMatch[2]);
    const targetMinutes = hours * 60 + minutes;
    return buildAbsoluteDeadline(
      `До ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
      targetMinutes,
      currentSimMinutes,
      sourceText,
      elapsedSeconds,
      timeLimitMinutes
    );
  }

  if (
    normalized.includes("до конца дня") ||
    normalized.includes("до конца смены") ||
    normalized.includes("до закрытия магазина") ||
    normalized.includes("до закрытия")
  ) {
    return buildAbsoluteDeadline("До конца смены", SIM_END_MINUTES, currentSimMinutes, sourceText, elapsedSeconds, timeLimitMinutes);
  }

  return null;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const restSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${restSeconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${restSeconds.toString().padStart(2, "0")}`;
}

export function getDeadlineSnapshot(deadline: ScenarioDeadline | null | undefined, elapsedSeconds: number) {
  if (!deadline) {
    return null;
  }

  const remainingSeconds = deadline.dueAtElapsed - elapsedSeconds;
  return {
    isOverdue: remainingSeconds < 0,
    remainingSeconds: Math.abs(remainingSeconds),
    label: deadline.label,
  };
}
