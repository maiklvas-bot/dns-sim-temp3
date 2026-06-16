import type { CompetencyDefinition, SimCase } from "@shared/simulation-content";

export const CASE_SIGNAL_TYPE_OPTIONS = [
  { value: "call", label: "Звонок" },
  { value: "message", label: "Сообщение" },
  { value: "zone_signal", label: "Сигнал зоны" },
  { value: "email", label: "Почта" },
  { value: "visitor", label: "Посетитель" },
] as const;

export const STORE_ZONE_OPTIONS = [
  { value: "торговый_зал", label: "Торговый зал" },
  { value: "склад", label: "Склад" },
  { value: "выдача", label: "Выдача" },
  { value: "начальство", label: "Начальство" },
] as const;

export const STORE_EFFECT_FIELDS = [
  { key: "queue", label: "Торг. зал / поток", zone: "Торг. зал", metric: "Покупатели в зале", helper: "Положительное значение усиливает поток покупателей, отрицательное снижает управляемость зала." },
  { key: "conversion", label: "Торг. зал / конверсия", zone: "Торг. зал", metric: "Конверсия", helper: "Положительное значение повышает долю покупок, отрицательное показывает потерю продаж." },
  { key: "morale", label: "Команда / мораль", zone: "Команда", metric: "Настроение команды", helper: "Положительное значение поддерживает смену, отрицательное усиливает напряжение." },
  { key: "revenue_impact", label: "Финансы / выручка", zone: "Финансы", metric: "Выручка за день", helper: "Положительное значение добавляет продажи, отрицательное фиксирует упущенную выручку." },
  { key: "delivery_status", label: "Выдача / скорость", zone: "Выдача", metric: "Скорость выдачи", helper: "Положительное значение ускоряет выдачу, отрицательное увеличивает ожидание." },
] as const;

export function buildCompetencyAliasMap(competencies: CompetencyDefinition[]) {
  const aliases = new Map<string, string>();
  competencies.forEach((competency) => {
    aliases.set(competency.id.trim().toLowerCase(), competency.id);
    aliases.set(competency.name.trim().toLowerCase(), competency.id);
  });
  return aliases;
}

export function buildCompetencyNameMap(competencies: CompetencyDefinition[]) {
  return new Map(competencies.map((competency) => [competency.id, competency.name]));
}

export function buildOptionCompetencyProfile(options: Array<{ competency_scores?: Record<string, number> | null }> | null | undefined) {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};
  (options || []).forEach((option) => {
    Object.entries(option.competency_scores || {}).forEach(([competencyId, score]) => {
      totals[competencyId] = (totals[competencyId] || 0) + Number(score || 0);
      counts[competencyId] = (counts[competencyId] || 0) + 1;
    });
  });
  return Object.fromEntries(Object.entries(totals).map(([competencyId, total]) => [
    competencyId,
    Math.round((total / Math.max(1, counts[competencyId] || 1)) * 10) / 10,
  ]));
}

export function createEmptyCase(order: number): SimCase {
  const id = `CASE-${String(order).padStart(2, "0")}`;
  return {
    id,
    title: "",
    description: "",
    primaryCompetencies: [],
    secondaryCompetencies: [],
    trigger: { type: "message", source: "", text: "" },
    zones_affected: [],
    cycles: [{
      id: `${id}__cycle_1`,
      cycle: 1,
      title: "Цикл 1",
      description: "",
      source: "",
      situation: "",
      signal: { type: "message", content: "" },
      zonesAffected: [],
      timing: { decisionDeadlineSeconds: 180, reminderIntervalSeconds: 180 },
      status: "draft",
      isFinal: false,
      priority: "normal",
      criticality: "normal",
      options: [],
      imageAssetId: null,
      imageUrl: null,
      audioAssetId: null,
      audioUrl: null,
    }],
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: { minIntervalSeconds: null, maxIntervalSeconds: null, decisionDeadlineSeconds: 180, reminderIntervalSeconds: 180 },
    sortOrder: order,
    isActive: true,
  };
}

export function createEmptyStructuredOption(level: number) {
  return {
    id: "",
    level,
    text: "",
    score: 1,
    comment: "",
    nextCycleId: "",
    nextDelaySeconds: null,
    nextChannel: "main_case",
    status: "active",
    effects: { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 },
    competency_scores: {},
  };
}

export function formatCompetencyScores(value: Record<string, number> | undefined, competencies: CompetencyDefinition[]) {
  const names = buildCompetencyNameMap(competencies);
  return Object.entries(value || {}).map(([key, score]) => `${names.get(key) || key}:${score}`).join(", ");
}

export function parseCompetencyScores(value: string, competencies: CompetencyDefinition[]) {
  const aliases = buildCompetencyAliasMap(competencies);
  return value.split(",").map((item) => item.trim()).filter(Boolean).reduce<Record<string, number>>((acc, item) => {
    const [rawKey, rawScore] = item.split(":").map((part) => part.trim());
    const key = aliases.get((rawKey || "").toLowerCase()) || rawKey;
    if (!key) return acc;
    const score = Number(rawScore);
    acc[key] = Number.isFinite(score) ? score : 0;
    return acc;
  }, {});
}

export function getPreviewAudioUrl(entityId: string, mode: "case" | "email" | "messenger" | "video") {
  const match = String(entityId || "").match(/(\d+)/);
  if (!match) return null;
  const suffix = match[1].padStart(2, "0");
  if (mode === "case") return `/library/audio_case_${suffix}.mp3`;
  if (mode === "video") return `/library/audio_video_${suffix}.mp3`;
  return null;
}
