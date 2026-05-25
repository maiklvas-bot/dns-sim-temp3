import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { ChatInfo, CompetencyDefinition, EmailCase, MessengerCase, SimCase, SimulationRuntimeSettings, VideoCase } from "@shared/simulation-content";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getSignalSoundOptions,
  resolveChannelSoundSource,
  type NotificationChannelKey,
  type SignalSoundOption,
} from "@/data/audio-map";
import {
  DEFAULT_SIMULATION_BRIEFING_HTML,
  SIMULATION_BRIEFING_VIDEO_PLACEHOLDER,
  SIMULATION_BRIEFING_VIDEO_SNIPPET,
  resolveSimulationBriefingHtml,
} from "@/lib/runtime-content";
import { buildPdfPayloadFromReport, buildReportFromSessionDetails } from "@/lib/report-data";
import { ChevronDown, FileSpreadsheet, Info, Pause, Play } from "lucide-react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import storeBg from "@assets/store_bg.png";

type TabKey = "cases" | "channels" | "results" | "settings";
type ChannelTab = "email" | "messenger" | "video";
type SystemSoundSettingKey = "callSoundAssetId" | "emailSoundAssetId" | "messengerSoundAssetId" | "videoSoundAssetId";

const SETTINGS_FIELD_INFO = [
  {
    key: "firstSignalMinSeconds",
    label: "Первый сигнал: минимум, сек",
    shortName: "Мин. до старта",
    description: "Минимальное время до появления первого события после старта симуляции.",
    effect: "Влияет на скорость, с которой участник получает первое управленческое давление.",
    upExample: "Если увеличить значение, у участника будет больше времени на вход в контекст.",
    downExample: "Если уменьшить значение, первый сигнал прилетит почти сразу после запуска.",
  },
  {
    key: "firstSignalMaxSeconds",
    label: "Первый сигнал: максимум, сек",
    shortName: "Макс. до старта",
    description: "Верхняя граница ожидания первого события.",
    effect: "Определяет разброс случайного времени появления первого кейса.",
    upExample: "Если увеличить значение, симуляция может стартовать мягче и менее предсказуемо.",
    downExample: "Если уменьшить значение, первый кейс всегда будет приходить быстро.",
  },
  {
    key: "signalIntervalMinSeconds",
    label: "Интервал сигналов: минимум, сек",
    shortName: "Мин. интервал",
    description: "Минимальный промежуток между основными звонками и кейсами.",
    effect: "Задаёт нижнюю границу плотности нагрузки.",
    upExample: "Если увеличить значение, поток сигналов станет более разреженным.",
    downExample: "Если уменьшить значение, участнику придётся быстрее переключаться между задачами.",
  },
  {
    key: "signalIntervalMaxSeconds",
    label: "Интервал сигналов: максимум, сек",
    shortName: "Макс. интервал",
    description: "Максимальная пауза между основными сигналами.",
    effect: "Расширяет или сужает разброс случайного расписания.",
    upExample: "Если увеличить значение, симуляция станет менее плотной.",
    downExample: "Если уменьшить значение, кейсы будут идти более равномерно и чаще.",
  },
  {
    key: "reminderIntervalSeconds",
    label: "Базовый повтор напоминания, сек",
    shortName: "Базовый повтор",
    description: "Общее значение по умолчанию для повторов там, где в кейсе не указан свой интервал.",
    effect: "Используется как запасной интервал напоминаний в системной логике.",
    upExample: "Если увеличить значение, запасные повторы будут приходить реже.",
    downExample: "Если уменьшить значение, система будет настойчивее напоминать о неотработанных задачах.",
  },
  {
    key: "easyAutoCaseCount",
    label: "Кейсов на лёгком",
    shortName: "Лёгкий набор",
    description: "Количество кейсов, автоматически выбираемых для лёгкой сложности.",
    effect: "Влияет на объём задания и итоговую длительность режима.",
    upExample: "Если увеличить значение, даже лёгкая симуляция станет длиннее.",
    downExample: "Если уменьшить значение, лёгкий режим будет короче и проще.",
  },
  {
    key: "mediumAutoCaseCount",
    label: "Кейсов на среднем",
    shortName: "Средний набор",
    description: "Количество кейсов для автоматической сборки среднего уровня.",
    effect: "Определяет нагрузку в базовом режиме оценки.",
    upExample: "Если увеличить значение, у участника будет больше управленческих развилок.",
    downExample: "Если уменьшить значение, средний режим станет ближе к ознакомительному.",
  },
  {
    key: "hardAutoCaseCount",
    label: "Кейсов на сложном",
    shortName: "Сложный набор",
    description: "Количество кейсов для сложной симуляции.",
    effect: "Напрямую влияет на общий объём стрессовой нагрузки.",
    upExample: "Если увеличить значение, сложный режим станет длиннее и насыщеннее.",
    downExample: "Если уменьшить значение, сложный режим будет менее изматывающим.",
  },
  {
    key: "defaultTimePerCaseMinutes",
    label: "Минут на кейс",
    shortName: "Норматив кейса",
    description: "Нормативное время на обработку одного кейса.",
    effect: "Используется для темпа симуляции, расчёта длины прохождения и логики таймеров.",
    upExample: "Если увеличить значение, симуляция получит больше общего времени на тот же набор кейсов.",
    downExample: "Если уменьшить значение, участник будет работать в более жёстком темпе.",
  },
  {
    key: "minSimulationMinutes",
    label: "Минимум минут симуляции",
    shortName: "Мин. длительность",
    description: "Нижняя граница общей продолжительности сессии.",
    effect: "Не даёт очень короткому набору кейсов завершиться слишком быстро.",
    upExample: "Если увеличить значение, даже короткая сессия сохранит рабочую продолжительность.",
    downExample: "Если уменьшить значение, короткие сценарии будут завершаться быстрее.",
  },
] as const;

const EXPECTATION_LABELS = [
  "Ожидания минимальные",
  "Ожидания заметно ниже среднего",
  "Ожидания ниже среднего",
  "Ожидания умеренные",
  "Ожидания рабочие",
  "Ожидания средние",
  "Ожидания выше среднего",
  "Ожидания высокие",
  "Ожидания очень высокие",
  "Ожидания экспертные",
] as const;

const TIME_PROFILE_CONFIG = {
  easy: { label: "Лёгкое время", ratio: 1.1, recommendation: "110% времени" },
  medium: { label: "Среднее время", ratio: 1.0, recommendation: "100% времени" },
  hard: { label: "Сложное время", ratio: 0.8, recommendation: "80% времени" },
} as const;

const CASE_SIGNAL_TYPE_OPTIONS = [
  { value: "call", label: "Звонок" },
  { value: "message", label: "Сообщение" },
  { value: "zone_signal", label: "Сигнал зоны" },
  { value: "email", label: "Почта" },
  { value: "visitor", label: "Посетитель" },
] as const;

const STORE_ZONE_OPTIONS = [
  { value: "торговый_зал", label: "Торговый зал" },
  { value: "склад", label: "Склад" },
  { value: "выдача", label: "Выдача" },
  { value: "начальство", label: "Начальство" },
] as const;

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeCaseWeightsDraft(value: Record<string, any> | null | undefined) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const source = value.caseWeights && typeof value.caseWeights === "object"
    ? value.caseWeights
    : value.caseWeightsJson && typeof value.caseWeightsJson === "object"
      ? value.caseWeightsJson
      : {};

  return Object.fromEntries(
    Object.entries(source).map(([key, weight]) => [
      key,
      clampNumber(Number(weight) || 0, 0, 100),
    ]),
  );
}

function getCaseWeightValue(caseWeights: Record<string, number>, caseId: string) {
  const explicit = Number(caseWeights[caseId]);
  return Number.isFinite(explicit) ? clampNumber(explicit, 0, 100) : 100;
}

function buildCaseCompetencyProfile(entity: Pick<SimCase, "id" | "title" | "cycles">) {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};

  (entity.cycles || []).forEach((cycle: any) => {
    (cycle.options || []).forEach((option: any) => {
      Object.entries(option.competency_scores || {}).forEach(([competencyId, score]) => {
        totals[competencyId] = (totals[competencyId] || 0) + Number(score || 0);
        counts[competencyId] = (counts[competencyId] || 0) + 1;
      });
    });
  });

  return Object.fromEntries(
    Object.entries(totals).map(([competencyId, total]) => [
      competencyId,
      Math.round((total / Math.max(1, counts[competencyId] || 1)) * 10) / 10,
    ]),
  );
}

function buildOptionCompetencyProfile(
  options: Array<{ competency_scores?: Record<string, number> | null }> | null | undefined,
) {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};

  (options || []).forEach((option) => {
    Object.entries(option.competency_scores || {}).forEach(([competencyId, score]) => {
      totals[competencyId] = (totals[competencyId] || 0) + Number(score || 0);
      counts[competencyId] = (counts[competencyId] || 0) + 1;
    });
  });

  return Object.fromEntries(
    Object.entries(totals).map(([competencyId, total]) => [
      competencyId,
      Math.round((total / Math.max(1, counts[competencyId] || 1)) * 10) / 10,
    ]),
  );
}

function buildEntityCompetencyProfile(entity: any) {
  if (!entity) {
    return {};
  }

  if (Array.isArray(entity.cycles)) {
    return buildCaseCompetencyProfile(entity);
  }

  if (Array.isArray(entity.options)) {
    return buildOptionCompetencyProfile(entity.options);
  }

  return {};
}

function buildWeightedCompetencyProfile(
  cases: SimCase[],
  caseWeights: Record<string, number>,
) {
  const totals: Record<string, number> = {};
  const weightTotals: Record<string, number> = {};

  cases.forEach((caseItem) => {
    const weight = getCaseWeightValue(caseWeights, caseItem.id) / 100;
    const profile = buildCaseCompetencyProfile(caseItem);

    Object.entries(profile).forEach(([competencyId, score]) => {
      totals[competencyId] = (totals[competencyId] || 0) + score * weight;
      weightTotals[competencyId] = (weightTotals[competencyId] || 0) + weight;
    });
  });

  return Object.fromEntries(
    Object.entries(totals).map(([competencyId, total]) => [
      competencyId,
      Math.round((total / Math.max(weightTotals[competencyId] || 1, 0.0001)) * 10) / 10,
    ]),
  );
}

function buildCompetencyBarData(
  competencies: CompetencyDefinition[],
  aggregateProfile: Record<string, number>,
  selectedProfile: Record<string, number>,
  selectedWeight: number,
) {
  return competencies.map((competency) => ({
    name: competency.name,
    shortName: competency.name.length > 18 ? `${competency.name.slice(0, 18)}…` : competency.name,
    aggregate: Number(aggregateProfile[competency.id] || 0),
    selected: Math.round((Number(selectedProfile[competency.id] || 0) * (selectedWeight / 100)) * 10) / 10,
  }));
}

function buildCompetencyRadarData(
  competencies: CompetencyDefinition[],
  targetProfile: Record<string, number>,
  factProfile: Record<string, number>,
) {
  return competencies.map((competency) => ({
    competency: competency.name,
    target: Number(targetProfile[competency.id] || 0),
    fact: Number(factProfile[competency.id] || 0),
  }));
}

type CompetencyImpactDatum = {
  name: string;
  shortName: string;
  aggregate?: number;
  selected?: number;
  value?: number;
};

type CompetencyImpactSeries = {
  key: "aggregate" | "selected" | "value";
  label: string;
  color: string;
};

function CompetencyHorizontalImpactChart({
  data,
  series,
  emptyText = "Пока нет настроенного влияния на компетенции.",
}: {
  data: CompetencyImpactDatum[];
  series: CompetencyImpactSeries[];
  emptyText?: string;
}) {
  const visibleRows = data.filter((row) => series.some((item) => Number(row[item.key] || 0) > 0));
  const rows = visibleRows.length > 0 ? visibleRows : data;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#31455f] bg-[#101826]/70 px-4 py-6 text-center text-sm text-[#8aa2c4]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {series.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-[11px] font-medium text-[#cbd8ef]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
        <div className="ml-auto text-[10px] uppercase tracking-[0.16em] text-[#6f829e]">Шкала 0–5</div>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.name} className="rounded-lg border border-[#1f3045] bg-[#0d1522]/80 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0 text-[12px] font-semibold leading-4 text-[#f3f7ff]">{row.name}</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#71839d]">{row.shortName}</div>
            </div>
            <div className="space-y-1.5">
              {series.map((item) => {
                const value = Math.max(0, Math.min(5, Number(row[item.key] || 0)));
                return (
                  <div key={item.key} className="grid grid-cols-[64px,1fr,32px] items-center gap-2">
                    <div className="truncate text-[10px] text-[#93a7c3]">{item.label}</div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#1b2638]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(value / 5) * 100}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <div className="text-right text-[11px] font-semibold tabular-nums text-[#e9f1ff]">
                      {value > 0 ? value.toFixed(1) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getChannelEntityTitle(entity: any, mode: ChannelTab) {
  if (!entity) return "";
  if (mode === "email") return entity.subject || entity.id || "Письмо";
  if (mode === "messenger") return entity.senderName || entity.id || "Сообщение";
  return entity.title || entity.id || "Видео";
}

function getChannelEntityDescription(entity: any, mode: ChannelTab) {
  if (!entity) return "";
  if (mode === "email") return entity.preview || entity.body || "";
  if (mode === "messenger") return entity.message || "";
  return entity.situation || "";
}

function getChannelModeLabel(mode: ChannelTab) {
  if (mode === "email") return "Почта";
  if (mode === "messenger") return "Мессенджер";
  return "Видео";
}

function ChannelInfluencePanel({
  entity,
  mode,
  data,
}: {
  entity: any;
  mode: ChannelTab;
  data: CompetencyImpactDatum[];
}) {
  return (
    <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:overflow-x-hidden xl:pr-3 scrollbar-thin">
      <div className="text-sm font-semibold text-white">Влияние выбранного сигнала</div>
      <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
        Канальные события тоже оценивают компетенции через варианты ответа. Этот блок показывает, какой профиль формирует выбранный сигнал.
      </div>
      <div className="flex items-center justify-center gap-1 py-1 text-[10px] text-[#64748B] xl:hidden">
        <ChevronDown className="h-3 w-3" />
        <span>Прокрутите для подробностей</span>
      </div>
      {entity ? (
        <>
          <div className="mt-3 rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
            <div className="text-xs uppercase tracking-[0.18em] text-[#6fa0ff]">
              {getChannelModeLabel(mode)} • {entity.id || "Новый сигнал"}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">{getChannelEntityTitle(entity, mode)}</div>
            <div className="mt-2 line-clamp-4 text-[11px] leading-relaxed text-[#8aa2c4]">
              {getChannelEntityDescription(entity, mode) || "Описание сигнала пока не заполнено."}
            </div>
          </div>
          <div className="mt-4">
            <CompetencyHorizontalImpactChart
              data={data}
              series={[{ key: "value", label: "Влияние", color: "#00d4aa" }]}
            />
          </div>
          <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
            Значения считаются как среднее влияние всех вариантов ответа по каждой компетенции. Если компетенция не заполнена в вариантах, она не появится в итоговом профиле сигнала.
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[#31455f] bg-[#101826]/60 px-4 py-6 text-center text-sm text-[#8aa2c4]">
          Выберите сигнал слева, чтобы увидеть его влияние на компетенции.
        </div>
      )}
    </div>
  );
}

function estimateExpectationLevel(
  cases: SimCase[],
  caseWeights: Record<string, number>,
  timeInfluenceEnabled: boolean,
) {
  if (cases.length === 0) {
    return 1;
  }

  const profile = buildWeightedCompetencyProfile(cases, caseWeights);
  const values = Object.values(profile);
  const avgCompetency = values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
  const avgCaseWeight = cases.reduce((sum, caseItem) => sum + getCaseWeightValue(caseWeights, caseItem.id), 0) / cases.length;
  const weightedLoad = (avgCompetency / 5) * 6 + (avgCaseWeight / 100) * 3 + (timeInfluenceEnabled ? 1 : 0);
  return clampNumber(Math.round(weightedLoad), 1, 10);
}

function getRecommendedDifficulty(level: number) {
  if (level >= 8) return "hard" as const;
  if (level >= 5) return "medium" as const;
  return "easy" as const;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSettingsDraft(value: Record<string, any> | null | undefined) {
  return {
    ...(value || {}),
    preSimulationInstructionHtml: value?.preSimulationInstructionHtml || DEFAULT_SIMULATION_BRIEFING_HTML,
    preSimulationInstructionVideoAssetId: value?.preSimulationInstructionVideoAssetId || null,
    caseWeights: normalizeCaseWeightsDraft(value),
    timeInfluenceEnabled: Boolean(value?.timeInfluenceEnabled),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getPreviewAudioUrl(entityId: string, mode: "case" | "email" | "messenger" | "video") {
  const match = String(entityId || "").match(/(\d+)/);
  if (!match) {
    return null;
  }

  const suffix = match[1].padStart(2, "0");
  if (mode === "case") {
    return `/library/audio_case_${suffix}.mp3`;
  }
  if (mode === "video") {
    return `/library/audio_video_${suffix}.mp3`;
  }

  return null;
}

function getSystemSoundChannel(key: SystemSoundSettingKey): NotificationChannelKey {
  switch (key) {
    case "callSoundAssetId":
      return "call";
    case "emailSoundAssetId":
      return "email";
    case "messengerSoundAssetId":
      return "messenger";
    case "videoSoundAssetId":
      return "video";
    default:
      return "call";
  }
}

function buildCompetencyAliasMap(competencies: CompetencyDefinition[]) {
  const aliases = new Map<string, string>();
  competencies.forEach((competency) => {
    aliases.set(competency.id.trim().toLowerCase(), competency.id);
    aliases.set(competency.name.trim().toLowerCase(), competency.id);
  });
  return aliases;
}

function buildCompetencyNameMap(competencies: CompetencyDefinition[]) {
  return new Map(competencies.map((competency) => [competency.id, competency.name]));
}

function formatCompetencyList(ids: string[] | undefined, competencies: CompetencyDefinition[]) {
  const names = buildCompetencyNameMap(competencies);
  return (ids || []).map((id) => names.get(id) || id).join(", ");
}

function parseCompetencyList(value: string, competencies: CompetencyDefinition[]) {
  const aliases = buildCompetencyAliasMap(competencies);
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => aliases.get(item.toLowerCase()) || item)
    .filter((item, index, array) => array.indexOf(item) === index);
}

function formatTechnicalStatus(value: string) {
  switch (value) {
    case "completed":
      return "Завершено";
    case "interrupted":
      return "Прервано";
    case "in_progress":
      return "В процессе";
    default:
      return value || "—";
  }
}

function buildSuggestionOptions(values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right, "ru"));
}

function createEmptyCase(order: number): SimCase {
  return {
    id: `CASE-${String(order).padStart(2, "0")}`,
    title: "",
    description: "",
    primaryCompetencies: [],
    secondaryCompetencies: [],
    trigger: { type: "message", source: "", text: "" },
    zones_affected: [],
    cycles: [{
      id: "",
      cycle: 1,
      situation: "",
      signal: { type: "message", content: "" },
      options: [],
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

function createEmptyEmail(order: number): EmailCase {
  return {
    id: `EMAIL-${String(order).padStart(2, "0")}`,
    subject: "",
    from: "",
    department: "",
    departmentColor: "#4a9eff",
    preview: "",
    body: "",
    arrivalMinute: order * 10,
    options: [],
    primaryCompetency: "",
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: { arrivalMinute: order * 10, decisionDeadlineSeconds: 300, reminderIntervalSeconds: 180 },
    sortOrder: order,
    isActive: true,
  };
}

function createEmptyMessenger(order: number): MessengerCase {
  return {
    id: `MSG-${String(order).padStart(2, "0")}`,
    chatId: "",
    isGroup: false,
    senderName: "",
    senderRole: "",
    senderAvatar: "",
    message: "",
    arrivalMinute: order * 10,
    options: [],
    primaryCompetency: "",
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: { arrivalMinute: order * 10, decisionDeadlineSeconds: 180, reminderIntervalSeconds: 5 },
    sortOrder: order,
    isActive: true,
  };
}

function createEmptyVideo(order: number): VideoCase {
  return {
    id: `VIDEO-${String(order).padStart(2, "0")}`,
    title: "",
    sender: "",
    role: "",
    senderAvatar: "",
    duration: "1:00",
    situation: "",
    arrivalMinute: order * 10,
    options: [],
    primaryCompetency: "",
    imageAssetId: null,
    imageUrl: null,
    videoAssetId: null,
    videoUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: { arrivalMinute: order * 10, decisionDeadlineSeconds: 240, reminderIntervalSeconds: 180 },
    sortOrder: order,
    isActive: true,
  };
}

function createEmptyChat(order: number): ChatInfo {
  return {
    id: `CHAT-${String(order).padStart(2, "0")}`,
    name: "",
    isGroup: false,
    avatar: "?",
    role: "",
    icon: "",
    members: [],
    sortOrder: order,
  };
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("cases");
  const [channelTab, setChannelTab] = useState<ChannelTab>("email");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedMessengerId, setSelectedMessengerId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const [selectedWeightCaseId, setSelectedWeightCaseId] = useState<string | null>(null);
  const [caseWizardOpen, setCaseWizardOpen] = useState(false);
  const [signalWizardOpen, setSignalWizardOpen] = useState(false);
  const [signalWizardStep, setSignalWizardStep] = useState(0);
  const [signalWizardMode, setSignalWizardMode] = useState<ChannelTab>("email");
  const [caseWizardStep, setCaseWizardStep] = useState(0);
  const [caseDraft, setCaseDraft] = useState<SimCase | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailCase | null>(null);
  const [messengerDraft, setMessengerDraft] = useState<MessengerCase | null>(null);
  const [videoDraft, setVideoDraft] = useState<VideoCase | null>(null);
  const [chatDraft, setChatDraft] = useState<ChatInfo | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, any>>(() => normalizeSettingsDraft({}));
  const [resultStatusFilter, setResultStatusFilter] = useState("");
  const [resultParticipantFilter, setResultParticipantFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [caseWizardDraft, setCaseWizardDraft] = useState<SimCase>(() => createEmptyCase(1));
  const [signalWizardDraft, setSignalWizardDraft] = useState<EmailCase | MessengerCase | VideoCase>(() => createEmptyEmail(1));

  const staffQuery = useQuery({
    queryKey: ["/api/staff/me"],
    queryFn: getQueryFn<any>({ on401: "returnNull" }),
  });
  const contentQuery = useQuery({
    queryKey: ["/api/staff/content"],
    queryFn: getQueryFn<any>({ on401: "throw" }),
    enabled: !!staffQuery.data,
  });
  const resultsQuery = useQuery({
    queryKey: ["/api/staff/results", resultStatusFilter, resultParticipantFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resultStatusFilter) {
        params.set("status", resultStatusFilter);
      }
      if (resultParticipantFilter) {
        params.set("participantName", resultParticipantFilter);
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/staff/results${suffix}`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    enabled: !!staffQuery.data,
  });
  const resultDetailQuery = useQuery({
    queryKey: ["/api/staff/results/detail", selectedResultId],
    queryFn: async () => {
      const response = await fetch(`/api/staff/results/${selectedResultId}`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    enabled: !!staffQuery.data && selectedResultId != null,
  });

  useEffect(() => {
    if (!staffQuery.isLoading && (!staffQuery.data || staffQuery.data.role !== "admin")) {
      navigate("/staff-login");
    }
  }, [staffQuery.data, staffQuery.isLoading, navigate]);

  useEffect(() => {
    if (contentQuery.data?.cases && !selectedCaseId && contentQuery.data.cases[0]) {
      setSelectedCaseId(contentQuery.data.cases[0].id);
    }
    if (contentQuery.data?.emailCases && !selectedEmailId && contentQuery.data.emailCases[0]) {
      setSelectedEmailId(contentQuery.data.emailCases[0].id);
    }
    if (contentQuery.data?.messengerCases && !selectedMessengerId && contentQuery.data.messengerCases[0]) {
      setSelectedMessengerId(contentQuery.data.messengerCases[0].id);
    }
    if (contentQuery.data?.messengerChats && !selectedChatId && contentQuery.data.messengerChats[0]) {
      setSelectedChatId(contentQuery.data.messengerChats[0].id);
    }
    if (contentQuery.data?.videoCases && !selectedVideoId && contentQuery.data.videoCases[0]) {
      setSelectedVideoId(contentQuery.data.videoCases[0].id);
    }
    if (contentQuery.data?.settings) {
      setSettingsDraft(normalizeSettingsDraft(contentQuery.data.settings));
    }
    if (resultsQuery.data && !selectedResultId && resultsQuery.data[0]) {
      setSelectedResultId(resultsQuery.data[0].id);
    }
  }, [contentQuery.data, resultsQuery.data, selectedCaseId, selectedChatId, selectedEmailId, selectedMessengerId, selectedResultId, selectedVideoId]);

  useEffect(() => {
    const found = contentQuery.data?.cases?.find((item: SimCase) => item.id === selectedCaseId);
    setCaseDraft(found ? deepClone(found) : null);
  }, [selectedCaseId, contentQuery.data?.cases]);

  useEffect(() => {
    const found = contentQuery.data?.emailCases?.find((item: EmailCase) => item.id === selectedEmailId);
    setEmailDraft(found ? deepClone(found) : null);
  }, [selectedEmailId, contentQuery.data?.emailCases]);

  useEffect(() => {
    const found = contentQuery.data?.messengerCases?.find((item: MessengerCase) => item.id === selectedMessengerId);
    setMessengerDraft(found ? deepClone(found) : null);
  }, [selectedMessengerId, contentQuery.data?.messengerCases]);

  useEffect(() => {
    const found = contentQuery.data?.messengerChats?.find((item: ChatInfo) => item.id === selectedChatId);
    setChatDraft(found ? deepClone(found) : null);
  }, [selectedChatId, contentQuery.data?.messengerChats]);

  useEffect(() => {
    const found = contentQuery.data?.videoCases?.find((item: VideoCase) => item.id === selectedVideoId);
    setVideoDraft(found ? deepClone(found) : null);
  }, [selectedVideoId, contentQuery.data?.videoCases]);

  useEffect(() => {
    if (!resultsQuery.data || resultsQuery.data.length === 0) {
      setSelectedResultId(null);
      return;
    }

    if (!resultsQuery.data.some((item: any) => item.id === selectedResultId)) {
      setSelectedResultId(resultsQuery.data[0].id);
    }
  }, [resultsQuery.data, selectedResultId]);

  const assets = contentQuery.data?.assets || [];
  const imageAssets = assets.filter((asset: any) => asset.kind === "image");
  const audioAssets = assets.filter((asset: any) => asset.kind === "audio");
  const videoAssets = assets.filter((asset: any) => asset.kind === "video");
  const chats = contentQuery.data?.messengerChats || [];
  const competencies = contentQuery.data?.competencies || [];
  const caseSourceOptions = useMemo(
    () => buildSuggestionOptions(((contentQuery.data?.cases || []) as SimCase[]).map((item) => item.trigger?.source)),
    [contentQuery.data?.cases],
  );
  const emailSenderOptions = useMemo(
    () => buildSuggestionOptions(((contentQuery.data?.emailCases || []) as EmailCase[]).map((item) => item.from)),
    [contentQuery.data?.emailCases],
  );
  const emailDepartmentOptions = useMemo(
    () => buildSuggestionOptions(((contentQuery.data?.emailCases || []) as EmailCase[]).map((item) => item.department)),
    [contentQuery.data?.emailCases],
  );
  const messengerSenderOptions = useMemo(
    () => buildSuggestionOptions(((contentQuery.data?.messengerCases || []) as MessengerCase[]).map((item) => item.senderName)),
    [contentQuery.data?.messengerCases],
  );
  const messengerRoleOptions = useMemo(
    () => buildSuggestionOptions(((contentQuery.data?.messengerCases || []) as MessengerCase[]).map((item) => item.senderRole)),
    [contentQuery.data?.messengerCases],
  );
  const videoSenderOptions = useMemo(
    () => buildSuggestionOptions(((contentQuery.data?.videoCases || []) as VideoCase[]).map((item) => item.sender)),
    [contentQuery.data?.videoCases],
  );
  const videoRoleOptions = useMemo(
    () => buildSuggestionOptions(((contentQuery.data?.videoCases || []) as VideoCase[]).map((item) => item.role)),
    [contentQuery.data?.videoCases],
  );
  const activeCases = useMemo(
    () => ((contentQuery.data?.cases || []) as SimCase[]).filter((item) => item.isActive !== false),
    [contentQuery.data?.cases],
  );
  const caseWeightsDraft = useMemo(
    () => normalizeCaseWeightsDraft(settingsDraft),
    [settingsDraft],
  );
  const selectedWeightCase = useMemo(
    () => activeCases.find((item) => item.id === selectedWeightCaseId) || activeCases[0] || null,
    [activeCases, selectedWeightCaseId],
  );
  const selectedCaseWeight = selectedWeightCase ? getCaseWeightValue(caseWeightsDraft, selectedWeightCase.id) : 100;
  const selectedCaseProfile = useMemo(
    () => buildEntityCompetencyProfile(selectedWeightCase),
    [selectedWeightCase],
  );
  const aggregateCompetencyProfile = useMemo(
    () => buildWeightedCompetencyProfile(activeCases, caseWeightsDraft),
    [activeCases, caseWeightsDraft],
  );
  const factCompetencyProfile = useMemo(
    () => (resultDetailQuery.data?.result?.competencyAverages || {}) as Record<string, number>,
    [resultDetailQuery.data],
  );
  const aggregateBarData = useMemo(
    () => buildCompetencyBarData(competencies, aggregateCompetencyProfile, selectedCaseProfile, selectedCaseWeight),
    [competencies, aggregateCompetencyProfile, selectedCaseProfile, selectedCaseWeight],
  );
  const radarChartData = useMemo(
    () => buildCompetencyRadarData(competencies, aggregateCompetencyProfile, factCompetencyProfile),
    [competencies, aggregateCompetencyProfile, factCompetencyProfile],
  );
  const expectationLevel = useMemo(
    () => estimateExpectationLevel(activeCases, caseWeightsDraft, Boolean(settingsDraft.timeInfluenceEnabled)),
    [activeCases, caseWeightsDraft, settingsDraft.timeInfluenceEnabled],
  );
  const recommendedDifficulty = useMemo(
    () => getRecommendedDifficulty(expectationLevel),
    [expectationLevel],
  );
  const selectedResultSummary = resultDetailQuery.data?.session || null;
  const selectedResultReport = useMemo(
    () => (resultDetailQuery.data ? buildReportFromSessionDetails(resultDetailQuery.data, settingsDraft as SimulationRuntimeSettings) : null),
    [resultDetailQuery.data, settingsDraft],
  );
  const caseDraftProfile = useMemo(
    () => buildEntityCompetencyProfile(caseDraft),
    [caseDraft],
  );
  const caseDraftWeight = caseDraft ? getCaseWeightValue(caseWeightsDraft, caseDraft.id) : 100;
  const caseDraftBarData = useMemo(
    () => buildCompetencyBarData(competencies, caseDraftProfile, caseDraftProfile, caseDraftWeight),
    [caseDraftProfile, caseDraftWeight, competencies],
  );
  const selectedChannelDraft = channelTab === "email"
    ? emailDraft
    : channelTab === "messenger"
      ? messengerDraft
      : videoDraft;
  const channelDraftProfile = useMemo(
    () => buildEntityCompetencyProfile(selectedChannelDraft),
    [selectedChannelDraft],
  );
  const channelDraftBarData = useMemo(
    () => buildCompetencyBarData(competencies, channelDraftProfile, channelDraftProfile, 100).map((item) => ({
      ...item,
      value: item.aggregate,
    })),
    [channelDraftProfile, competencies],
  );

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!activeCases.length) {
      setSelectedWeightCaseId(null);
      return;
    }

    if (!selectedWeightCaseId || !activeCases.some((item) => item.id === selectedWeightCaseId)) {
      setSelectedWeightCaseId(activeCases[0].id);
    }
  }, [activeCases, selectedWeightCaseId]);

  const handleUploadAsset = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await apiRequest("POST", "/api/admin/assets", {
        name: file.name,
        mimeType: file.type,
        originalFilename: file.name,
        data: dataUrl,
      });
      const asset = await response.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/content"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/simulation-content"] });
      return asset.id as string;
    } catch (err: any) {
      setError(err.message || "Не удалось загрузить медиафайл");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const saveCurrent = async () => {
    setSaving(true);
    setError("");
    try {
      if (tab === "cases" && caseDraft) {
        const response = await apiRequest("POST", "/api/admin/cases", caseDraft);
        const payload = await response.json();
        setSelectedCaseId(payload.id);
      }
      if (tab === "channels" && channelTab === "email" && emailDraft) {
        const response = await apiRequest("POST", "/api/admin/email-cases", emailDraft);
        const payload = await response.json();
        setSelectedEmailId(payload.id);
      }
      if (tab === "channels" && channelTab === "messenger" && messengerDraft) {
        const response = await apiRequest("POST", "/api/admin/messenger-cases", messengerDraft);
        const payload = await response.json();
        setSelectedMessengerId(payload.id);
      }
      if (tab === "channels" && channelTab === "video" && videoDraft) {
        const response = await apiRequest("POST", "/api/admin/video-cases", videoDraft);
        const payload = await response.json();
        setSelectedVideoId(payload.id);
      }
      if (tab === "settings") {
        await apiRequest("PUT", "/api/admin/settings", settingsDraft);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/content"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/simulation-content"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/results"] });
    } catch (err: any) {
      setError(err.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    setActivePreviewKey(null);
  };

  const togglePreviewAudio = (previewKey: string, url: string | null) => {
    if (!url) {
      setError("Для этого кейса не найден связанный аудиофайл.");
      return;
    }

    setError("");

    if (activePreviewKey === previewKey) {
      stopPreviewAudio();
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }

    const audio = new Audio(url);
    previewAudioRef.current = audio;
    setActivePreviewKey(previewKey);
    audio.addEventListener("ended", () => {
      setActivePreviewKey((current) => (current === previewKey ? null : current));
      previewAudioRef.current = null;
    });
    audio.addEventListener("error", () => {
      setError("Не удалось воспроизвести аудиофайл.");
      setActivePreviewKey((current) => (current === previewKey ? null : current));
      previewAudioRef.current = null;
    });
    audio.play().catch(() => {
      setError("Не удалось воспроизвести аудиофайл.");
      setActivePreviewKey(null);
      previewAudioRef.current = null;
    });
  };

  const updateCaseWeight = (caseId: string, nextWeight: number) => {
    setSettingsDraft((current) => ({
      ...current,
      caseWeights: {
        ...normalizeCaseWeightsDraft(current),
        [caseId]: clampNumber(nextWeight, 0, 100),
      },
    }));
  };

  const openCaseWizard = () => {
    const nextOrder = (contentQuery.data?.cases?.length || 0) + 1;
    setCaseWizardDraft(createEmptyCase(nextOrder));
    setCaseWizardStep(0);
    setCaseWizardOpen(true);
  };

  const openSignalWizard = (mode: ChannelTab) => {
    const nextOrder =
      mode === "email"
        ? (contentQuery.data?.emailCases?.length || 0) + 1
        : mode === "messenger"
          ? (contentQuery.data?.messengerCases?.length || 0) + 1
          : (contentQuery.data?.videoCases?.length || 0) + 1;

    setSignalWizardMode(mode);
    setSignalWizardStep(0);
    setSignalWizardDraft(
      mode === "email"
        ? createEmptyEmail(nextOrder)
        : mode === "messenger"
          ? createEmptyMessenger(nextOrder)
          : createEmptyVideo(nextOrder),
    );
    setSignalWizardOpen(true);
  };

  const confirmCaseWizard = () => {
    const nextDraft = deepClone(caseWizardDraft);
    nextDraft.id = nextDraft.id || `CASE-${String((contentQuery.data?.cases?.length || 0) + 1).padStart(2, "0")}`;
    nextDraft.cycles = (nextDraft.cycles || []).map((cycle, index) => ({
      ...cycle,
      id: cycle.id || `${nextDraft.id}-C${index + 1}`,
      cycle: index + 1,
      options: (cycle.options || []).map((option: any, optionIndex: number) => ({
        ...option,
        id: option.id || `${nextDraft.id}-C${index + 1}-O${optionIndex + 1}`,
        level: optionIndex + 1,
      })),
    }));

    setSelectedCaseId(null);
    setCaseDraft(nextDraft);
    setCaseWizardOpen(false);
  };

  const confirmSignalWizard = () => {
    if (signalWizardMode === "email") {
      const nextDraft = deepClone(signalWizardDraft as EmailCase);
      nextDraft.id = nextDraft.id || `EMAIL-${String((contentQuery.data?.emailCases?.length || 0) + 1).padStart(2, "0")}`;
      setSelectedEmailId(null);
      setEmailDraft(nextDraft);
    }

    if (signalWizardMode === "messenger") {
      const nextDraft = deepClone(signalWizardDraft as MessengerCase);
      nextDraft.id = nextDraft.id || `MSG-${String((contentQuery.data?.messengerCases?.length || 0) + 1).padStart(2, "0")}`;
      setSelectedMessengerId(null);
      setMessengerDraft(nextDraft);
    }

    if (signalWizardMode === "video") {
      const nextDraft = deepClone(signalWizardDraft as VideoCase);
      nextDraft.id = nextDraft.id || `VIDEO-${String((contentQuery.data?.videoCases?.length || 0) + 1).padStart(2, "0")}`;
      setSelectedVideoId(null);
      setVideoDraft(nextDraft);
    }

    setSignalWizardOpen(false);
  };

  const exportResultsExcel = async () => {
    setExcelLoading(true);
    setError("");
    try {
      const summaryRows = [
        [
          "Участник",
          "Оценщик",
          "Старт",
          "Завершение",
          "Статус прохождения",
          "Итоговый балл",
          "Средний балл",
        ],
        ...((resultsQuery.data || []).map((item: any) => ([
          item.participantName,
          item.evaluatorName || "",
          item.startedAt,
          item.completedAt || "",
          formatTechnicalStatus(item.technicalStatus),
          item.totalScore ?? 0,
          item.averageScore ?? 0,
        ]))),
      ];

      const detail = resultDetailQuery.data;
      const detailRows = detail ? [
        [
          "Кейс",
          "Тип задачи",
          "Время в симуляции",
          "Вариант ответа",
          "Оценка",
          "Базовый балл",
          "Штраф за просрочку",
          "Просрочено",
          "Сработавший таймер",
          "Зона",
          "Ответственный",
          "Комментарий оценщика",
        ],
        ...((detail.answers || []).map((answer: any) => ([
          answer.caseTitle,
          answer.sourceType,
          answer.simTime,
          answer.optionText,
          answer.score,
          answer.details?.baseScore ?? answer.score,
          answer.details?.timerPenalty ?? 0,
          answer.details?.overdue ? "Да" : "Нет",
          answer.details?.timer?.label || "",
          answer.details?.zoneLabel || "",
          answer.details?.responsibility || "",
          "",
        ]))),
      ] : null;

      const response = await apiRequest("POST", "/api/export-xlsx", {
        sheets: [
          { name: "Результаты", rows: summaryRows },
          ...(detailRows ? [{ name: "Кейсы участника", rows: detailRows }] : []),
        ],
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `results_${dateStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Не удалось сформировать Excel.");
    } finally {
      setExcelLoading(false);
    }
  };

  const exportSelectedResultPdf = async () => {
    if (!selectedResultReport) {
      return;
    }

    setPdfLoading(true);
    setError("");
    try {
      const payload = buildPdfPayloadFromReport(selectedResultReport);
      const response = await apiRequest("POST", "/api/export-pdf", payload);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const participantSlug = (selectedResultReport.participantName || "participant").replace(/\s+/g, "_");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `report_${participantSlug}_${dateStr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("PDF export failed:", err);
      setError(err.message || "Не удалось сформировать PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDeleteCurrent = async () => {
    setError("");
    try {
      if (tab === "cases" && selectedCaseId) {
        await apiRequest("DELETE", `/api/admin/cases/${selectedCaseId}`);
        setSelectedCaseId(null);
      }
      if (tab === "channels" && channelTab === "email" && selectedEmailId) {
        await apiRequest("DELETE", `/api/admin/channel-items/${selectedEmailId}`);
        setSelectedEmailId(null);
      }
      if (tab === "channels" && channelTab === "messenger" && selectedMessengerId) {
        await apiRequest("DELETE", `/api/admin/channel-items/${selectedMessengerId}`);
        setSelectedMessengerId(null);
      }
      if (tab === "channels" && channelTab === "video" && selectedVideoId) {
        await apiRequest("DELETE", `/api/admin/channel-items/${selectedVideoId}`);
        setSelectedVideoId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/content"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/simulation-content"] });
    } catch (err: any) {
      setError(err.message || "Не удалось удалить");
    }
  };

  const addOption = (setter: (updater: any) => void) => {
    setter((current: any) => ({
      ...current,
      options: [
        ...(current.options || []),
        {
          id: "",
          level: (current.options?.length || 0) + 1,
          text: "",
          score: 1,
          effects: { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 },
          competency_scores: {},
        },
      ],
    }));
  };

  const reorderCase = async (caseId: string, direction: -1 | 1) => {
    const cases = [...(contentQuery.data?.cases || [])] as SimCase[];
    const currentIndex = cases.findIndex((item) => item.id === caseId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= cases.length) {
      return;
    }

    [cases[currentIndex], cases[nextIndex]] = [cases[nextIndex], cases[currentIndex]];
    try {
      await apiRequest("POST", "/api/admin/cases/reorder", {
        ids: cases.map((item) => item.id),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/content"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/simulation-content"] });
    } catch (err: any) {
      setError(err.message || "Не удалось изменить порядок кейсов");
    }
  };

  const saveChatDraft = async () => {
    if (!chatDraft) {
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/admin/chats", chatDraft);
      const payload = await response.json();
      setSelectedChatId(payload.id);
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/content"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/simulation-content"] });
    } catch (err: any) {
      setError(err.message || "Не удалось сохранить чат");
    }
  };

  const deleteChatDraft = async () => {
    if (!selectedChatId) {
      return;
    }

    try {
      await apiRequest("DELETE", `/api/admin/chats/${selectedChatId}`);
      setSelectedChatId(null);
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/content"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/simulation-content"] });
    } catch (err: any) {
      setError(err.message || "Не удалось удалить чат");
    }
  };

  const exportSelectedResult = () => {
    if (!resultDetailQuery.data) {
      return;
    }

    const payload = JSON.stringify(resultDetailQuery.data, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `simulation-result-${resultDetailQuery.data.session.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const contentLoaded = !!contentQuery.data;

  if (staffQuery.isLoading || contentQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0d1117] text-white">Загрузка админки...</div>;
  }

  if (!contentLoaded) {
    return null;
  }

  return (
    <div
      className="dns-product-shell relative"
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1421ef] via-[#16213ef5] to-[#0d1421f7]" />
      <div className="dns-page-frame max-w-7xl">
        <header className="dns-brand-header">
          <div className="dns-brand-title">
            <div className="dns-brand-mark">D</div>
            <div>
              <div className="dns-brand-kicker">DNS SimCenter</div>
              <h1 className="dns-brand-heading">Администрирование симуляции</h1>
              <p className="dns-brand-subtitle">Контент, каналы, тайминги, результаты и параметры хода симуляции.</p>
            </div>
          </div>
          <div className="dns-header-actions">
            <div className="inline-flex items-center rounded-full border border-[#FF6B00]/35 bg-[#FF6B00]/12 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffb27a]">
              Product UI v4.1
            </div>
            <Button variant="outline" className="border-[#2a3a4e] text-[#8890a8] bg-transparent" onClick={() => navigate("/evaluator")}>
              В оценщик
            </Button>
            <Button variant="outline" className="border-[#2a3a4e] text-[#8890a8] bg-transparent" onClick={async () => { await apiRequest("POST", "/api/staff/logout"); navigate("/staff-login"); }}>
              Выйти
            </Button>
          </div>
        </header>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {(["cases", "channels", "results", "settings"] as TabKey[]).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`dns-tab-button whitespace-nowrap px-4 py-2 text-sm ${tab === item ? "dns-tab-button-active" : ""}`}
            >
              {item === "cases" ? "Кейсы" : item === "channels" ? "Каналы" : item === "results" ? "Результаты" : "Настройки"}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/10 px-4 py-3 text-sm text-[#ff9999]">{error}</div>}

        {tab === "cases" && (
          <div className="dns-mobile-stack dns-admin-main-grid grid gap-4">
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-white">Основные кейсы</div>
                <Button size="sm" onClick={openCaseWizard}>Новый</Button>
              </div>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {contentQuery.data.cases.map((item: SimCase) => (
                  <div key={item.id} className={`w-full rounded-lg border px-3 py-2 ${selectedCaseId === item.id ? "border-[#FF6B00] bg-[#FF6B00]/10" : "border-[#2a3a4e]"}`}>
                    <button onClick={() => setSelectedCaseId(item.id)} className="w-full text-left">
                      <div className="text-sm text-white">{item.title || item.id}</div>
                      <div className="text-xs text-[#8890a8]">{item.id}</div>
                    </button>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="border-[#2a3a4e] bg-transparent text-[#8890a8]" onClick={() => reorderCase(item.id, -1)}>
                        Выше
                      </Button>
                      <Button size="sm" variant="outline" className="border-[#2a3a4e] bg-transparent text-[#8890a8]" onClick={() => reorderCase(item.id, 1)}>
                        Ниже
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Методическое пояснение</div>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#cbd8ef]">
                  <p>Кейс в этой системе моделирует управленческую ситуацию в магазине: сигнал, контекст, цикл развития проблемы, варианты реакции и последствия для показателей и компетенций.</p>
                  <p>Администратор настраивает саму механику кейса: что происходит, через какой канал приходит сигнал, какие ответы доступны студенту и как каждый ответ влияет на магазин и итоговый профиль.</p>
                  <p>Основные компетенции задают ожидаемую зону оценки, а варианты ответа формируют фактический вклад кейса в результат студента. Чем точнее настроены развилки, тем честнее будет итоговая оценка.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),320px]">
              <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                {caseDraft && (
                  <EntityEditor
                    title="Редактор кейса"
                    entity={caseDraft}
                    assets={assets}
                    competencies={competencies}
                    caseSourceOptions={caseSourceOptions}
                    emailSenderOptions={emailSenderOptions}
                    emailDepartmentOptions={emailDepartmentOptions}
                    messengerSenderOptions={messengerSenderOptions}
                    messengerRoleOptions={messengerRoleOptions}
                    videoSenderOptions={videoSenderOptions}
                    videoRoleOptions={videoRoleOptions}
                    onChange={setCaseDraft}
                    onUploadAsset={handleUploadAsset}
                    chats={[]}
                    mode="case"
                    onAddOption={() => addOption(setCaseDraft)}
                    onTogglePreviewAudio={togglePreviewAudio}
                    activePreviewKey={activePreviewKey}
                  />
                )}
              </div>
              <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4 xl:sticky xl:top-4 xl:h-fit">
                <div className="text-sm font-semibold text-white">Влияние выбранного кейса</div>
                <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
                  Этот блок фиксирован рядом с редактором и показывает, как текущая настройка кейса влияет на ожидаемый профиль компетенций.
                </div>
                {caseDraft ? (
                  <>
                    <div className="mt-3 rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#6fa0ff]">{caseDraft.id || "Новый кейс"}</div>
                      <div className="mt-1 text-sm font-semibold text-white">{caseDraft.title || "Без названия"}</div>
                      <div className="mt-2 text-[11px] text-[#cbd8ef]">Вес кейса в симуляции: {caseDraftWeight}%</div>
                    </div>
                    <div className="mt-4">
                      <CompetencyHorizontalImpactChart
                        data={caseDraftBarData}
                        series={[
                          { key: "aggregate", label: "Профиль", color: "#4a9eff" },
                          { key: "selected", label: "С весом", color: "#00d4aa" },
                        ]}
                      />
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-[#31455f] bg-[#101826]/60 px-4 py-6 text-center text-sm text-[#8aa2c4]">
                    Выберите кейс слева или создайте новый, чтобы увидеть его влияние здесь.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "channels" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["email", "messenger", "video"] as ChannelTab[]).map((item) => (
                <button key={item} onClick={() => setChannelTab(item)} className={`rounded-lg px-4 py-2 text-sm border ${channelTab === item ? "border-[#00d4aa] bg-[#00d4aa]/10 text-white" : "border-[#2a3a4e] text-[#8890a8]"}`}>
                  {item === "email" ? "Почта" : item === "messenger" ? "Мессенджер" : "Видео"}
                </button>
              ))}
            </div>
            {channelTab === "email" && (
              <div className="grid gap-4 xl:grid-cols-[280px,minmax(0,1fr),360px]">
                <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-white">Письма</div>
                    <Button size="sm" onClick={() => openSignalWizard("email")}>Новое</Button>
                  </div>
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {contentQuery.data.emailCases.map((item: EmailCase) => (
                      <button key={item.id} onClick={() => setSelectedEmailId(item.id)} className={`w-full rounded-lg border px-3 py-2 text-left ${selectedEmailId === item.id ? "border-[#4a9eff] bg-[#4a9eff]/10" : "border-[#2a3a4e]"}`}>
                        <div className="text-sm text-white">{item.subject || item.id}</div>
                        <div className="text-xs text-[#8890a8]">{item.id}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                  {emailDraft && <EntityEditor title="Редактор письма" entity={emailDraft} assets={assets} competencies={competencies} caseSourceOptions={caseSourceOptions} emailSenderOptions={emailSenderOptions} emailDepartmentOptions={emailDepartmentOptions} messengerSenderOptions={messengerSenderOptions} messengerRoleOptions={messengerRoleOptions} videoSenderOptions={videoSenderOptions} videoRoleOptions={videoRoleOptions} onChange={setEmailDraft} onUploadAsset={handleUploadAsset} chats={[]} mode="email" onAddOption={() => addOption(setEmailDraft)} onTogglePreviewAudio={togglePreviewAudio} activePreviewKey={activePreviewKey} />}
                </div>
                <ChannelInfluencePanel entity={emailDraft} mode="email" data={channelDraftBarData} />
              </div>
            )}
            {channelTab === "messenger" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-white">Чаты мессенджера</div>
                    <Button size="sm" onClick={() => setChatDraft(createEmptyChat((contentQuery.data.messengerChats?.length || 0) + 1))}>Новый чат</Button>
                  </div>
                  <div className="dns-mobile-stack dns-admin-chat-grid grid gap-4">
                    <div className="space-y-2 max-h-[240px] overflow-y-auto">
                      {contentQuery.data.messengerChats.map((item: ChatInfo) => (
                        <button key={item.id} onClick={() => setSelectedChatId(item.id)} className={`w-full rounded-lg border px-3 py-2 text-left ${selectedChatId === item.id ? "border-[#00d4aa] bg-[#00d4aa]/10" : "border-[#2a3a4e]"}`}>
                          <div className="text-sm text-white">{item.name || item.id}</div>
                          <div className="text-xs text-[#8890a8]">{item.id}</div>
                        </button>
                      ))}
                    </div>
                    {chatDraft && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Порядок" value={chatDraft.sortOrder} onChange={(value) => setChatDraft((current) => current ? { ...current, sortOrder: Number(value) } : current)} />
                        <Field label="Название" value={chatDraft.name} onChange={(value) => setChatDraft((current) => current ? { ...current, name: value } : current)} />
                        <Field label="Аватар" value={chatDraft.avatar} onChange={(value) => setChatDraft((current) => current ? { ...current, avatar: value } : current)} />
                        <Field label="Роль" value={chatDraft.role || ""} onChange={(value) => setChatDraft((current) => current ? { ...current, role: value } : current)} />
                        <Field label="Иконка" value={chatDraft.icon || ""} onChange={(value) => setChatDraft((current) => current ? { ...current, icon: value } : current)} />
                        <Field label="Участники" value={(chatDraft.members || []).join(", ")} onChange={(value) => setChatDraft((current) => current ? { ...current, members: value.split(",").map((item) => item.trim()).filter(Boolean) } : current)} />
                        <div className="flex items-end gap-3">
                          <label className="flex items-center gap-2 text-sm text-white">
                            <input
                              type="checkbox"
                              checked={chatDraft.isGroup}
                              onChange={(e) => setChatDraft((current) => current ? { ...current, isGroup: e.target.checked } : current)}
                            />
                            Групповой чат
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Button size="sm" className="bg-[#00d4aa] hover:bg-[#00c39c] text-[#0d1117]" onClick={saveChatDraft}>
                      Сохранить чат
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#ff4444]/30 text-[#ff9999] bg-transparent" onClick={deleteChatDraft}>
                      Удалить чат
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-[280px,minmax(0,1fr),360px]">
                  <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-white">Сообщения</div>
                      <Button size="sm" onClick={() => openSignalWizard("messenger")}>Новое</Button>
                    </div>
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                      {contentQuery.data.messengerCases.map((item: MessengerCase) => (
                        <button key={item.id} onClick={() => setSelectedMessengerId(item.id)} className={`w-full rounded-lg border px-3 py-2 text-left ${selectedMessengerId === item.id ? "border-[#00d4aa] bg-[#00d4aa]/10" : "border-[#2a3a4e]"}`}>
                          <div className="text-sm text-white">{item.senderName || item.id}</div>
                          <div className="text-xs text-[#8890a8]">{item.id}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                    {messengerDraft && <EntityEditor title="Редактор сообщения" entity={messengerDraft} assets={assets} competencies={competencies} caseSourceOptions={caseSourceOptions} emailSenderOptions={emailSenderOptions} emailDepartmentOptions={emailDepartmentOptions} messengerSenderOptions={messengerSenderOptions} messengerRoleOptions={messengerRoleOptions} videoSenderOptions={videoSenderOptions} videoRoleOptions={videoRoleOptions} onChange={setMessengerDraft} onUploadAsset={handleUploadAsset} chats={chats} mode="messenger" onAddOption={() => addOption(setMessengerDraft)} onTogglePreviewAudio={togglePreviewAudio} activePreviewKey={activePreviewKey} />}
                  </div>
                  <ChannelInfluencePanel entity={messengerDraft} mode="messenger" data={channelDraftBarData} />
                </div>
              </div>
            )}
            {channelTab === "video" && (
              <div className="grid gap-4 xl:grid-cols-[280px,minmax(0,1fr),360px]">
                <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-white">Видео</div>
                    <Button size="sm" onClick={() => openSignalWizard("video")}>Новое</Button>
                  </div>
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {contentQuery.data.videoCases.map((item: VideoCase) => (
                      <button key={item.id} onClick={() => setSelectedVideoId(item.id)} className={`w-full rounded-lg border px-3 py-2 text-left ${selectedVideoId === item.id ? "border-[#a78bfa] bg-[#a78bfa]/10" : "border-[#2a3a4e]"}`}>
                        <div className="text-sm text-white">{item.title || item.id}</div>
                        <div className="text-xs text-[#8890a8]">{item.id}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                  {videoDraft && <EntityEditor title="Редактор видео-кейса" entity={videoDraft} assets={assets} competencies={competencies} caseSourceOptions={caseSourceOptions} emailSenderOptions={emailSenderOptions} emailDepartmentOptions={emailDepartmentOptions} messengerSenderOptions={messengerSenderOptions} messengerRoleOptions={messengerRoleOptions} videoSenderOptions={videoSenderOptions} videoRoleOptions={videoRoleOptions} onChange={setVideoDraft} onUploadAsset={handleUploadAsset} chats={[]} mode="video" onAddOption={() => addOption(setVideoDraft)} onTogglePreviewAudio={togglePreviewAudio} activePreviewKey={activePreviewKey} />}
                </div>
                <ChannelInfluencePanel entity={videoDraft} mode="video" data={channelDraftBarData} />
              </div>
            )}
          </div>
        )}

        {tab === "results" && (
          <div className="dns-mobile-stack dns-admin-results-grid grid gap-4">
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Результаты прохождений</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#2a3a4e] bg-transparent text-[#8890a8]"
                  onClick={exportResultsExcel}
                  disabled={excelLoading}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {excelLoading ? "Экспорт..." : "Excel"}
                </Button>
              </div>
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-[#8890a8] mb-1.5 block">Статус</Label>
                  <select
                    value={resultStatusFilter}
                    onChange={(e) => setResultStatusFilter(e.target.value)}
                    className="w-full rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
                  >
                    <option value="">Все</option>
                    <option value="in_progress">В процессе</option>
                    <option value="completed">Завершено</option>
                    <option value="interrupted">Прервано</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-[#8890a8] mb-1.5 block">Участник</Label>
                  <Input
                    value={resultParticipantFilter}
                    onChange={(e) => setResultParticipantFilter(e.target.value)}
                    className="bg-[#141c2b] border-[#2a3a4e] text-white"
                    placeholder="ФИО"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                {(resultsQuery.data || []).map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedResultId(item.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left ${selectedResultId === item.id ? "border-[#00d4aa] bg-[#00d4aa]/10" : "border-[#2a3a4e] bg-[#141c2b]/50"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm text-white">{item.participantName}</div>
                        <div className="text-xs text-[#8890a8]">{item.startedAt} • {formatTechnicalStatus(item.technicalStatus)}</div>
                        </div>
                      <div className="text-right">
                        <div className="text-sm text-white">Баллы: {item.totalScore}</div>
                        <div className="text-xs text-[#8890a8]">Средний: {item.averageScore}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
              {!selectedResultId && (
                <div className="text-sm text-[#8890a8]">Выберите результат слева, чтобы открыть детали прохождения.</div>
              )}
              {selectedResultId && resultDetailQuery.isLoading && (
                <div className="text-sm text-[#8890a8]">Загрузка деталей результата...</div>
              )}
              {resultDetailQuery.data && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-lg font-semibold text-white">{resultDetailQuery.data.session.participantName}</div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-[#8890a8]">
                        Оценщик: {resultDetailQuery.data.session.evaluatorName || "—"} • {formatTechnicalStatus(resultDetailQuery.data.session.technicalStatus)}
                      </div>
                      <Button size="sm" variant="outline" className="border-[#2a3a4e] bg-transparent text-[#8890a8]" onClick={exportSelectedResultPdf} disabled={pdfLoading || !selectedResultReport}>
                        {pdfLoading ? "PDF..." : "Скачать PDF"}
                      </Button>
                      <Button size="sm" variant="outline" className="border-[#2a3a4e] bg-transparent text-[#8890a8]" onClick={exportSelectedResult}>
                        Экспорт в JSON
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/50 p-3">
                      <div className="text-xs text-[#8890a8] mb-1">Старт</div>
                      <div className="text-sm text-white">{resultDetailQuery.data.session.startedAt}</div>
                    </div>
                    <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/50 p-3">
                      <div className="text-xs text-[#8890a8] mb-1">Завершение</div>
                      <div className="text-sm text-white">{resultDetailQuery.data.session.completedAt || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/50 p-3">
                      <div className="text-xs text-[#8890a8] mb-1">Итог</div>
                      <div className="text-sm text-white">
                        {resultDetailQuery.data.result?.totalScore || 0} / {resultDetailQuery.data.result?.averageScore || 0}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Портрет компетенций: НАДО и ФАКТ</div>
                        <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
                          Синий контур показывает ожидаемый профиль по текущему набору кейсов. Зелёный контур показывает фактический результат по выбранному прохождению.
                        </div>
                      </div>
                      <div className="rounded-full border border-[#2a3a4e] bg-[#101826]/80 px-3 py-1 text-[11px] text-[#dbe2f0]">
                        {selectedResultSummary
                          ? `${selectedResultSummary.participantName} • ${selectedResultSummary.technicalStatus || "completed"}`
                          : "Без результата"}
                      </div>
                    </div>
                    <div className="mt-4 h-[340px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarChartData} outerRadius="72%">
                          <PolarGrid stroke="#273449" />
                          <PolarAngleAxis dataKey="competency" tick={{ fill: "#a7b7cf", fontSize: 10 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "#5e7492", fontSize: 10 }} />
                          <RechartsTooltip
                            contentStyle={{ background: "#101826", border: "1px solid #2a3a4e", borderRadius: 12 }}
                            labelStyle={{ color: "#fff" }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Radar name="НАДО" dataKey="target" stroke="#4a9eff" fill="#4a9eff" fillOpacity={0.12} strokeWidth={2} />
                          <Radar name="ФАКТ" dataKey="fact" stroke="#00d4aa" fill="#00d4aa" fillOpacity={0.12} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                      {selectedResultSummary
                        ? `Сейчас сравнивается ожидаемый портрет с результатом участника ${selectedResultSummary.participantName}.`
                        : "Результат пока не выбран: график НАДО уже показывает ожидаемый профиль симуляции."}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/50 p-4">
                    <div className="text-sm font-semibold text-white mb-3">Ответы</div>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto">
                      {(resultDetailQuery.data.answers || []).map((answer: any) => (
                        <div key={answer.id} className="rounded-lg border border-[#2a3a4e] bg-[#0f1724]/60 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm text-white">{answer.caseTitle}</div>
                              <div className="text-xs text-[#8890a8]">{answer.details?.channelLabel || answer.sourceType} • {answer.simTime}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-white">{answer.score}</div>
                              {(answer.details?.timerPenalty ?? 0) > 0 && (
                                <div className="text-[10px] text-[#ff8080]">штраф: -{answer.details.timerPenalty}</div>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-[#aab2c5]">{answer.optionText}</div>
                          {answer.details?.timer?.label && (
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#8fa6c7]">
                              <span className="rounded-full border border-[#2a3a4e] px-2 py-1">
                                Таймер: {answer.details.timer.label}
                              </span>
                              <span className="rounded-full border border-[#2a3a4e] px-2 py-1">
                                Зона: {answer.details?.zoneLabel || "—"}
                              </span>
                              <span className="rounded-full border border-[#2a3a4e] px-2 py-1">
                                Ответственный: {answer.details?.responsibility || "—"}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr),420px]">
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
              <div className="text-sm font-semibold text-white mb-4">Параметры симуляции</div>
              <div className="grid gap-4 md:grid-cols-2">
                {SETTINGS_FIELD_INFO.map((field) => (
                  <div key={field.key} className="rounded-xl border border-[#243244] bg-[#141c2b]/45 p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <Label className="text-xs text-[#dbe2f0] block">{field.label}</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-[#6fa0ff]">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs border-[#2a3a4e] bg-[#101826] text-[#dbe2f0]">
                          <div className="space-y-2 text-xs">
                            <div className="font-semibold text-white">{field.shortName}</div>
                            <div>{field.description}</div>
                            <div className="text-[#9fb4d1]">{field.effect}</div>
                            <div>{field.downExample}</div>
                            <div>{field.upExample}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      value={String(settingsDraft[field.key] ?? "")}
                      onChange={(e) => setSettingsDraft((current) => ({ ...current, [field.key]: Number(e.target.value) }))}
                      className="bg-[#141c2b] border-[#2a3a4e] text-white"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-[#243244] bg-[#141c2b]/45 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Вес каждого кейса</div>
                    <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
                      Вместо ручной настройки каждой компетенции для всей симуляции вы задаёте вес кейса целиком.
                      Чем выше вес, тем сильнее именно этот кейс влияет на итоговый портрет кандидата.
                    </div>
                  </div>
                  <label className="flex items-center gap-2 rounded-full border border-[#2a3a4e] bg-[#101826]/70 px-3 py-2 text-xs text-[#dbe2f0]">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsDraft.timeInfluenceEnabled)}
                      onChange={(e) => setSettingsDraft((current) => ({
                        ...current,
                        timeInfluenceEnabled: e.target.checked,
                      }))}
                      className="h-4 w-4 rounded border-[#3b4b61] bg-[#141c2b]"
                    />
                    Влияние времени на итоговую оценку
                  </label>
                </div>

                <div className="space-y-3">
                  {activeCases.map((caseItem) => {
                    const weightValue = getCaseWeightValue(caseWeightsDraft, caseItem.id);
                    const isSelected = selectedWeightCase?.id === caseItem.id;

                    return (
                      <div
                        key={caseItem.id}
                        onClick={() => setSelectedWeightCaseId(caseItem.id)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? "border-[#4a9eff]/50 bg-[#4a9eff]/10"
                            : "border-[#243244] bg-[#101826]/70 hover:border-[#34506f]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-[0.18em] text-[#6fa0ff]">{caseItem.id}</div>
                            <div className="mt-1 text-sm font-semibold text-white">{caseItem.title}</div>
                            <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#8aa2c4]">
                              {caseItem.description}
                            </div>
                          </div>
                          <div className="rounded-full border border-[#2a3a4e] bg-[#141c2b]/70 px-3 py-1 text-sm font-semibold text-white">
                            {weightValue}%
                          </div>
                        </div>
                        <div className="mt-3 px-1">
                          <Slider
                            value={[weightValue]}
                            onValueChange={([nextValue]) => updateCaseWeight(caseItem.id, nextValue)}
                            min={0}
                            max={100}
                            step={10}
                          />
                          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.16em] text-[#71839d]">
                            <span>0</span>
                            <span>50</span>
                            <span>100</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#243244] bg-[#141c2b]/45 p-4">
                <div className="text-sm font-semibold text-white mb-4">Системные медиа</div>
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6fa0ff]">Экран ожидания</div>
                    <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
                      <select
                        value={settingsDraft.waitingImageAssetId || ""}
                        onChange={(e) => setSettingsDraft((current) => ({ ...current, waitingImageAssetId: e.target.value || null }))}
                        className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
                      >
                        <option value="">Стандартное изображение ожидания</option>
                        {imageAssets.map((asset: any) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                      </select>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="bg-[#141c2b] border-[#2a3a4e] text-white"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const assetId = await handleUploadAsset(file);
                          if (assetId) {
                            setSettingsDraft((current) => ({ ...current, waitingImageAssetId: assetId }));
                          }
                        }}
                      />
                    </div>
                    {settingsDraft.waitingImageAssetId && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-[#2a3a4e]">
                        <img
                          src={imageAssets.find((asset: any) => asset.id === settingsDraft.waitingImageAssetId)?.publicUrl}
                          alt="Экран ожидания"
                          className="h-32 w-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {[
                    { key: "callSoundAssetId", label: "Звонок", hint: "Основной сигнал входящего звонка" },
                    { key: "emailSoundAssetId", label: "Почта", hint: "Одиночный сигнал корпоративной почты" },
                    { key: "messengerSoundAssetId", label: "ТёркоГрамм", hint: "Короткий сигнал и повтор “пилик-пилик”" },
                    { key: "videoSoundAssetId", label: "Видео", hint: "Сигнал видеовызова" },
                  ].map((field) => {
                    const channel = getSystemSoundChannel(field.key as SystemSoundSettingKey);
                    const assetOptions: SignalSoundOption[] = audioAssets.map((asset: any) => ({
                      value: asset.id,
                      label: asset.name,
                      description: "Загруженный аудиофайл из медиатеки",
                      isPreset: false,
                    }));
                    const soundOptions = getSignalSoundOptions(channel, assetOptions);
                    const selectedOption = soundOptions.find((option) => option.value === settingsDraft[field.key]);
                    const previewKey = `settings:${field.key}`;
                    const isPreviewActive = activePreviewKey === previewKey;
                    const previewUrl = resolveChannelSoundSource(settingsDraft[field.key], channel);

                    return (
                      <div key={field.key} className={`rounded-xl border p-3 ${isPreviewActive ? "border-[#00d4aa]/40 bg-[#00d4aa]/8" : "border-[#243244] bg-[#101826]/70"}`}>
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-[#6fa0ff]">{field.label}</div>
                            <div className="mt-1 text-[11px] text-[#8aa2c4]">{field.hint}</div>
                            {selectedOption && (
                              <div className="mt-1 text-[11px] text-[#d9e2f3]">{selectedOption.description}</div>
                            )}
                          </div>
                          {isPreviewActive && (
                            <span className="rounded-full bg-[#00d4aa]/16 px-2 py-1 text-[10px] font-semibold text-[#00d4aa]">
                              Играет
                            </span>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
                          <select
                            value={settingsDraft[field.key] || ""}
                            onChange={(e) => setSettingsDraft((current) => ({ ...current, [field.key]: e.target.value || null }))}
                            className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
                          >
                            <option value="">Сигнал по умолчанию</option>
                            {soundOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <Input
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/x-m4a,audio/aac"
                            className="bg-[#141c2b] border-[#2a3a4e] text-white"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const assetId = await handleUploadAsset(file);
                              if (assetId) {
                                setSettingsDraft((current) => ({ ...current, [field.key]: assetId }));
                              }
                            }}
                          />
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#00d4aa] text-[#0d1117] hover:bg-[#00c39c]"
                            onClick={() => togglePreviewAudio(previewKey, previewUrl)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Плей
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-[#2a3a4e] bg-transparent text-[#8890a8]"
                            onClick={() => isPreviewActive && togglePreviewAudio(previewKey, previewUrl)}
                          >
                            <Pause className="mr-2 h-4 w-4" />
                            Пауза
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#243244] bg-[#141c2b]/45 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white">Инструктаж перед стартом</div>
                    <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
                      HTML-инструкция показывается космонавту до начала симуляции.
                      Поддерживаются базовые теги `section`, `h1-h4`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `a`, `video`, `source`.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[#2a3a4e] bg-transparent text-[#8890a8]"
                      onClick={() => setSettingsDraft((current) => ({
                        ...current,
                        preSimulationInstructionHtml: DEFAULT_SIMULATION_BRIEFING_HTML,
                      }))}
                    >
                      Шаблон
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[#2a3a4e] bg-transparent text-[#8890a8]"
                      onClick={() => setSettingsDraft((current) => {
                        const currentHtml = String(current.preSimulationInstructionHtml || "");
                        if (currentHtml.includes(SIMULATION_BRIEFING_VIDEO_PLACEHOLDER)) {
                          return current;
                        }

                        return {
                          ...current,
                          preSimulationInstructionHtml: `${currentHtml.trim()}\n\n${SIMULATION_BRIEFING_VIDEO_SNIPPET}`.trim(),
                        };
                      })}
                    >
                      Вставить видео-блок
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,auto]">
                  <select
                    value={settingsDraft.preSimulationInstructionVideoAssetId || ""}
                    onChange={(e) => setSettingsDraft((current) => ({
                      ...current,
                      preSimulationInstructionVideoAssetId: e.target.value || null,
                    }))}
                    className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
                  >
                    <option value="">Без видеоинструктажа</option>
                    {videoAssets.map((asset: any) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                  </select>
                  <Input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="bg-[#141c2b] border-[#2a3a4e] text-white"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const assetId = await handleUploadAsset(file);
                      if (assetId) {
                        setSettingsDraft((current) => ({
                          ...current,
                          preSimulationInstructionVideoAssetId: assetId,
                        }));
                      }
                    }}
                  />
                </div>

                {settingsDraft.preSimulationInstructionVideoAssetId && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-[#2a3a4e] bg-black/30">
                    <video
                      src={videoAssets.find((asset: any) => asset.id === settingsDraft.preSimulationInstructionVideoAssetId)?.publicUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-48 w-full bg-black object-contain"
                    />
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-[#29425f] bg-[#122031] px-3 py-3 text-[11px] leading-5 text-[#cbd8ef]">
                  Маркер для встраивания ролика в нужное место HTML: <code>{SIMULATION_BRIEFING_VIDEO_PLACEHOLDER}</code>
                  <br />
                  Если маркер не указан, выбранное видео будет добавлено в конец инструкции автоматически.
                </div>

                <Textarea
                  value={String(settingsDraft.preSimulationInstructionHtml ?? "")}
                  onChange={(e) => setSettingsDraft((current) => ({
                    ...current,
                    preSimulationInstructionHtml: e.target.value,
                  }))}
                  className="mt-4 min-h-[320px] border-[#2a3a4e] bg-[#141c2b] font-mono text-[12px] leading-6 text-white"
                />

                <div className="mt-3 rounded-xl border border-[#29425f] bg-[#122031] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8ec5ff]">Пример блока с видео</div>
                  <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#d6e3f7]">
                    {SIMULATION_BRIEFING_VIDEO_SNIPPET}
                  </pre>
                </div>

                <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6fa0ff]">Предпросмотр</div>
                  <div
                    className="space-y-4 text-sm leading-relaxed text-[#c9d2e6] [&_a]:text-[#8ec5ff] [&_a]:underline [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.16em] [&_h3]:text-[#8ec5ff] [&_li+li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_section+section]:mt-5 [&_section]:rounded-xl [&_section]:border [&_section]:border-[#2a3a4e] [&_section]:bg-[#141c2b]/70 [&_section]:p-4 [&_ul]:list-disc [&_ul]:pl-5 [&_video]:mt-3 [&_video]:w-full [&_video]:rounded-xl [&_video]:border [&_video]:border-[#31455f] [&_video]:bg-black"
                    dangerouslySetInnerHTML={{
                      __html: resolveSimulationBriefingHtml({
                        instructionHtml: settingsDraft.preSimulationInstructionHtml,
                        instructionVideoAssetId: settingsDraft.preSimulationInstructionVideoAssetId,
                        assets,
                      }),
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Влияние выбранного кейса</div>
                    <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
                      График показывает общий профиль симуляции по всем кейсам и вклад кейса, который вы сейчас настраиваете.
                    </div>
                  </div>
                  {selectedWeightCase && (
                    <div className="rounded-full border border-[#2a3a4e] bg-[#101826]/80 px-3 py-1 text-[11px] text-[#dbe2f0]">
                      {selectedWeightCase.id} • {selectedCaseWeight}%
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <CompetencyHorizontalImpactChart
                    data={aggregateBarData}
                    series={[
                      { key: "aggregate", label: "Все кейсы", color: "#4a9eff" },
                      { key: "selected", label: "Выбранный", color: "#00d4aa" },
                    ]}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4">
                <div className="text-sm font-semibold text-white">Автоматическая оценка ожиданий</div>
                <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
                  Система смотрит на суммарный вес кейсов и среднюю требовательность по компетенциям, после чего оценивает общий уровень ожиданий к студенту.
                </div>
                <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[#6fa0ff]">Уровень ожиданий</div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {EXPECTATION_LABELS[expectationLevel - 1]}
                  </div>
                  <div className="mt-2 text-sm text-[#c9d2e6]">
                    Шкала {expectationLevel} из 10
                  </div>
                  <div className="mt-4 grid grid-cols-10 gap-1.5">
                    {EXPECTATION_LABELS.map((_, index) => {
                      const level = index + 1;
                      const active = level <= expectationLevel;
                      return (
                        <div
                          key={level}
                          className={`h-3 rounded-full ${active ? "bg-[#4a9eff]" : "bg-[#233246]"}`}
                          title={`Уровень ${level}`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {(["easy", "medium", "hard"] as const).map((difficultyKey) => {
                    const profile = TIME_PROFILE_CONFIG[difficultyKey];
                    const isRecommended = recommendedDifficulty === difficultyKey;
                    const coefficientLabel =
                      difficultyKey === "hard"
                        ? "+8% к итоговой оценке"
                        : difficultyKey === "easy"
                        ? "-5% к итоговой оценке"
                        : "Без поправки к итоговой оценке";

                    return (
                      <div
                        key={difficultyKey}
                        className={`rounded-xl border p-3 ${
                          isRecommended
                            ? "border-[#00d4aa]/40 bg-[#00d4aa]/10"
                            : "border-[#243244] bg-[#101826]/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{profile.label}</div>
                            <div className="mt-1 text-[11px] text-[#8aa2c4]">{profile.recommendation}</div>
                          </div>
                          {isRecommended && (
                            <span className="rounded-full bg-[#00d4aa]/16 px-2 py-1 text-[10px] font-semibold text-[#00d4aa]">
                              Рекомендуется
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-[11px] leading-relaxed text-[#dbe2f0]">
                          {coefficientLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                  {settingsDraft.timeInfluenceEnabled
                    ? "Влияние времени включено: при сложном профиле итоговые компетенции усиливаются, при лёгком профиле слегка снижаются."
                    : "Влияние времени сейчас выключено: рекомендации по времени показываются как ориентир и не меняют финальную оценку."}
                </div>
              </div>

              <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4">
                <div className="text-sm font-semibold text-white mb-3">Краткая справка по параметрам</div>
                <div className="space-y-3 max-h-[32vh] overflow-y-auto pr-1 custom-scroll">
                  {SETTINGS_FIELD_INFO.map((field) => (
                    <div key={field.key} className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#6fa0ff]">{field.shortName}</div>
                      <div className="mt-1 text-sm text-white">{field.label}</div>
                      <div className="mt-2 text-xs leading-relaxed text-[#b8c5db]">{field.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <CaseCreationWizard
          open={caseWizardOpen}
          step={caseWizardStep}
          draft={caseWizardDraft}
          competencies={competencies}
          caseSourceOptions={caseSourceOptions}
          onOpenChange={setCaseWizardOpen}
          onStepChange={setCaseWizardStep}
          onDraftChange={setCaseWizardDraft}
          onConfirm={confirmCaseWizard}
        />
        <SignalCreationWizard
          open={signalWizardOpen}
          mode={signalWizardMode}
          step={signalWizardStep}
          draft={signalWizardDraft}
          competencies={competencies}
          chats={chats}
          emailSenderOptions={emailSenderOptions}
          emailDepartmentOptions={emailDepartmentOptions}
          messengerSenderOptions={messengerSenderOptions}
          messengerRoleOptions={messengerRoleOptions}
          videoSenderOptions={videoSenderOptions}
          videoRoleOptions={videoRoleOptions}
          onOpenChange={setSignalWizardOpen}
          onStepChange={setSignalWizardStep}
          onDraftChange={setSignalWizardDraft}
          onConfirm={confirmSignalWizard}
        />

        <div className="flex gap-3 mt-6">
          <Button className="bg-[#FF6B00] hover:bg-[#e06000]" onClick={saveCurrent} disabled={saving || uploading}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
          {(tab === "cases" || tab === "channels") && (
            <Button variant="outline" className="border-[#ff4444]/30 text-[#ff9999] bg-transparent" onClick={handleDeleteCurrent}>
              Удалить
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EntityEditor({
  title,
  entity,
  assets,
  competencies,
  chats,
  caseSourceOptions,
  emailSenderOptions,
  emailDepartmentOptions,
  messengerSenderOptions,
  messengerRoleOptions,
  videoSenderOptions,
  videoRoleOptions,
  onChange,
  onUploadAsset,
  mode,
  onAddOption,
  onTogglePreviewAudio,
  activePreviewKey,
}: {
  title: string;
  entity: any;
  assets: any[];
  competencies: CompetencyDefinition[];
  chats: ChatInfo[];
  caseSourceOptions: string[];
  emailSenderOptions: string[];
  emailDepartmentOptions: string[];
  messengerSenderOptions: string[];
  messengerRoleOptions: string[];
  videoSenderOptions: string[];
  videoRoleOptions: string[];
  onChange: (value: any) => void;
  onUploadAsset: (file: File) => Promise<string | null>;
  mode: "case" | "email" | "messenger" | "video";
  onAddOption: () => void;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
}) {
  const imageAssets = assets.filter((asset) => asset.kind === "image");
  const audioAssets = assets.filter((asset) => asset.kind === "audio");
  const videoAssets = assets.filter((asset) => asset.kind === "video");
  const selectedAudioAsset = audioAssets.find((asset) => asset.id === entity.audioAssetId);
  const selectedVideoAsset = videoAssets.find((asset) => asset.id === entity.videoAssetId);
  const previewAudioUrl = selectedAudioAsset?.publicUrl || getPreviewAudioUrl(entity.id, mode);
  const previewKey = `${mode}:${entity.id}`;
  const isPreviewActive = activePreviewKey === previewKey;
  const competencyOptions = competencies.map((competency) => ({
    value: competency.id,
    label: competency.name,
  }));

  const update = (patch: Record<string, any>) => onChange({ ...entity, ...patch });
  const updateTiming = (patch: Record<string, number | null>) => {
    update({
      timing: {
        ...entity.timing,
        ...(mode === "case" ? {} : { arrivalMinute: entity.arrivalMinute }),
        ...patch,
      },
    });
  };
  const timingTitle = mode === "case"
    ? "Тайминг основного кейса"
    : mode === "email"
    ? "Тайминг письма"
    : mode === "messenger"
    ? "Тайминг сообщения"
    : "Тайминг видеозвонка";
  const timingHelper = mode === "case"
    ? "Регулирует паузы между основными событиями, срок решения и повторное напоминание участнику."
    : "Регулирует минуту появления канального события, срок решения и повторное напоминание участнику.";
  const audioTitle = mode === "email"
    ? "Аудио письма"
    : mode === "messenger"
    ? "Аудиосообщение"
    : mode === "video"
    ? "Озвучка видео"
    : "Озвучка кейса";

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <Field label="Порядок показа" value={entity.sortOrder} onChange={(value) => update({ sortOrder: Number(value) })} />
      <div className="rounded-2xl border border-[#FF6B00]/35 bg-gradient-to-br from-[#FF6B00]/14 via-[#1a2537]/88 to-[#101826]/92 p-4 shadow-[0_18px_45px_rgba(255,107,0,0.12)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb27a]">Настройки хода симуляции</div>
            <div className="mt-1 text-base font-bold text-white">{timingTitle}</div>
            <div className="mt-1 max-w-2xl text-xs leading-relaxed text-[#b8c7df]">{timingHelper}</div>
          </div>
          <div className="rounded-full border border-[#FF6B00]/35 bg-[#FF6B00]/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb27a]">
            Видно сразу
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {mode !== "case" && (
            <Field
              label="Минута прихода"
              value={entity.timing?.arrivalMinute ?? entity.arrivalMinute ?? ""}
              onChange={(value) => {
                const nextValue = value ? Number(value) : 0;
                update({
                  arrivalMinute: nextValue,
                  timing: {
                    ...entity.timing,
                    arrivalMinute: value ? nextValue : null,
                  },
                });
              }}
            />
          )}
          {mode === "case" && (
            <>
              <Field
                label="Мин. интервал, сек"
                value={entity.timing?.minIntervalSeconds ?? ""}
                onChange={(value) => updateTiming({ minIntervalSeconds: value ? Number(value) : null })}
              />
              <Field
                label="Макс. интервал, сек"
                value={entity.timing?.maxIntervalSeconds ?? ""}
                onChange={(value) => updateTiming({ maxIntervalSeconds: value ? Number(value) : null })}
              />
            </>
          )}
          <Field
            label="Срок решения, сек"
            value={entity.timing?.decisionDeadlineSeconds ?? ""}
            onChange={(value) => updateTiming({ decisionDeadlineSeconds: value ? Number(value) : null })}
          />
          <Field
            label="Повтор напоминания, сек"
            value={entity.timing?.reminderIntervalSeconds ?? (mode === "messenger" ? 5 : 180)}
            onChange={(value) => updateTiming({ reminderIntervalSeconds: value ? Number(value) : null })}
          />
          {mode !== "case" && (
            <div className="rounded-xl border border-[#30445f] bg-[#101826]/75 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8ec5ff]">Канал</div>
              <div className="mt-1 text-sm font-semibold text-white">
                {mode === "email" ? "Почта" : mode === "messenger" ? "Мессенджер" : "Видео звонок"}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-[#8aa2c4]">Эти значения применяются без изменения текста и вариантов ответа.</div>
            </div>
          )}
        </div>
      </div>
      {mode === "case" && (
        <>
          <Field label="Название" value={entity.title} onChange={(value) => update({ title: value })} />
          <FieldArea label="Описание" value={entity.description} onChange={(value) => update({ description: value })} />
          <div className="grid gap-4 md:grid-cols-3">
            <SuggestField label="Источник сигнала" value={entity.trigger.source} onChange={(value) => update({ trigger: { ...entity.trigger, source: value } })} options={caseSourceOptions} />
            <SelectField label="Тип сигнала" value={entity.trigger.type} onChange={(value) => update({ trigger: { ...entity.trigger, type: value } })} options={[...CASE_SIGNAL_TYPE_OPTIONS]} />
            <MultiSelectField label="Зоны магазина" values={entity.zones_affected || []} onChange={(values) => update({ zones_affected: values })} options={[...STORE_ZONE_OPTIONS]} />
          </div>
          <FieldArea label="Текст сигнала" value={entity.trigger.text} onChange={(value) => update({ trigger: { ...entity.trigger, text: value } })} />
          <MultiSelectField label="Основные компетенции" values={entity.primaryCompetencies || []} onChange={(values) => update({ primaryCompetencies: values })} options={competencyOptions} />
          <MultiSelectField label="Вторичные компетенции" values={entity.secondaryCompetencies || []} onChange={(values) => update({ secondaryCompetencies: values })} options={competencyOptions} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Мин. интервал, сек" value={entity.timing?.minIntervalSeconds ?? ""} onChange={(value) => update({ timing: { ...entity.timing, minIntervalSeconds: value ? Number(value) : null } })} />
            <Field label="Макс. интервал, сек" value={entity.timing?.maxIntervalSeconds ?? ""} onChange={(value) => update({ timing: { ...entity.timing, maxIntervalSeconds: value ? Number(value) : null } })} />
            <Field label="Срок решения, сек" value={entity.timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...entity.timing, decisionDeadlineSeconds: value ? Number(value) : null } })} />
            <Field label="Повтор, сек" value={entity.timing?.reminderIntervalSeconds ?? 180} onChange={(value) => update({ timing: { ...entity.timing, reminderIntervalSeconds: value ? Number(value) : null } })} />
          </div>
          <StructuredCyclesEditor
            cycles={entity.cycles || []}
            competencies={competencies}
            onChange={(cycles) => update({ cycles })}
          />
        </>
      )}
      {mode === "email" && (
        <>
          <Field label="Тема" value={entity.subject} onChange={(value) => update({ subject: value })} />
          <SuggestField label="Отправитель" value={entity.from} onChange={(value) => update({ from: value })} options={emailSenderOptions} />
          <div className="grid gap-4 md:grid-cols-3">
            <SuggestField label="Подразделение" value={entity.department} onChange={(value) => update({ department: value })} options={emailDepartmentOptions} />
            <Field label="Цвет отдела" value={entity.departmentColor} onChange={(value) => update({ departmentColor: value })} />
            <Field label="Минута прихода" value={entity.arrivalMinute} onChange={(value) => update({ arrivalMinute: Number(value) })} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Повтор, сек" value={entity.timing?.reminderIntervalSeconds ?? 180} onChange={(value) => update({ timing: { ...entity.timing, arrivalMinute: entity.arrivalMinute, reminderIntervalSeconds: value ? Number(value) : null } })} />
            <Field label="Срок решения, сек" value={entity.timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...entity.timing, arrivalMinute: entity.arrivalMinute, decisionDeadlineSeconds: value ? Number(value) : null } })} />
            <Field label="Переопределение минуты прихода" value={entity.timing?.arrivalMinute ?? entity.arrivalMinute ?? ""} onChange={(value) => update({ arrivalMinute: Number(value), timing: { ...entity.timing, arrivalMinute: value ? Number(value) : null } })} />
          </div>
          <SelectField
            label="Компетенция"
            value={entity.primaryCompetency}
            onChange={(value) => update({ primaryCompetency: value })}
            options={competencyOptions}
          />
          <FieldArea label="Короткое превью письма" value={entity.preview} onChange={(value) => update({ preview: value })} />
          <FieldArea label="Тело письма" value={entity.body} onChange={(value) => update({ body: value })} />
          <StructuredOptionsEditor
            title="Варианты ответа"
            options={entity.options || []}
            competencies={competencies}
            onChange={(options) => update({ options })}
          />
        </>
      )}
      {mode === "messenger" && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <SuggestField label="Отправитель" value={entity.senderName} onChange={(value) => update({ senderName: value })} options={messengerSenderOptions} />
            <SuggestField label="Роль" value={entity.senderRole} onChange={(value) => update({ senderRole: value })} options={messengerRoleOptions} />
            <Field label="Аватар" value={entity.senderAvatar} onChange={(value) => update({ senderAvatar: value })} />
            <Field label="Минута прихода" value={entity.arrivalMinute} onChange={(value) => update({ arrivalMinute: Number(value) })} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Повтор, сек" value={entity.timing?.reminderIntervalSeconds ?? 10} onChange={(value) => update({ timing: { ...entity.timing, arrivalMinute: entity.arrivalMinute, reminderIntervalSeconds: value ? Number(value) : null } })} />
            <Field label="Срок решения, сек" value={entity.timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...entity.timing, arrivalMinute: entity.arrivalMinute, decisionDeadlineSeconds: value ? Number(value) : null } })} />
            <Field label="Переопределение минуты прихода" value={entity.timing?.arrivalMinute ?? entity.arrivalMinute ?? ""} onChange={(value) => update({ arrivalMinute: Number(value), timing: { ...entity.timing, arrivalMinute: value ? Number(value) : null } })} />
          </div>
          <Label className="text-xs text-[#8890a8] block">Чат</Label>
          <select value={entity.chatId} onChange={(e) => update({ chatId: e.target.value })} className="w-full rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white">
            <option value="">Выберите чат</option>
            {chats.map((chat) => <option key={chat.id} value={chat.id}>{chat.name}</option>)}
          </select>
          <SelectField
            label="Компетенция"
            value={entity.primaryCompetency}
            onChange={(value) => update({ primaryCompetency: value })}
            options={competencyOptions}
          />
          <FieldArea label="Сообщение" value={entity.message} onChange={(value) => update({ message: value })} />
          <StructuredOptionsEditor
            title="Варианты ответа"
            options={entity.options || []}
            competencies={competencies}
            onChange={(options) => update({ options })}
          />
        </>
      )}
      {mode === "video" && (
        <>
          <Field label="Заголовок" value={entity.title} onChange={(value) => update({ title: value })} />
          <div className="grid gap-4 md:grid-cols-3">
            <SuggestField label="Отправитель" value={entity.sender} onChange={(value) => update({ sender: value })} options={videoSenderOptions} />
            <SuggestField label="Роль" value={entity.role} onChange={(value) => update({ role: value })} options={videoRoleOptions} />
            <Field label="Аватар" value={entity.senderAvatar} onChange={(value) => update({ senderAvatar: value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Длительность" value={entity.duration} onChange={(value) => update({ duration: value })} />
            <Field label="Минута прихода" value={entity.arrivalMinute} onChange={(value) => update({ arrivalMinute: Number(value) })} />
            <SelectField
              label="Компетенция"
              value={entity.primaryCompetency}
              onChange={(value) => update({ primaryCompetency: value })}
              options={competencyOptions}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Повтор, сек" value={entity.timing?.reminderIntervalSeconds ?? 180} onChange={(value) => update({ timing: { ...entity.timing, arrivalMinute: entity.arrivalMinute, reminderIntervalSeconds: value ? Number(value) : null } })} />
            <Field label="Срок решения, сек" value={entity.timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...entity.timing, arrivalMinute: entity.arrivalMinute, decisionDeadlineSeconds: value ? Number(value) : null } })} />
            <Field label="Переопределение минуты прихода" value={entity.timing?.arrivalMinute ?? entity.arrivalMinute ?? ""} onChange={(value) => update({ arrivalMinute: Number(value), timing: { ...entity.timing, arrivalMinute: value ? Number(value) : null } })} />
          </div>
          <FieldArea label="Ситуация" value={entity.situation} onChange={(value) => update({ situation: value })} />
          <StructuredOptionsEditor
            title="Варианты ответа"
            options={entity.options || []}
            competencies={competencies}
            onChange={(options) => update({ options })}
          />
        </>
      )}

      {mode === "video" ? (
        <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-4">
          <div className="text-xs font-semibold text-[#8890a8] mb-3 uppercase tracking-wider">Видеофайл</div>
          <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
            <select
              value={entity.videoAssetId || ""}
              onChange={(e) => update({ videoAssetId: e.target.value || null, imageAssetId: null })}
              className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
            >
              <option value="">Без видеофайла</option>
              {videoAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="bg-[#141c2b] border-[#2a3a4e] text-white"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const assetId = await onUploadAsset(file);
                if (assetId) update({ videoAssetId: assetId, imageAssetId: null });
              }}
            />
          </div>
          <div className="mt-2 text-[11px] text-[#8fa0b8]">
            Если видео не выбрано, в симуляции останется цифровой аватар.
          </div>
          <div className="mt-2 rounded-xl border border-[#29425f] bg-[#122031] px-3 py-2 text-[11px] leading-5 text-[#cbd8ef]">
            Рекомендуемый формат: `MP4`, горизонтальное `16:9`, лучше всего `1280x720` или `1920x1080`.
            Видео в симуляции теперь показывается целиком без обрезки, поэтому важно оставлять лицо и ключевой контент в центре кадра.
            Допустимый размер файла до `150 MB`.
          </div>
          {selectedVideoAsset?.publicUrl && (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#2a3a4e] bg-black/30">
              <video
                src={selectedVideoAsset.publicUrl}
                controls
                playsInline
                preload="metadata"
                className="h-48 w-full bg-black object-contain"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-4">
          <div className="text-xs font-semibold text-[#8890a8] mb-3 uppercase tracking-wider">Изображение</div>
          <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
            <select value={entity.imageAssetId || ""} onChange={(e) => update({ imageAssetId: e.target.value || null })} className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white">
              <option value="">Без изображения</option>
              {imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Input type="file" accept="image/png,image/jpeg,image/webp" className="bg-[#141c2b] border-[#2a3a4e] text-white" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const assetId = await onUploadAsset(file);
              if (assetId) update({ imageAssetId: assetId });
            }} />
          </div>
        </div>
      )}

      <div className={`rounded-lg border p-4 ${isPreviewActive ? "border-[#00d4aa]/40 bg-[#00d4aa]/8" : "border-[#2a3a4e] bg-[#141c2b]/40"}`}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#8890a8]">{audioTitle}</div>
              <div className="mt-1 text-sm text-white">Связанный аудиофайл для воспроизведения в симуляции</div>
              <div className="mt-1 text-[11px] text-[#8fa0b8]">
                Если файл не выбран, система оставит только системный сигнал канала и не будет озвучивать текст роботом.
              </div>
            </div>
            {isPreviewActive && (
              <span className="rounded-full bg-[#00d4aa]/16 px-2 py-1 text-[10px] font-semibold text-[#00d4aa]">
                Активный трек
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
            <select value={entity.audioAssetId || ""} onChange={(e) => update({ audioAssetId: e.target.value || null })} className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white">
              <option value="">Без аудио</option>
              {audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/x-m4a,audio/aac" className="bg-[#141c2b] border-[#2a3a4e] text-white" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const assetId = await onUploadAsset(file);
              if (assetId) update({ audioAssetId: assetId });
            }} />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[#00d4aa] text-[#0d1117] hover:bg-[#00c39c]"
              onClick={() => onTogglePreviewAudio(previewKey, previewAudioUrl)}
            >
              <Play className="mr-2 h-4 w-4" />
              Плей
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[#2a3a4e] bg-transparent text-[#8890a8]"
              onClick={() => isPreviewActive && onTogglePreviewAudio(previewKey, previewAudioUrl)}
            >
              <Pause className="mr-2 h-4 w-4" />
              Пауза
            </Button>
          </div>
      </div>
    </div>
  );
}

function createEmptyStructuredOption(level: number) {
  return {
    id: "",
    level,
    text: "",
    score: 1,
    effects: { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 },
    competency_scores: {},
  };
}

function CaseCreationWizard({
  open,
  step,
  draft,
  competencies,
  caseSourceOptions,
  onOpenChange,
  onStepChange,
  onDraftChange,
  onConfirm,
}: {
  open: boolean;
  step: number;
  draft: SimCase;
  competencies: CompetencyDefinition[];
  caseSourceOptions: string[];
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: number) => void;
  onDraftChange: (draft: SimCase) => void;
  onConfirm: () => void;
}) {
  const wizardSteps = [
    {
      title: "Контекст кейса",
      description: "Сначала задайте базовый смысл кейса: что произошло, для кого он предназначен и какую управленческую тему проверяет.",
    },
    {
      title: "Сигнал и зона",
      description: "Здесь задаётся, откуда студент получает сигнал, через какой тип коммуникации и какая зона магазина первой попадает под давление.",
    },
    {
      title: "Первый цикл события",
      description: "Опишите стартовую ситуацию и текст сигнала, который увидит студент в симуляции. Это точка входа в кейс.",
    },
    {
      title: "Параметры времени",
      description: "Настройте интервалы и напоминания. Эти поля управляют темпом появления и повторного срабатывания кейса.",
    },
  ] as const;

  const currentCycle = draft.cycles?.[0] || createEmptyCase(1).cycles[0];

  const setDraft = (patch: Partial<SimCase>) => onDraftChange({ ...draft, ...patch });
  const setCycle = (patch: Record<string, any>) => {
    const nextCycles = [...(draft.cycles || [])];
    nextCycles[0] = { ...currentCycle, ...patch };
    onDraftChange({ ...draft, cycles: nextCycles });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-[#2a3a4e] bg-[#101826] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Мастер создания нового кейса</DialogTitle>
          <DialogDescription className="text-[#8aa2c4]">
            Служебные поля вроде `ID` и внутренних кодов будут сгенерированы автоматически. После завершения мастер откроет кейс в полном редакторе для детальной настройки.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[240px,1fr]">
          <div className="space-y-2 rounded-xl border border-[#243244] bg-[#141c2b]/45 p-4">
            {wizardSteps.map((wizardStep, index) => (
              <button
                key={wizardStep.title}
                type="button"
                onClick={() => onStepChange(index)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  step === index
                    ? "border-[#4a9eff] bg-[#4a9eff]/10"
                    : "border-[#243244] bg-[#101826]/70"
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#8ec5ff]">Шаг {index + 1}</div>
                <div className="mt-1 text-sm font-semibold text-white">{wizardStep.title}</div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-[#243244] bg-[#141c2b]/45 p-4">
            <div className="mb-4 rounded-xl border border-[#29425f] bg-[#122031] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">{wizardSteps[step].title}</div>
              <div className="mt-2 text-sm leading-relaxed text-[#d6e3f7]">{wizardSteps[step].description}</div>
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <FieldArea
                  label="Название кейса"
                  value={draft.title}
                  onChange={(value) => setDraft({ title: value })}
                />
                <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                  Это название будет видеть администратор, оценщик и участник в журнале решений. Лучше использовать понятную формулировку управленческой проблемы: например, `Провал утренней расстановки персонала`.
                </div>
                <FieldArea
                  label="Описание кейса"
                  value={draft.description}
                  onChange={(value) => setDraft({ description: value })}
                />
                <MultiSelectField
                  label="Основные компетенции"
                  values={draft.primaryCompetencies || []}
                  onChange={(values) => setDraft({ primaryCompetencies: values })}
                  options={competencies.map((competency) => ({ value: competency.id, label: competency.name }))}
                />
                <MultiSelectField
                  label="Вторичные компетенции"
                  values={draft.secondaryCompetencies || []}
                  onChange={(values) => setDraft({ secondaryCompetencies: values })}
                  options={competencies.map((competency) => ({ value: competency.id, label: competency.name }))}
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <SuggestField
                  label="Источник сигнала"
                  value={draft.trigger.source}
                  onChange={(value) => setDraft({ trigger: { ...draft.trigger, source: value } })}
                  options={caseSourceOptions}
                />
                <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                  Источник помогает студенту понять, от кого пришёл запрос: сотрудник, склад, директор, клиент, мониторинг очереди и так далее.
                </div>
                <SelectField
                  label="Тип сигнала"
                  value={draft.trigger.type}
                  onChange={(value) => setDraft({ trigger: { ...draft.trigger, type: value as any } })}
                  options={[...CASE_SIGNAL_TYPE_OPTIONS]}
                />
                <MultiSelectField
                  label="Зоны магазина"
                  values={draft.zones_affected || []}
                  onChange={(values) => setDraft({ zones_affected: values as any })}
                  options={[...STORE_ZONE_OPTIONS]}
                />
                <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                  Зоны определяют, где кейс отзовётся сильнее всего: `торговый_зал`, `склад`, `выдача`, `начальство`. Можно перечислить несколько через запятую.
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <FieldArea
                  label="Стартовая ситуация"
                  value={currentCycle.situation}
                  onChange={(value) => setCycle({ situation: value })}
                />
                <FieldArea
                  label="Текст сигнала для студента"
                  value={draft.trigger.text}
                  onChange={(value) => setDraft({ trigger: { ...draft.trigger, text: value } })}
                />
                <FieldArea
                  label="Текст сигнала внутри цикла"
                  value={currentCycle.signal?.content || ""}
                  onChange={(value) => setCycle({ signal: { ...(currentCycle.signal || {}), content: value } })}
                />
                <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                  В этом шаге достаточно описать первую ситуацию и первый сигнал. Варианты ответа, последствия и дополнительные циклы вы сможете спокойно добавить уже в полном редакторе.
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Field
                    label="Мин. интервал, сек"
                    value={draft.timing?.minIntervalSeconds ?? ""}
                    onChange={(value) => setDraft({ timing: { ...draft.timing, minIntervalSeconds: value ? Number(value) : null } })}
                  />
                  <div className="mt-1 text-[11px] text-[#8aa2c4]">Нижняя граница ожидания следующего появления кейса.</div>
                </div>
                <div>
                  <Field
                    label="Макс. интервал, сек"
                    value={draft.timing?.maxIntervalSeconds ?? ""}
                    onChange={(value) => setDraft({ timing: { ...draft.timing, maxIntervalSeconds: value ? Number(value) : null } })}
                  />
                  <div className="mt-1 text-[11px] text-[#8aa2c4]">Верхняя граница интервала между срабатываниями.</div>
                </div>
                <div>
                  <Field
                    label="Срок решения, сек"
                    value={draft.timing?.decisionDeadlineSeconds ?? ""}
                    onChange={(value) => setDraft({ timing: { ...draft.timing, decisionDeadlineSeconds: value ? Number(value) : null } })}
                  />
                  <div className="mt-1 text-[11px] text-[#8aa2c4]">Сколько секунд даётся участнику после появления события.</div>
                </div>
                <div>
                  <Field
                    label="Повтор напоминания, сек"
                    value={draft.timing?.reminderIntervalSeconds ?? 180}
                    onChange={(value) => setDraft({ timing: { ...draft.timing, reminderIntervalSeconds: value ? Number(value) : null } })}
                  />
                  <div className="mt-1 text-[11px] text-[#8aa2c4]">Через сколько секунд система повторно напомнит о неотработанном кейсе.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-[#2a3a4e] bg-transparent text-[#8890a8]"
              onClick={() => onStepChange(Math.max(step - 1, 0))}
              disabled={step === 0}
            >
              Назад
            </Button>
            <div className="text-xs text-[#8890a8]">Шаг {step + 1} из {wizardSteps.length}</div>
            {step < wizardSteps.length - 1 ? (
              <Button type="button" className="bg-[#4a9eff] text-white hover:bg-[#3d8be0]" onClick={() => onStepChange(step + 1)}>
                Далее
              </Button>
            ) : (
              <Button type="button" className="bg-[#FF6B00] hover:bg-[#e06000]" onClick={onConfirm}>
                Открыть полный редактор
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignalCreationWizard({
  open,
  mode,
  step,
  draft,
  competencies,
  chats,
  emailSenderOptions,
  emailDepartmentOptions,
  messengerSenderOptions,
  messengerRoleOptions,
  videoSenderOptions,
  videoRoleOptions,
  onOpenChange,
  onStepChange,
  onDraftChange,
  onConfirm,
}: {
  open: boolean;
  mode: ChannelTab;
  step: number;
  draft: EmailCase | MessengerCase | VideoCase;
  competencies: CompetencyDefinition[];
  chats: ChatInfo[];
  emailSenderOptions: string[];
  emailDepartmentOptions: string[];
  messengerSenderOptions: string[];
  messengerRoleOptions: string[];
  videoSenderOptions: string[];
  videoRoleOptions: string[];
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: number) => void;
  onDraftChange: (draft: EmailCase | MessengerCase | VideoCase) => void;
  onConfirm: () => void;
}) {
  const competencyOptions = competencies.map((competency) => ({
    value: competency.id,
    label: competency.name,
  }));

  const wizardConfig = {
    email: {
      title: "Создание письма",
      description: "Пошагово задайте служебное письмо, которое придёт студенту в корпоративную почту.",
      steps: ["Источник и смысл", "Содержимое письма", "Время и оценка"],
    },
    messenger: {
      title: "Создание сообщения",
      description: "Пошагово задайте сообщение из рабочего чата, которое увидит студент.",
      steps: ["От кого пришло", "Текст сообщения", "Время и оценка"],
    },
    video: {
      title: "Создание видеосигнала",
      description: "Пошагово задайте видеосигнал и базовую управленческую цель этого события.",
      steps: ["Кто обращается", "Ситуация", "Время и оценка"],
    },
  }[mode];

  const update = (patch: Record<string, any>) => onDraftChange({ ...(draft as any), ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-[#2a3a4e] bg-[#1a2435] text-white">
        <DialogHeader>
          <DialogTitle>{wizardConfig.title}</DialogTitle>
          <DialogDescription className="text-[#8aa2c4]">
            {wizardConfig.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
          <div className="space-y-2">
            {wizardConfig.steps.map((stepTitle, index) => (
              <button
                key={stepTitle}
                type="button"
                onClick={() => onStepChange(index)}
                className={`w-full rounded-xl border px-4 py-3 text-left ${
                  step === index ? "border-[#4a9eff] bg-[#4a9eff]/10" : "border-[#2a3a4e] bg-[#101826]/60"
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#8ec5ff]">Шаг {index + 1}</div>
                <div className="mt-1 text-sm font-semibold text-white">{stepTitle}</div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-[#243244] bg-[#141c2b]/45 p-4">
            {mode === "email" && step === 0 && (
              <div className="space-y-4">
                <Field label="Тема письма" value={(draft as EmailCase).subject} onChange={(value) => update({ subject: value })} />
                <SuggestField label="Отправитель" value={(draft as EmailCase).from} onChange={(value) => update({ from: value })} options={emailSenderOptions} />
                <SuggestField label="Подразделение" value={(draft as EmailCase).department} onChange={(value) => update({ department: value })} options={emailDepartmentOptions} />
                <SelectField label="Основная компетенция" value={(draft as EmailCase).primaryCompetency} onChange={(value) => update({ primaryCompetency: value })} options={competencyOptions} />
              </div>
            )}
            {mode === "email" && step === 1 && (
              <div className="space-y-4">
                <FieldArea label="Короткое превью письма" value={(draft as EmailCase).preview} onChange={(value) => update({ preview: value })} />
                <FieldArea label="Тело письма" value={(draft as EmailCase).body} onChange={(value) => update({ body: value })} />
              </div>
            )}
            {mode === "email" && step === 2 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Минута прихода" value={(draft as EmailCase).arrivalMinute} onChange={(value) => update({ arrivalMinute: Number(value), timing: { ...((draft as EmailCase).timing || {}), arrivalMinute: Number(value) } })} />
                <Field label="Повтор, сек" value={(draft as EmailCase).timing?.reminderIntervalSeconds ?? 180} onChange={(value) => update({ timing: { ...((draft as EmailCase).timing || {}), reminderIntervalSeconds: Number(value) } })} />
                <Field label="Срок решения, сек" value={(draft as EmailCase).timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...((draft as EmailCase).timing || {}), decisionDeadlineSeconds: value ? Number(value) : null } })} />
                <Field label="Порядок показа" value={(draft as EmailCase).sortOrder} onChange={(value) => update({ sortOrder: Number(value) })} />
              </div>
            )}

            {mode === "messenger" && step === 0 && (
              <div className="space-y-4">
                <SuggestField label="Отправитель" value={(draft as MessengerCase).senderName} onChange={(value) => update({ senderName: value })} options={messengerSenderOptions} />
                <SuggestField label="Роль отправителя" value={(draft as MessengerCase).senderRole} onChange={(value) => update({ senderRole: value })} options={messengerRoleOptions} />
                <SelectField label="Чат" value={(draft as MessengerCase).chatId} onChange={(value) => update({ chatId: value })} options={chats.map((chat) => ({ value: chat.id, label: chat.name }))} />
                <SelectField label="Основная компетенция" value={(draft as MessengerCase).primaryCompetency} onChange={(value) => update({ primaryCompetency: value })} options={competencyOptions} />
              </div>
            )}
            {mode === "messenger" && step === 1 && (
              <div className="space-y-4">
                <FieldArea label="Текст сообщения" value={(draft as MessengerCase).message} onChange={(value) => update({ message: value })} />
                <Field label="Аватар отправителя" value={(draft as MessengerCase).senderAvatar} onChange={(value) => update({ senderAvatar: value })} />
              </div>
            )}
            {mode === "messenger" && step === 2 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Минута прихода" value={(draft as MessengerCase).arrivalMinute} onChange={(value) => update({ arrivalMinute: Number(value), timing: { ...((draft as MessengerCase).timing || {}), arrivalMinute: Number(value) } })} />
                <Field label="Повтор, сек" value={(draft as MessengerCase).timing?.reminderIntervalSeconds ?? 5} onChange={(value) => update({ timing: { ...((draft as MessengerCase).timing || {}), reminderIntervalSeconds: Number(value) } })} />
                <Field label="Срок решения, сек" value={(draft as MessengerCase).timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...((draft as MessengerCase).timing || {}), decisionDeadlineSeconds: value ? Number(value) : null } })} />
                <Field label="Порядок показа" value={(draft as MessengerCase).sortOrder} onChange={(value) => update({ sortOrder: Number(value) })} />
              </div>
            )}

            {mode === "video" && step === 0 && (
              <div className="space-y-4">
                <Field label="Заголовок видеосигнала" value={(draft as VideoCase).title} onChange={(value) => update({ title: value })} />
                <SuggestField label="Отправитель" value={(draft as VideoCase).sender} onChange={(value) => update({ sender: value })} options={videoSenderOptions} />
                <SuggestField label="Роль отправителя" value={(draft as VideoCase).role} onChange={(value) => update({ role: value })} options={videoRoleOptions} />
                <SelectField label="Основная компетенция" value={(draft as VideoCase).primaryCompetency} onChange={(value) => update({ primaryCompetency: value })} options={competencyOptions} />
              </div>
            )}
            {mode === "video" && step === 1 && (
              <div className="space-y-4">
                <FieldArea label="Ситуация" value={(draft as VideoCase).situation} onChange={(value) => update({ situation: value })} />
                <Field label="Длительность ролика" value={(draft as VideoCase).duration} onChange={(value) => update({ duration: value })} />
                <Field label="Аватар отправителя" value={(draft as VideoCase).senderAvatar} onChange={(value) => update({ senderAvatar: value })} />
              </div>
            )}
            {mode === "video" && step === 2 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Минута прихода" value={(draft as VideoCase).arrivalMinute} onChange={(value) => update({ arrivalMinute: Number(value), timing: { ...((draft as VideoCase).timing || {}), arrivalMinute: Number(value) } })} />
                <Field label="Повтор, сек" value={(draft as VideoCase).timing?.reminderIntervalSeconds ?? 180} onChange={(value) => update({ timing: { ...((draft as VideoCase).timing || {}), reminderIntervalSeconds: Number(value) } })} />
                <Field label="Срок решения, сек" value={(draft as VideoCase).timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...((draft as VideoCase).timing || {}), decisionDeadlineSeconds: value ? Number(value) : null } })} />
                <Field label="Порядок показа" value={(draft as VideoCase).sortOrder} onChange={(value) => update({ sortOrder: Number(value) })} />
              </div>
            )}

            <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
              Это упрощённый мастер. После завершения откроется полный редактор сигнала, где можно спокойно добавить варианты ответа, медиа и точные последствия.
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex w-full items-center justify-between gap-3">
            <Button type="button" variant="outline" className="border-[#2a3a4e] bg-transparent text-[#8890a8]" onClick={() => onStepChange(Math.max(0, step - 1))} disabled={step === 0}>
              Назад
            </Button>
            <div className="text-xs text-[#8890a8]">Шаг {step + 1} из {wizardConfig.steps.length}</div>
            {step < wizardConfig.steps.length - 1 ? (
              <Button type="button" className="bg-[#4a9eff] text-white hover:bg-[#3d8be0]" onClick={() => onStepChange(step + 1)}>
                Далее
              </Button>
            ) : (
              <Button type="button" className="bg-[#FF6B00] hover:bg-[#e06000]" onClick={onConfirm}>
                Открыть полный редактор
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatCompetencyScores(value: Record<string, number> | undefined, competencies: CompetencyDefinition[]) {
  const names = buildCompetencyNameMap(competencies);
  return Object.entries(value || {})
    .map(([key, score]) => `${names.get(key) || key}:${score}`)
    .join(", ");
}

function parseCompetencyScores(value: string, competencies: CompetencyDefinition[]) {
  const aliases = buildCompetencyAliasMap(competencies);
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, number>>((acc, item) => {
      const [rawKey, rawScore] = item.split(":").map((part) => part.trim());
      const key = aliases.get((rawKey || "").toLowerCase()) || rawKey;
      if (!key) {
        return acc;
      }

      const score = Number(rawScore);
      acc[key] = Number.isFinite(score) ? score : 0;
      return acc;
    }, {});
}

function StructuredOptionsEditor({
  title,
  options,
  onChange,
  competencies,
}: {
  title: string;
  options: any[];
  onChange: (options: any[]) => void;
  competencies: CompetencyDefinition[];
}) {
  const previewData = useMemo(() => {
    const profile = buildOptionCompetencyProfile(options);
    return competencies
      .map((competency) => ({
        name: competency.name,
        shortName: competency.name.length > 18 ? `${competency.name.slice(0, 18)}…` : competency.name,
        value: Number(profile[competency.id] || 0),
      }))
      .filter((item) => item.value > 0);
  }, [competencies, options]);

  const updateOption = (index: number, patch: Record<string, any>) => {
    onChange(options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option));
  };

  const updateEffects = (index: number, effectKey: string, value: number) => {
    updateOption(index, {
      effects: {
        ...(options[index]?.effects || {}),
        [effectKey]: Number.isFinite(value) ? value : 0,
      },
    });
  };

  const updateCompetencyScore = (index: number, competencyId: string, value: number) => {
    const currentScores = { ...(options[index]?.competency_scores || {}) };
    if (value <= 0) {
      delete currentScores[competencyId];
    } else {
      currentScores[competencyId] = value;
    }

    updateOption(index, { competency_scores: currentScores });
  };

  const addOption = () => {
    onChange([...(options || []), createEmptyStructuredOption((options?.length || 0) + 1)]);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, optionIndex) => optionIndex !== index).map((option, optionIndex) => ({ ...option, level: optionIndex + 1 })));
  };

  return (
    <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-[11px] text-[#8890a8]">Каждый вариант ответа заполняется отдельными полями без JSON.</div>
        </div>
        <Button type="button" size="sm" onClick={addOption}>Добавить вариант</Button>
      </div>
      <div className="space-y-3">
        {(options || []).map((option, index) => (
          <div key={`${option.id || "option"}-${index}`} className="rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">Вариант {index + 1}</div>
              <Button type="button" size="sm" variant="outline" className="border-[#ff4444]/30 bg-transparent text-[#ff9999]" onClick={() => removeOption(index)}>
                Удалить
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#70829d]">Позиция варианта</div>
                <div className="mt-1 text-sm font-semibold text-white">{index + 1}</div>
              </div>
              <Field label="Оценка" value={option.score} onChange={(value) => updateOption(index, { score: Number(value) })} />
            </div>
            <FieldArea label="Текст ответа" value={option.text} onChange={(value) => updateOption(index, { text: value })} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Field label="Очередь" value={option.effects?.queue ?? 0} onChange={(value) => updateEffects(index, "queue", Number(value))} />
              <Field label="Конверсия" value={option.effects?.conversion ?? 0} onChange={(value) => updateEffects(index, "conversion", Number(value))} />
              <Field label="Мораль" value={option.effects?.morale ?? 0} onChange={(value) => updateEffects(index, "morale", Number(value))} />
              <Field label="Выручка" value={option.effects?.revenue_impact ?? 0} onChange={(value) => updateEffects(index, "revenue_impact", Number(value))} />
              <Field label="Доставка" value={option.effects?.delivery_status ?? 0} onChange={(value) => updateEffects(index, "delivery_status", Number(value))} />
            </div>
            <div className="rounded-xl border border-[#243244] bg-[#0d1522]/80 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6fa0ff]">Влияние на компетенции</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
                    Настройте силу влияния ответа на каждую компетенцию. `0` означает, что этот вариант не влияет на выбранную компетенцию.
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {competencies.map((competency) => {
                  const scoreValue = Number(option.competency_scores?.[competency.id] || 0);

                  return (
                    <div key={competency.id} className="rounded-lg border border-[#223245] bg-[#101826]/80 px-3 py-2">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-white">{competency.name}</div>
                          <div className="text-[10px] uppercase tracking-[0.16em] text-[#70829d]">{competency.category}</div>
                        </div>
                        <div className="rounded-full border border-[#2a3a4e] bg-[#141c2b]/70 px-2 py-1 text-xs font-semibold text-white">
                          {scoreValue}
                        </div>
                      </div>
                      <Slider
                        value={[scoreValue]}
                        onValueChange={([value]) => updateCompetencyScore(index, competency.id, value)}
                        min={0}
                        max={5}
                        step={1}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Живой preview влияния кейса</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Ниже видно, как текущий набор вариантов ответа формирует ожидаемый профиль компетенций у этого кейса.
        </div>
        {previewData.length > 0 ? (
          <div className="mt-4">
            <CompetencyHorizontalImpactChart
              data={previewData}
              series={[{ key: "value", label: "Влияние", color: "#4a9eff" }]}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-[#31455f] bg-[#0e1624] px-4 py-6 text-center text-sm text-[#8aa2c4]">
            Пока ни одна компетенция не настроена. Добавьте влияние через ползунки выше, и график появится автоматически.
          </div>
        )}
      </div>
    </div>
  );
}

function StructuredCyclesEditor({
  cycles,
  onChange,
  competencies,
}: {
  cycles: any[];
  onChange: (cycles: any[]) => void;
  competencies: CompetencyDefinition[];
}) {
  const updateCycle = (index: number, patch: Record<string, any>) => {
    onChange(cycles.map((cycle, cycleIndex) => cycleIndex === index ? { ...cycle, ...patch } : cycle));
  };

  const addCycle = () => {
    onChange([
      ...(cycles || []),
      {
        id: "",
        cycle: (cycles?.length || 0) + 1,
        situation: "",
        signal: { type: "message", content: "" },
        options: [createEmptyStructuredOption(1)],
      },
    ]);
  };

  const removeCycle = (index: number) => {
    onChange(cycles.filter((_, cycleIndex) => cycleIndex !== index).map((cycle, cycleIndex) => ({ ...cycle, cycle: cycleIndex + 1 })));
  };

  return (
    <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Циклы кейса</div>
          <div className="mt-1 text-[11px] text-[#8890a8]">Каждый цикл, сигнал и варианты ответа редактируются отдельными полями.</div>
        </div>
        <Button type="button" size="sm" onClick={addCycle}>Добавить цикл</Button>
      </div>
      <div className="space-y-4">
        {(cycles || []).map((cycle, index) => (
          <div key={`${cycle.id || "cycle"}-${index}`} className="rounded-xl border border-[#243244] bg-[#101826]/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">Цикл {index + 1}</div>
              <Button type="button" size="sm" variant="outline" className="border-[#ff4444]/30 bg-transparent text-[#ff9999]" onClick={() => removeCycle(index)}>
                Удалить цикл
              </Button>
            </div>
            <FieldArea label="Ситуация" value={cycle.situation} onChange={(value) => updateCycle(index, { situation: value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Тип сигнала" value={cycle.signal?.type} onChange={(value) => updateCycle(index, { signal: { ...(cycle.signal || {}), type: value } })} options={[...CASE_SIGNAL_TYPE_OPTIONS]} />
              <FieldArea label="Текст сигнала" value={cycle.signal?.content} onChange={(value) => updateCycle(index, { signal: { ...(cycle.signal || {}), content: value } })} />
            </div>
            <StructuredOptionsEditor
              title="Варианты ответа для цикла"
              options={cycle.options || []}
              competencies={competencies}
              onChange={(options) => updateCycle(index, { options })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  emptyLabel = "Не выбрано",
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  emptyLabel?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-[#8890a8] mb-1.5 block">{label}</Label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SuggestField({
  label,
  value,
  onChange,
  options,
  placeholder = "Можно выбрать из готовых или ввести своё",
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const listId = useId();

  return (
    <div>
      <Label className="text-xs text-[#8890a8] mb-1.5 block">{label}</Label>
      <Input
        list={listId}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#141c2b] border-[#2a3a4e] text-white"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}

function MultiSelectField({
  label,
  values,
  onChange,
  options,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const toggleValue = (targetValue: string) => {
    if (values.includes(targetValue)) {
      onChange(values.filter((value) => value !== targetValue));
      return;
    }

    onChange([...values, targetValue]);
  };

  return (
    <div>
      <Label className="text-xs text-[#8890a8] mb-1.5 block">{label}</Label>
      <div className="flex flex-wrap gap-2 rounded-xl border border-[#2a3a4e] bg-[#141c2b]/45 p-3">
        {options.map((option) => {
          const active = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleValue(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                active
                  ? "border-[#4a9eff] bg-[#4a9eff]/15 text-white"
                  : "border-[#2a3a4e] bg-[#101826]/60 text-[#9aabc6]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: any; onChange: (value: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-[#8890a8] mb-1.5 block">{label}</Label>
      <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
    </div>
  );
}

function FieldArea({ label, value, onChange, onBlur }: { label: string; value: any; onChange: (value: string) => void; onBlur?: () => void }) {
  return (
    <div>
      <Label className="text-xs text-[#8890a8] mb-1.5 block">{label}</Label>
      <Textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className="min-h-[120px] bg-[#141c2b] border-[#2a3a4e] text-white" />
    </div>
  );
}
