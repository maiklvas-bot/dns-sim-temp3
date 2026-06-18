import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import type { ChatInfo, CompetencyDefinition, EmailCase, MessengerCase, SimCase, SimulationRuntimeSettings, VideoCase } from "@shared/simulation-content";
import { apiRequest } from "@/lib/queryClient";
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
import { ThemeToggle, useDnsTheme } from "@/components/theme-toggle";
import { BrandMark, BrandVisualBackdrop } from "@/components/brand-access-shell";
import { AdminAuditHistory } from "@/components/admin-audit-history";
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
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileSpreadsheet,
  History,
  Info,
  LayoutDashboard,
  Pause,
  Play,
  Radio,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
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
import { BRAND_ASSETS } from "@/lib/brand-assets";
import { autoAssignScheduleTimes, buildScheduleRows, getScheduleSourceLabel, type ScheduleRow } from "./schedule/schedule-utils";
import { ADMIN_NAV_ICONS, ADMIN_VISUALS } from "./admin-constants";
import type { AdminChannelTab as ChannelTab, AdminTabKey as TabKey, SystemSoundSettingKey } from "./admin-types";
import { AdminVisualPanel } from "./components/AdminVisualPanel";
import { AdminWikiDialog } from "./components/AdminWikiDialog";
import { CompetencyRoleSelector, Field, FieldArea, MultiSelectField, SelectField, SuggestField } from "./components/AdminFields";
import { CompetencyHorizontalImpactChart, type CompetencyImpactDatum } from "./components/CompetencyHorizontalImpactChart";
import { EntityEditor } from "./components/EntityEditor";
import {
  CaseCreationWizard,
  CaseMediaPanel,
  SignalCreationWizard,
  StructuredCyclesEditor,
  StructuredOptionsEditor,
} from "./cases/CaseEditors";
import { CASE_AUTHORING_WIKI } from "./admin-wiki-content";
import { clearDraftFromStorage, deepClone, readDraftFromStorage, writeDraftToStorage } from "./hooks/useAdminDrafts";
import { useAdminPermissions } from "./hooks/useAdminPermissions";
import { useAdminContent } from "./hooks/useAdminContent";

const MAX_COMPARISON_ITEMS = 5;

type ComparisonReport = ReturnType<typeof buildReportFromSessionDetails>;

interface ComparisonResultRow {
  id: number;
  participantName: string;
  evaluatorName: string;
  difficulty: string;
  technicalStatus: string;
  startedAt: string;
  completedAt: string | null;
  totalScore: number;
  averageScore: number;
  answersCount: number;
  competencyAverages: Record<string, number>;
  report: ComparisonReport | null;
  detail: any | null;
  isLoading: boolean;
  isError: boolean;
}

interface ComparisonCompetencyInsight {
  id: string;
  name: string;
  value: number;
  groupAverage: number;
  isGroupBest: boolean;
}

interface ComparisonParticipantInsight {
  rowId: number;
  participantName: string;
  overallScore: number;
  summary: string;
  strongCompetencies: ComparisonCompetencyInsight[];
  weakCompetencies: ComparisonCompetencyInsight[];
  leaderNotes: string[];
  risks: string[];
  questions: string[];
}

interface ComparisonMetricDefinition {
  label: string;
  render: (row: ComparisonResultRow) => ReactNode;
}

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

const STORE_EFFECT_FIELDS = [
  {
    key: "queue",
    label: "Торг. зал / поток",
    zone: "Торг. зал",
    metric: "Покупатели в зале",
    helper: "Положительное значение усиливает поток покупателей, отрицательное снижает управляемость зала.",
  },
  {
    key: "conversion",
    label: "Торг. зал / конверсия",
    zone: "Торг. зал",
    metric: "Конверсия",
    helper: "Положительное значение повышает долю покупок, отрицательное показывает потерю продаж.",
  },
  {
    key: "morale",
    label: "Команда / мораль",
    zone: "Команда",
    metric: "Настроение команды",
    helper: "Положительное значение поддерживает смену, отрицательное усиливает напряжение.",
  },
  {
    key: "revenue_impact",
    label: "Финансы / выручка",
    zone: "Финансы",
    metric: "Выручка за день",
    helper: "Положительное значение добавляет продажи, отрицательное фиксирует упущенную выручку.",
  },
  {
    key: "delivery_status",
    label: "Выдача / скорость",
    zone: "Выдача",
    metric: "Скорость выдачи",
    helper: "Положительное значение ускоряет выдачу, отрицательное увеличивает ожидание.",
  },
] as const;

const DRAFT_STORAGE_KEYS = {
  caseWizard: "dns-simcenter.admin.caseWizardDraft",
  signalWizard: "dns-simcenter.admin.signalWizardDraft",
} as const;

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

function buildCaseSetupIssues(caseItem: SimCase | null | undefined) {
  if (!caseItem) {
    return [];
  }

  const issues: string[] = [];
  if (!caseItem.title?.trim()) issues.push("Не заполнено название кейса.");
  if (!caseItem.trigger?.text?.trim()) issues.push("Не заполнен стартовый сигнал кейса.");
  if (!caseItem.trigger?.source?.trim()) issues.push("Не заполнен источник сигнала.");
  if (!caseItem.timing?.decisionDeadlineSeconds) issues.push("Не задан срок решения.");
  if (!caseItem.cycles?.length) issues.push("Не создан ни один цикл.");

  (caseItem.cycles || []).forEach((cycle, cycleIndex) => {
    if (!cycle.situation?.trim()) issues.push(`Цикл ${cycleIndex + 1}: не заполнена ситуация.`);
    if (!cycle.signal?.content?.trim()) issues.push(`Цикл ${cycleIndex + 1}: не заполнен текст сигнала.`);
    const activeOptions = (cycle.options || []).filter((option: any) => (option.status || "active") === "active");
    if (activeOptions.length === 0) issues.push(`Цикл ${cycleIndex + 1}: нет активных вариантов ответа.`);
    activeOptions.forEach((option: any, optionIndex: number) => {
      if (!option.text?.trim()) issues.push(`Цикл ${cycleIndex + 1}, ответ ${optionIndex + 1}: не заполнен текст ответа.`);
      if (Object.keys(option.competency_scores || {}).length === 0) {
        issues.push(`Цикл ${cycleIndex + 1}, ответ ${optionIndex + 1}: нет влияния на компетенции.`);
      }
      if (option.nextCycleId && option.nextCycleId !== "__complete" && !(caseItem.cycles || []).some((item) => item.id === option.nextCycleId)) {
        issues.push(`Цикл ${cycleIndex + 1}, ответ ${optionIndex + 1}: ссылка ведёт на несуществующий цикл.`);
      }
    });
  });

  return issues;
}

function buildCaseRouteRows(caseItem: SimCase | null | undefined) {
  if (!caseItem) {
    return [];
  }

  return (caseItem.cycles || []).flatMap((cycle, cycleIndex) => (
    (cycle.options || [])
      .filter((option: any) => (option.status || "active") === "active")
      .map((option: any, optionIndex: number) => {
        const linkedCycle = option.nextCycleId && option.nextCycleId !== "__complete"
          ? (caseItem.cycles || []).find((item) => item.id === option.nextCycleId)
          : null;
        const fallbackCycle = (caseItem.cycles || [])[cycleIndex + 1] || null;
        const targetLabel = option.nextCycleId === "__complete"
          ? "Завершить кейс"
          : linkedCycle
            ? `Цикл ${linkedCycle.cycle}`
            : fallbackCycle
              ? `Цикл ${fallbackCycle.cycle} по порядку`
              : "Финал кейса";

        return {
          id: `${cycle.id || cycleIndex}-${option.id || optionIndex}`,
          from: `Цикл ${cycleIndex + 1}, ответ ${optionIndex + 1}`,
          targetLabel,
          delay: Number(option.nextDelaySeconds || 0),
          text: option.text || "Ответ без текста",
        };
      })
  ));
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
    <div className="min-w-0 rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4 2xl:sticky 2xl:top-4 2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-y-auto 2xl:overflow-x-hidden 2xl:pr-3 scrollbar-thin">
      <div className="text-sm font-semibold text-white">Влияние выбранного сигнала</div>
      <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
        Канальные события тоже оценивают компетенции через варианты ответа. Этот блок показывает, какой профиль формирует выбранный сигнал.
      </div>
      <div className="flex items-center justify-center gap-1 py-1 text-[10px] text-[#64748B] 2xl:hidden">
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

function formatDifficultyLabel(value: string) {
  switch (value) {
    case "easy":
      return "Легкая";
    case "hard":
      return "Сложная";
    case "medium":
      return "Средняя";
    default:
      return value || "—";
  }
}

function formatScoreValue(value: number | string | null | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(1) : "—";
}

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDurationBetween(startValue: string | null | undefined, endValue: string | null | undefined) {
  if (!startValue || !endValue) {
    return "—";
  }

  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }

  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes} мин`;
  }

  return `${hours} ч ${minutes} мин`;
}

function getScoreColor(value: number) {
  if (value >= 4.2) return "#00d4aa";
  if (value >= 3.5) return "#74c0ff";
  if (value >= 2.5) return "#ffc107";
  if (value > 0) return "#ff8a3d";
  return "#3a4a5e";
}

function getComparisonMetricColor(value: number, minValue: number, maxValue: number) {
  if (!Number.isFinite(value) || !Number.isFinite(minValue) || !Number.isFinite(maxValue) || maxValue <= minValue) {
    return "#dbe7f8";
  }

  const ratio = Math.max(0, Math.min((value - minValue) / (maxValue - minValue), 1));
  const hue = Math.round(4 + ratio * 146);
  const lightness = Math.round(62 - ratio * 10);
  return `hsl(${hue} 86% ${lightness}%)`;
}

function renderComparisonMetricValue(value: ReactNode, color: string) {
  return (
    <span className="dns-comparison-metric-value" style={{ color }}>
      {value}
    </span>
  );
}

function formatCompetencyHighlights(
  scores: Record<string, number>,
  competencies: CompetencyDefinition[],
  mode: "strong" | "growth",
) {
  const rows = competencies
    .map((competency) => ({
      name: competency.name,
      value: Number(scores[competency.id] || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((left, right) => mode === "strong" ? right.value - left.value : left.value - right.value)
    .slice(0, 2);

  return rows.length > 0 ? rows.map((item) => item.name).join(", ") : "—";
}

function getComparisonOverallScore(row: ComparisonResultRow) {
  return Number(row.report?.overallAvg ?? row.averageScore ?? 0);
}

function buildComparisonCompetencyInsights(
  row: ComparisonResultRow,
  rows: ComparisonResultRow[],
  competencies: CompetencyDefinition[],
) {
  return competencies
    .map((competency) => {
      const values = rows.map((item) => Number(item.competencyAverages[competency.id] || 0)).filter((value) => value > 0);
      const value = Number(row.competencyAverages[competency.id] || 0);
      const bestValue = values.length > 0 ? Math.max(...values) : 0;
      const groupAverage = values.length > 0
        ? values.reduce((sum, item) => sum + item, 0) / values.length
        : 0;

      return {
        id: competency.id,
        name: competency.name,
        value,
        groupAverage,
        isGroupBest: rows.length > 1 && value > 0 && value === bestValue,
      };
    })
    .filter((item) => item.value > 0);
}

function formatComparisonInsightItem(item: ComparisonCompetencyInsight) {
  const groupHint = item.isGroupBest ? " · лучший результат в группе" : "";
  return `${item.name}: ${formatScoreValue(item.value)}${groupHint}`;
}

function getComparisonSummary(row: ComparisonResultRow, overallScore: number, strong: ComparisonCompetencyInsight[]) {
  const strongest = strong[0]?.name;

  if (row.isLoading) {
    return "Детали результата еще загружаются, итоговый вывод появится после получения данных.";
  }

  if (overallScore >= 4.2) {
    return strongest
      ? `Сильный управленческий профиль, можно опираться на ${strongest.toLowerCase()} в сложных сменах.`
      : "Сильный управленческий профиль без выраженного провала по ключевым компетенциям.";
  }

  if (overallScore >= 3.5) {
    return strongest
      ? `Рабочий стабильный профиль: сильнее всего проявлена зона «${strongest}», но есть точки для развития.`
      : "Рабочий стабильный профиль, но требуется уточнить зоны развития по деталям компетенций.";
  }

  if (overallScore >= 2.7) {
    return "Профиль неоднородный: участник справляется с частью ситуаций, но нуждается в сопровождении руководителя.";
  }

  return "Профиль рискованный для самостоятельной управленческой роли: нужен план развития и контроль первых смен.";
}

function buildComparisonRisks(row: ComparisonResultRow, overallScore: number, weak: ComparisonCompetencyInsight[]) {
  const risks: string[] = [];
  const weakest = weak[0];
  const strongestValue = Number(
    Object.values(row.competencyAverages || {}).reduce((max, value) => Math.max(max, Number(value || 0)), 0),
  );
  const weakestValue = weakest?.value || 0;

  if (row.technicalStatus === "interrupted") {
    risks.push("Результат прерван: выводы по компетенциям могут быть неполными и требуют проверки причин остановки.");
  }

  if (overallScore < 3) {
    risks.push("Низкая общая оценка: в реальной смене возможны ошибки при самостоятельном принятии решений.");
  } else if (overallScore < 3.6) {
    risks.push("Средний общий уровень: без регулярной обратной связи качество решений может быть нестабильным.");
  }

  if (weakest && weakest.value < 3.2) {
    risks.push(`Слабая зона «${weakest.name}»: возможны сбои в задачах, где эта компетенция критична.`);
  }

  if (weak.length > 1 && weak[1].value < 3.4) {
    risks.push(`Вторая зона внимания «${weak[1].name}»: риск усиливается при параллельной нагрузке.`);
  }

  if (strongestValue - weakestValue >= 1.4 && weakest) {
    risks.push("Профиль неровный: сильные стороны могут маскировать провалы в отдельных управленческих сценариях.");
  }

  if (risks.length === 0) {
    risks.push("Критичных рисков по сравнению не видно, но стоит закрепить сильные практики в реальных сменах.");
  }

  return risks.slice(0, 4);
}

function buildComparisonQuestions(risks: string[], weak: ComparisonCompetencyInsight[], strong: ComparisonCompetencyInsight[]) {
  const questions: string[] = [];
  const weakest = weak[0];
  const strongest = strong[0];

  if (weakest) {
    questions.push(`В каких рабочих ситуациях руководитель уже видел риск по зоне «${weakest.name}» и как он проявлялся?`);
  }

  if (risks.some((risk) => risk.includes("самостоятельн"))) {
    questions.push("Какие решения участнику пока нельзя оставлять без контроля и какой уровень допуска безопасен?");
  }

  if (risks.some((risk) => risk.includes("неровн"))) {
    questions.push("Какие задачи лучше давать участнику только в паре с наставником, чтобы сильные стороны не скрывали слабые зоны?");
  }

  if (strongest) {
    questions.push(`Где можно использовать сильную сторону «${strongest.name}» уже сейчас, чтобы она дала пользу команде?`);
  }

  questions.push("Какой один измеримый результат руководитель ожидает увидеть через 2-4 недели после обратной связи?");

  return questions.filter((item, index, array) => array.indexOf(item) === index).slice(0, 4);
}

function buildComparisonInsights(rows: ComparisonResultRow[], competencies: CompetencyDefinition[]): ComparisonParticipantInsight[] {
  return rows.map((row) => {
    const points = buildComparisonCompetencyInsights(row, rows, competencies);
    const strongCompetencies = [...points].sort((left, right) => right.value - left.value).slice(0, 3);
    const weakCompetencies = [...points].sort((left, right) => left.value - right.value).slice(0, 3);
    const leaderNotes = strongCompetencies
      .filter((item) => item.isGroupBest)
      .slice(0, 2)
      .map((item) => `Лидирует по «${item.name}» среди выбранных сотрудников.`);
    const overallScore = getComparisonOverallScore(row);
    const risks = buildComparisonRisks(row, overallScore, weakCompetencies);

    return {
      rowId: row.id,
      participantName: row.participantName,
      overallScore,
      summary: getComparisonSummary(row, overallScore, strongCompetencies),
      strongCompetencies,
      weakCompetencies,
      leaderNotes,
      risks,
      questions: buildComparisonQuestions(risks, weakCompetencies, strongCompetencies),
    };
  });
}

function formatParticipantNameForSentence(value: string) {
  return value.trim().replace(/[.!?]+$/, "");
}

function buildComparisonGroupConclusion(insights: ComparisonParticipantInsight[]) {
  if (insights.length === 0) {
    return "";
  }

  if (insights.length === 1) {
    const insight = insights[0];
    return `${formatParticipantNameForSentence(insight.participantName)}: фокус обсуждения — закрепить сильные стороны и разобрать риски с руководителем.`;
  }

  const sorted = [...insights].sort((left, right) => right.overallScore - left.overallScore);
  const leader = sorted[0];
  const riskOwner = sorted[sorted.length - 1];

  return `Лучший общий профиль сейчас у ${formatParticipantNameForSentence(leader.participantName)}. Больше всего управленческого внимания требует ${formatParticipantNameForSentence(riskOwner.participantName)}: вопросы руководителю ниже помогут перевести риски в план развития.`;
}

function getParticipantInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "У";
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
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
      id: `CASE-${String(order).padStart(2, "0")}__cycle_1`,
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
  const { theme, themeClass, toggleTheme } = useDnsTheme();
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [channelTab, setChannelTab] = useState<ChannelTab>("email");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedMessengerId, setSelectedMessengerId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const [selectedWeightCaseId, setSelectedWeightCaseId] = useState<string | null>(null);
  const [selectedCaseCycleIndex, setSelectedCaseCycleIndex] = useState(0);
  const [caseWizardOpen, setCaseWizardOpen] = useState(false);
  const [signalWizardOpen, setSignalWizardOpen] = useState(false);
  const [adminWikiOpen, setAdminWikiOpen] = useState(false);
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
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
  const [deleteResultLoading, setDeleteResultLoading] = useState(false);
  const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [caseWizardDraft, setCaseWizardDraft] = useState<SimCase>(() => createEmptyCase(1));
  const [signalWizardDraft, setSignalWizardDraft] = useState<EmailCase | MessengerCase | VideoCase>(() => createEmptyEmail(1));
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleRow[]>([]);
  const [comparisonSelection, setComparisonSelection] = useState<number[]>([]);

  const {
    queryClient,
    staffQuery,
    contentQuery,
    resultsQuery,
    resultDetailQuery,
    comparisonDetailQueries,
    invalidateRuntimeContent,
  } = useAdminContent({
    resultStatusFilter,
    resultParticipantFilter,
    selectedResultId,
    comparisonSelection,
    comparisonEnabled: tab === "comparison",
  });
  useAdminPermissions(staffQuery.data, staffQuery.isLoading);

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
    if (contentQuery.data) {
      setScheduleDraft(buildScheduleRows(contentQuery.data));
    }
    if (resultsQuery.data && !selectedResultId && resultsQuery.data[0]) {
      setSelectedResultId(resultsQuery.data[0].id);
    }
  }, [contentQuery.data, resultsQuery.data, selectedCaseId, selectedChatId, selectedEmailId, selectedMessengerId, selectedResultId, selectedVideoId]);

  useEffect(() => {
    const found = contentQuery.data?.cases?.find((item: SimCase) => item.id === selectedCaseId);
    setCaseDraft(found ? deepClone(found) : null);
    setSelectedCaseCycleIndex(0);
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

  useEffect(() => {
    if (caseWizardOpen) {
      writeDraftToStorage(DRAFT_STORAGE_KEYS.caseWizard, caseWizardDraft);
    }
  }, [caseWizardDraft, caseWizardOpen]);

  useEffect(() => {
    if (signalWizardOpen) {
      writeDraftToStorage(DRAFT_STORAGE_KEYS.signalWizard, {
        mode: signalWizardMode,
        draft: signalWizardDraft,
      });
    }
  }, [signalWizardDraft, signalWizardMode, signalWizardOpen]);

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
    () => buildWeightedCompetencyProfile(activeCases, {}),
    [activeCases],
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
  const completedResults = useMemo(
    () => ((resultsQuery.data || []) as any[]).filter((item) => item.technicalStatus === "completed" || item.technicalStatus === "interrupted"),
    [resultsQuery.data],
  );
  const completedResultIds = useMemo(
    () => new Set(completedResults.map((item) => Number(item.id))),
    [completedResults],
  );

  // ─── Обзор кабинета (раздел "dashboard") ─────────────────────
  const overviewMetrics = useMemo(() => {
    const list = (contentQuery.data?.cases || []) as any[];
    const total = list.length;
    const withCycles = list.filter((item) => (item.cycles?.length || 0) > 0).length;
    const noCycles = total - withCycles;
    const completed = completedResults.length;
    const scores = completedResults
      .map((item) => Number(item.report?.overallAvg ?? item.averageScore ?? 0))
      .filter((value) => value > 0);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const readiness = total > 0 ? Math.round((withCycles / total) * 100) : 0;
    return { total, withCycles, noCycles, completed, avg, readiness };
  }, [contentQuery.data?.cases, completedResults]);

  const overviewReadinessItems = useMemo(() => {
    const items: { tone: "ok" | "warn" | "err"; title: string; note: string; tab?: TabKey }[] = [];
    if (overviewMetrics.total === 0) {
      items.push({ tone: "err", title: "Нет ни одного кейса", note: "Создайте первый кейс, чтобы запустить симуляцию", tab: "cases" });
    } else if (overviewMetrics.noCycles > 0) {
      items.push({ tone: "warn", title: `Кейсы без циклов: ${overviewMetrics.noCycles}`, note: "Без циклов кейс нельзя пройти — добавьте события", tab: "cases" });
    } else {
      items.push({ tone: "ok", title: "У всех кейсов есть циклы", note: `${overviewMetrics.withCycles} из ${overviewMetrics.total}` });
    }
    items.push(
      overviewMetrics.completed > 0
        ? { tone: "ok", title: `Завершённых прохождений: ${overviewMetrics.completed}`, note: "Есть данные для проверки оценки", tab: "results" }
        : { tone: "warn", title: "Нет завершённых прохождений", note: "Проведите тестовый прогон, чтобы проверить настройку", tab: "results" },
    );
    items.push(
      competencies.length > 0
        ? { tone: "ok", title: `Компетенций в профиле: ${competencies.length}`, note: "Профиль НАДО рассчитывается по этим компетенциям" }
        : { tone: "err", title: "Профиль компетенций пуст", note: "Заполните компетенции в настройках", tab: "settings" },
    );
    return items;
  }, [overviewMetrics, competencies.length]);
  useEffect(() => {
    if (tab !== "comparison") {
      return;
    }

    setComparisonSelection((current) => {
      const cleaned = current.filter((id) => completedResultIds.has(id)).slice(0, MAX_COMPARISON_ITEMS);
      if (cleaned.length > 0 || completedResults.length === 0) {
        return cleaned;
      }

      return completedResults.slice(0, Math.min(3, MAX_COMPARISON_ITEMS)).map((item) => Number(item.id));
    });
  }, [completedResultIds, completedResults, tab]);
  const comparisonRows: ComparisonResultRow[] = comparisonSelection
    .map((id, index) => {
      const listItem = completedResults.find((item) => Number(item.id) === id);
      const detailQuery = comparisonDetailQueries[index];
      const detail = detailQuery?.data || null;
      const report = detail ? buildReportFromSessionDetails(detail, settingsDraft as SimulationRuntimeSettings) : null;
      const session = detail?.session || {};
      const competencyAverages = (
        report?.compScoresMap ||
        detail?.result?.competencyAverages ||
        listItem?.competencyAverages ||
        {}
      ) as Record<string, number>;

      if (!listItem && !detail) {
        return null;
      }

      return {
        id,
        participantName: report?.participantName || session.participantName || listItem?.participantName || `Участник #${id}`,
        evaluatorName: report?.assessorName || session.evaluatorName || listItem?.evaluatorName || "",
        difficulty: report?.difficulty || session.difficulty || listItem?.difficulty || "medium",
        technicalStatus: report?.technicalStatus || session.technicalStatus || listItem?.technicalStatus || "completed",
        startedAt: report?.startedAt || session.startedAt || listItem?.startedAt || "",
        completedAt: report?.completedAt || session.completedAt || listItem?.completedAt || null,
        totalScore: Number(report?.totalScore ?? detail?.result?.totalScore ?? listItem?.totalScore ?? 0),
        averageScore: Number(report?.avgScore ?? detail?.result?.averageScore ?? listItem?.averageScore ?? 0),
        answersCount: Number(report?.totalDecisions ?? detail?.answers?.length ?? 0),
        competencyAverages,
        report,
        detail,
        isLoading: Boolean(detailQuery?.isLoading),
        isError: Boolean(detailQuery?.isError),
      };
    })
    .filter((item): item is ComparisonResultRow => Boolean(item))
    .slice(0, MAX_COMPARISON_ITEMS);
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
  const caseSetupIssues = useMemo(
    () => buildCaseSetupIssues(caseDraft),
    [caseDraft],
  );
  const caseRouteRows = useMemo(
    () => buildCaseRouteRows(caseDraft),
    [caseDraft],
  );
  const caseCompletionPercent = caseDraft
    ? Math.max(10, Math.min(100, 100 - caseSetupIssues.length * 8))
    : 0;
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
    setComparisonSelection((current) => current.filter((id) => completedResultIds.has(id)).slice(0, MAX_COMPARISON_ITEMS));
  }, [completedResultIds]);

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
      await invalidateRuntimeContent();
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
      if (tab === "schedule") {
        await saveSchedule();
        return;
      }
      await invalidateRuntimeContent();
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/results"] });
    } catch (err: any) {
      setError(err.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const publishCurrentCase = async () => {
    if (!caseDraft) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const publishedDraft = { ...caseDraft, isActive: true };
      const response = await apiRequest("POST", "/api/admin/cases", publishedDraft);
      const payload = await response.json();
      setCaseDraft(publishedDraft);
      setSelectedCaseId(payload.id);
      await invalidateRuntimeContent();
    } catch (err: any) {
      setError(err.message || "Не удалось опубликовать кейс");
    } finally {
      setSaving(false);
    }
  };

  const focusCaseLogicPreview = () => {
    document.getElementById("admin-case-logic-preview")?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  const updateScheduleRow = (rowId: string, patch: Partial<ScheduleRow>) => {
    setScheduleDraft((current) => current.map((row) => (
      row.rowId === rowId ? { ...row, ...patch } : row
    )));
  };

  const moveScheduleRow = (rowId: string, direction: -1 | 1) => {
    setScheduleDraft((current) => {
      const index = current.findIndex((row) => row.rowId === rowId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return autoAssignScheduleTimes(next);
    });
  };

  const saveSchedule = async () => {
    setSaving(true);
    setError("");
    try {
      const casesById = new Map(((contentQuery.data?.cases || []) as SimCase[]).map((item) => [item.id, item]));
      const emailsById = new Map(((contentQuery.data?.emailCases || []) as EmailCase[]).map((item) => [item.id, item]));
      const messagesById = new Map(((contentQuery.data?.messengerCases || []) as MessengerCase[]).map((item) => [item.id, item]));
      const videosById = new Map(((contentQuery.data?.videoCases || []) as VideoCase[]).map((item) => [item.id, item]));

      for (let index = 0; index < scheduleDraft.length; index += 1) {
        const row = scheduleDraft[index];
        const timing = {
          arrivalMinute: row.arrivalMinute ?? index * 10,
          minIntervalSeconds: row.minIntervalSeconds,
          maxIntervalSeconds: row.maxIntervalSeconds,
          decisionDeadlineSeconds: row.decisionDeadlineSeconds,
          reminderIntervalSeconds: row.reminderIntervalSeconds,
        };
        const sortOrder = index + 1;

        if (row.sourceType === "main_case") {
          const source = casesById.get(row.id);
          if (source) {
            await apiRequest("POST", "/api/admin/cases", { ...source, sortOrder, timing });
          }
        }

        if (row.sourceType === "email") {
          const source = emailsById.get(row.id);
          if (source) {
            await apiRequest("POST", "/api/admin/email-cases", {
              ...source,
              sortOrder,
              arrivalMinute: timing.arrivalMinute,
              timing,
            });
          }
        }

        if (row.sourceType === "messenger") {
          const source = messagesById.get(row.id);
          if (source) {
            await apiRequest("POST", "/api/admin/messenger-cases", {
              ...source,
              sortOrder,
              arrivalMinute: timing.arrivalMinute,
              timing,
            });
          }
        }

        if (row.sourceType === "video") {
          const source = videosById.get(row.id);
          if (source) {
            await apiRequest("POST", "/api/admin/video-cases", {
              ...source,
              sortOrder,
              arrivalMinute: timing.arrivalMinute,
              timing,
            });
          }
        }
      }

      await invalidateRuntimeContent();
    } catch (err: any) {
      setError(err.message || "Не удалось сохранить расписание");
    } finally {
      setSaving(false);
    }
  };

  const openCaseWizard = () => {
    const nextOrder = (contentQuery.data?.cases?.length || 0) + 1;
    setCaseWizardDraft(readDraftFromStorage(DRAFT_STORAGE_KEYS.caseWizard, createEmptyCase(nextOrder)));
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

    const fallbackDraft =
      mode === "email"
        ? createEmptyEmail(nextOrder)
        : mode === "messenger"
          ? createEmptyMessenger(nextOrder)
          : createEmptyVideo(nextOrder);
    const stored = readDraftFromStorage<{ mode: ChannelTab; draft: EmailCase | MessengerCase | VideoCase } | null>(
      DRAFT_STORAGE_KEYS.signalWizard,
      null,
    );

    setSignalWizardMode(mode);
    setSignalWizardStep(0);
    setSignalWizardDraft(stored?.mode === mode ? stored.draft : fallbackDraft);
    setSignalWizardOpen(true);
  };

  const confirmCaseWizard = async () => {
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

    setSaving(true);
    setError("");
    try {
      const response = await apiRequest("POST", "/api/admin/cases", nextDraft);
      const payload = await response.json();
      const savedId = payload.id || nextDraft.id;
      clearDraftFromStorage(DRAFT_STORAGE_KEYS.caseWizard);
      await invalidateRuntimeContent();
      setSelectedCaseId(savedId);
      setCaseDraft({ ...nextDraft, id: savedId });
      setCaseWizardOpen(false);
    } catch (err: any) {
      setError(err.message || "Не удалось создать кейс. Черновик сохранён в браузере.");
    } finally {
      setSaving(false);
    }
  };

  const confirmSignalWizard = async () => {
    setSaving(true);
    setError("");

    if (signalWizardMode === "email") {
      const nextDraft = deepClone(signalWizardDraft as EmailCase);
      nextDraft.id = nextDraft.id || `EMAIL-${String((contentQuery.data?.emailCases?.length || 0) + 1).padStart(2, "0")}`;
      try {
        const response = await apiRequest("POST", "/api/admin/email-cases", nextDraft);
        const payload = await response.json();
        const savedId = payload.id || nextDraft.id;
        clearDraftFromStorage(DRAFT_STORAGE_KEYS.signalWizard);
        await invalidateRuntimeContent();
        setSelectedEmailId(savedId);
        setEmailDraft({ ...nextDraft, id: savedId });
        setSignalWizardOpen(false);
      } catch (err: any) {
        setError(err.message || "Не удалось создать письмо. Черновик сохранён в браузере.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (signalWizardMode === "messenger") {
      const nextDraft = deepClone(signalWizardDraft as MessengerCase);
      nextDraft.id = nextDraft.id || `MSG-${String((contentQuery.data?.messengerCases?.length || 0) + 1).padStart(2, "0")}`;
      try {
        const response = await apiRequest("POST", "/api/admin/messenger-cases", nextDraft);
        const payload = await response.json();
        const savedId = payload.id || nextDraft.id;
        clearDraftFromStorage(DRAFT_STORAGE_KEYS.signalWizard);
        await invalidateRuntimeContent();
        setSelectedMessengerId(savedId);
        setMessengerDraft({ ...nextDraft, id: savedId });
        setSignalWizardOpen(false);
      } catch (err: any) {
        setError(err.message || "Не удалось создать сообщение. Черновик сохранён в браузере.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (signalWizardMode === "video") {
      const nextDraft = deepClone(signalWizardDraft as VideoCase);
      nextDraft.id = nextDraft.id || `VIDEO-${String((contentQuery.data?.videoCases?.length || 0) + 1).padStart(2, "0")}`;
      try {
        const response = await apiRequest("POST", "/api/admin/video-cases", nextDraft);
        const payload = await response.json();
        const savedId = payload.id || nextDraft.id;
        clearDraftFromStorage(DRAFT_STORAGE_KEYS.signalWizard);
        await invalidateRuntimeContent();
        setSelectedVideoId(savedId);
        setVideoDraft({ ...nextDraft, id: savedId });
        setSignalWizardOpen(false);
      } catch (err: any) {
        setError(err.message || "Не удалось создать видеосигнал. Черновик сохранён в браузере.");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(false);
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

  const deleteSelectedResult = async () => {
    if (!selectedResultId || !resultDetailQuery.data) {
      return;
    }

    const participantName = resultDetailQuery.data.session?.participantName || "выбранного участника";
    const confirmed = window.confirm(`Удалить результат прохождения ${participantName}? Это действие нельзя отменить.`);
    if (!confirmed) {
      return;
    }

    setDeleteResultLoading(true);
    setError("");
    try {
      await apiRequest("DELETE", `/api/admin/results/${selectedResultId}`);
      setSelectedResultId(null);
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/results"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/staff/results/detail"] });
    } catch (err: any) {
      setError(err.message || "Не удалось удалить результат.");
    } finally {
      setDeleteResultLoading(false);
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

  const contentLoaded = !!contentQuery.data;
  const activeAdminVisual = ADMIN_VISUALS[tab];
  const comparisonOverallScores = comparisonRows.map((row) => getComparisonOverallScore(row));
  const comparisonTotalScores = comparisonRows.map((row) => Number(row.totalScore || 0));
  const comparisonAnswerCounts = comparisonRows.map((row) => Number(row.answersCount || 0));
  const minComparisonOverallScore = Math.min(...comparisonOverallScores);
  const maxComparisonOverallScore = Math.max(...comparisonOverallScores);
  const minComparisonTotalScore = Math.min(...comparisonTotalScores);
  const maxComparisonTotalScore = Math.max(...comparisonTotalScores);
  const minComparisonAnswersCount = Math.min(...comparisonAnswerCounts);
  const maxComparisonAnswersCount = Math.max(...comparisonAnswerCounts);
  const comparisonMetricRows: ComparisonMetricDefinition[] = [
    {
      label: "Общая оценка",
      render: (row: ComparisonResultRow) => {
        if (row.isLoading) return "...";
        const value = getComparisonOverallScore(row);
        return renderComparisonMetricValue(formatScoreValue(value), getComparisonMetricColor(value, minComparisonOverallScore, maxComparisonOverallScore));
      },
    },
    {
      label: "Итоговые баллы",
      render: (row: ComparisonResultRow) => {
        if (row.isLoading) return "...";
        const value = Number(row.totalScore || 0);
        return renderComparisonMetricValue(String(Math.round(value)), getComparisonMetricColor(value, minComparisonTotalScore, maxComparisonTotalScore));
      },
    },
    {
      label: "Ответов",
      render: (row: ComparisonResultRow) => {
        if (row.isLoading) return "...";
        const value = Number(row.answersCount || 0);
        return renderComparisonMetricValue(String(value), getComparisonMetricColor(value, minComparisonAnswersCount, maxComparisonAnswersCount));
      },
    },
    {
      label: "Сильные компетенции",
      render: (row: ComparisonResultRow) => row.isLoading ? "..." : formatCompetencyHighlights(row.competencyAverages, competencies, "strong"),
    },
    {
      label: "Зоны роста",
      render: (row: ComparisonResultRow) => row.isLoading ? "..." : formatCompetencyHighlights(row.competencyAverages, competencies, "growth"),
    },
  ];
  const comparisonCharacteristicRows = [
    { label: "Код результата", render: (row: ComparisonResultRow) => `#${row.id}` },
    { label: "Статус", render: (row: ComparisonResultRow) => formatTechnicalStatus(row.technicalStatus) },
    { label: "Сложность", render: (row: ComparisonResultRow) => formatDifficultyLabel(row.difficulty) },
    { label: "Оценщик", render: (row: ComparisonResultRow) => row.evaluatorName || "—" },
    { label: "Старт", render: (row: ComparisonResultRow) => formatDateTimeLabel(row.startedAt) },
    { label: "Завершение", render: (row: ComparisonResultRow) => formatDateTimeLabel(row.completedAt) },
    { label: "Длительность", render: (row: ComparisonResultRow) => formatDurationBetween(row.startedAt, row.completedAt) },
  ];
  const comparisonInsights = buildComparisonInsights(comparisonRows, competencies);
  const comparisonGroupConclusion = buildComparisonGroupConclusion(comparisonInsights);

  if (staffQuery.isLoading || contentQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0d1117] text-white">Загрузка админки...</div>;
  }

  if (!contentLoaded) {
    return null;
  }

  return (
    <div
      className={`dns-product-shell dns-admin-shell dns-visual-shell dns-visual-shell--product ${themeClass} relative`}
      style={{
        backgroundImage: `url(${theme === "light" ? BRAND_ASSETS.backgrounds.productLight : BRAND_ASSETS.backgrounds.productDark})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      }}
    >
      <BrandVisualBackdrop variant="product" />
      <div className="dns-theme-overlay absolute inset-0 bg-gradient-to-b from-[#0d1421c9] via-[#16213ef0] to-[#0d1421f7]" />
      <div className="dns-page-frame max-w-[1560px]">
        <header className="dns-brand-header dns-admin-header-surface">
          <div className="dns-brand-title">
            <BrandMark compact />
            <div>
              <div className="dns-brand-kicker">DNS SimCenter</div>
              <h1 className="dns-brand-heading">Администрирование симуляции</h1>
              <p className="dns-brand-subtitle">Контент, каналы, тайминги, результаты и параметры хода симуляции.</p>
            </div>
          </div>
          <div className="dns-header-actions dns-admin-header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Button
              variant="outline"
              className="border-[#19d3ae]/40 bg-[#19d3ae]/10 text-[#aaf7e7]"
              onClick={() => setAuditHistoryOpen(true)}
            >
              <History className="mr-2 h-4 w-4" />
              История изменений
            </Button>
            <Button variant="outline" className="border-[#4a9eff]/45 bg-[#4a9eff]/10 text-[#cfe6ff]" onClick={() => setAdminWikiOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" />
              Wiki
            </Button>
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

        <div className={`dns-admin-dashboard-shell dns-admin-dashboard-shell--${tab}`}>
          <aside className="dns-admin-structure-nav" aria-label="Основные разделы администрирования">
            <div className="dns-admin-structure-nav-head">
              <span>Рабочий центр</span>
              <strong>Управление</strong>
            </div>
            <nav>
              {(["dashboard", "cases", "channels", "schedule", "results", "comparison", "settings"] as TabKey[]).map((item) => {
                const itemVisual = ADMIN_VISUALS[item];
                const ItemIcon = ADMIN_NAV_ICONS[item];
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={tab === item ? "dns-admin-structure-nav-item dns-admin-structure-nav-item--active" : "dns-admin-structure-nav-item"}
                    title={itemVisual.label}
                  >
                    <ItemIcon aria-hidden="true" />
                    <span>{itemVisual.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="dns-admin-structure-nav-footer">
              <button type="button" className="dns-admin-structure-nav-item" onClick={() => setAdminWikiOpen(true)}>
                <BookOpen aria-hidden="true" />
                <span>Wiki</span>
              </button>
              <button type="button" className="dns-admin-structure-nav-item" onClick={() => setAuditHistoryOpen(true)}>
                <History aria-hidden="true" />
                <span>История</span>
              </button>
              <div className="dns-admin-structure-profile">
                <span>{staffQuery.data?.displayName?.slice(0, 1) || "A"}</span>
                <div>
                  <strong>{staffQuery.data?.displayName || "Администратор"}</strong>
                  <small>Полный доступ</small>
                </div>
              </div>
            </div>
          </aside>

          <main className={`dns-admin-dashboard-main dns-admin-dashboard-main--${tab}`}>
        {error && <div className="mb-4 rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/10 px-4 py-3 text-sm text-[#ff9999]">{error}</div>}

        <AdminWikiDialog open={adminWikiOpen} onOpenChange={setAdminWikiOpen} tab={tab} />
        <AdminAuditHistory open={auditHistoryOpen} onOpenChange={setAuditHistoryOpen} />

        {tab !== "dashboard" && <AdminVisualPanel visual={activeAdminVisual} />}

        {tab === "dashboard" && (
          <div className="dns-admin-overview flex flex-col gap-5">
            {/* Hero */}
            <section className="dns-admin-overview-hero relative overflow-hidden rounded-2xl border border-[#2b3a55] p-6 2xl:p-7"
              style={{ background: "radial-gradient(80% 140% at 88% -10%, rgba(255,107,0,0.22), transparent 60%), radial-gradient(70% 120% at 8% 120%, rgba(0,212,170,0.16), transparent 55%), linear-gradient(120deg, #15203a, #0e1626)" }}>
              <div className="relative flex items-center gap-6">
                <div className="flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#00d4aa]">Центр управления симуляцией</div>
                  <h2 className="mt-2 text-2xl 2xl:text-[27px] font-black leading-tight text-white">
                    Здравствуйте, {staffQuery.data?.displayName || "Администратор"}.
                  </h2>
                  <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#b9c6dc]">
                    Базовый профиль компетенций задан. Дальше вы настраиваете кейсы, веса и параметры — и сразу видите, как это меняет оценку.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={() => setTab("cases")} className="bg-[#FF6B00] text-white hover:bg-[#FF6B00]/90">Перейти к кейсам</Button>
                    <Button variant="outline" className="border-white/16 bg-white/6 text-white hover:bg-white/12" onClick={openCaseWizard}>Создать кейс</Button>
                  </div>
                </div>
                <img src={ADMIN_VISUALS.dashboard.primarySrc} alt={ADMIN_VISUALS.dashboard.primaryAlt}
                  className="hidden h-[150px] w-auto select-none object-contain drop-shadow-[0_14px_30px_rgba(0,212,170,0.35)] lg:block" />
              </div>
            </section>

            {/* KPI */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[
                { label: "Кейсов в библиотеке", value: String(overviewMetrics.total), accent: "rgba(255,107,0,0.5)", hint: `${overviewMetrics.withCycles} с циклами` },
                { label: "Завершённых прохождений", value: String(overviewMetrics.completed), accent: "rgba(0,212,170,0.5)", hint: "за всё время" },
                { label: "Средний балл", value: overviewMetrics.avg > 0 ? overviewMetrics.avg.toFixed(1) : "—", accent: "rgba(74,158,255,0.5)", hint: "по завершённым" },
                { label: "Готовность кейсов", value: `${overviewMetrics.readiness}%`, accent: "rgba(255,193,7,0.5)", hint: overviewMetrics.noCycles > 0 ? `${overviewMetrics.noCycles} без циклов` : "все с циклами" },
              ].map((kpi) => (
                <div key={kpi.label} className="relative overflow-hidden rounded-xl border border-[#2a3a4e] bg-[#141c2b]/72 p-4 backdrop-blur">
                  <div className="absolute -right-7 -top-7 h-28 w-28 rounded-full opacity-50" style={{ background: `radial-gradient(circle, ${kpi.accent}, transparent 70%)` }} />
                  <div className="relative text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8890a8]">{kpi.label}</div>
                  <div className="relative mt-2 text-[30px] font-black leading-none tabular-nums text-white">{kpi.value}</div>
                  <div className="relative mt-1.5 text-[11px] font-semibold text-[#8aa2c4]">{kpi.hint}</div>
                </div>
              ))}
            </div>

            {/* Row: что проверить + радар */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr] items-start">
              <section className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/72 p-5 backdrop-blur">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-[#FF6B00]" />
                  <h3 className="text-sm font-black text-white">Что проверить до запуска</h3>
                  <span className="ml-auto rounded-full border border-[#2a3a4e] bg-[#101826]/80 px-2.5 py-0.5 text-[10px] font-semibold text-[#8aa2c4]">{overviewReadinessItems.length} пунктов</span>
                </div>
                <div className="mt-4 flex flex-col gap-2.5">
                  {overviewReadinessItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-[#243244] bg-[#101826]/55 px-3 py-2.5">
                      <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-md text-[13px] font-black ${
                        it.tone === "ok" ? "bg-[#00d4aa]/16 text-[#00d4aa]" : it.tone === "warn" ? "bg-[#ffc107]/16 text-[#ffc107]" : "bg-[#ff4444]/16 text-[#ff4444]"
                      }`}>{it.tone === "ok" ? "✓" : it.tone === "warn" ? "▲" : "!"}</span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-white">{it.title}</div>
                        <div className="text-[11.5px] text-[#8aa2c4]">{it.note}</div>
                      </div>
                      {it.tab && (
                        <button type="button" onClick={() => setTab(it.tab as TabKey)} className="ml-auto flex-none text-[11.5px] font-bold text-[#FF6B00] hover:underline">Открыть →</button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/72 p-5 backdrop-blur">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#00d4aa]" />
                  <h3 className="text-sm font-black text-white">Профиль компетенций</h3>
                  <span className="ml-auto rounded-full border border-[#2a3a4e] bg-[#101826]/80 px-2.5 py-0.5 text-[10px] font-semibold text-[#8aa2c4]">НАДО / ФАКТ</span>
                </div>
                <div className="mt-2 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarChartData} outerRadius="70%">
                      <PolarGrid stroke="#273449" />
                      <PolarAngleAxis dataKey="competency" tick={{ fill: "#a7b7cf", fontSize: 10 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "#5e7492", fontSize: 10 }} />
                      <RechartsTooltip contentStyle={{ background: "#101826", border: "1px solid #2a3a4e", borderRadius: 12 }} labelStyle={{ color: "#fff" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Radar name="НАДО" dataKey="target" stroke="#4a9eff" fill="#4a9eff" fillOpacity={0.12} strokeWidth={2} />
                      <Radar name="ФАКТ" dataKey="fact" stroke="#00d4aa" fill="#00d4aa" fillOpacity={0.12} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === "cases" && (
          <div className="dns-mobile-stack dns-admin-main-grid dns-admin-cases-layout grid gap-5 2xl:gap-6 items-start">
            <div className="dns-admin-case-nav rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4 2xl:p-5 flex flex-col">
              <div className="dns-admin-case-nav-header flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-white">Основные кейсы</div>
                <div className="dns-admin-case-nav-actions">
                  <Button size="sm" variant="outline" className="dns-admin-case-nav-action border-[#2a3a4e] bg-transparent text-[#8890a8]" onClick={() => selectedCaseId && reorderCase(selectedCaseId, -1)} disabled={!selectedCaseId} aria-label="Поднять выбранный кейс выше" title="Поднять выбранный кейс выше">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="dns-admin-case-nav-action border-[#2a3a4e] bg-transparent text-[#8890a8]" onClick={() => selectedCaseId && reorderCase(selectedCaseId, 1)} disabled={!selectedCaseId} aria-label="Опустить выбранный кейс ниже" title="Опустить выбранный кейс ниже">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={openCaseWizard}>Новый</Button>
                </div>
              </div>
              <div className="dns-admin-case-list space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {contentQuery.data.cases.map((item: SimCase, index: number) => (
                  <div key={item.id} className={`dns-admin-case-list-item w-full rounded-lg border px-3 py-2 ${selectedCaseId === item.id ? "dns-admin-case-list-item--active border-[#FF6B00] bg-[#FF6B00]/10" : "border-[#2a3a4e]"}`}>
                    <div className="dns-admin-case-order-index" aria-hidden="true">{index + 1}</div>
                    <button onClick={() => setSelectedCaseId(item.id)} className="dns-admin-case-list-main w-full text-left">
                      <div className="dns-admin-case-list-title text-sm text-white">{item.title || item.id}</div>
                      <div className="dns-admin-case-list-meta text-xs text-[#8890a8]">{item.id}</div>
                    </button>
                  </div>
                ))}
              </div>
              {caseDraft && (
                <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Циклы кейса</div>
                      <div className="mt-1 text-[11px] text-[#8aa2c4]">{caseDraft.cycles?.length || 0} событий внутри выбранного кейса</div>
                    </div>
                    <span className="rounded-full border border-[#2a3a4e] bg-[#141c2b] px-2 py-1 text-[10px] text-[#cbd8ef]">
                      Вкладка
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(caseDraft.cycles || []).map((cycle, index) => (
                      <button
                        key={`${cycle.id || "cycle"}-${index}`}
                        type="button"
                        onClick={() => setSelectedCaseCycleIndex(index)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                          selectedCaseCycleIndex === index
                            ? "border-[#4a9eff] bg-[#4a9eff]/12"
                            : "border-[#2a3a4e] bg-[#0d1522]/70 hover:border-[#3b5878]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">Цикл {index + 1}</span>
                          <span className="text-[10px] text-[#8aa2c4]">{(cycle.options || []).length} отв.</span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#8aa2c4]">
                          {cycle.situation || cycle.signal?.content || "Пустой цикл"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="dns-admin-case-note mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Методическое пояснение</div>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#cbd8ef]">
                  <p>Кейс в этой системе моделирует управленческую ситуацию в магазине: сигнал, контекст, цикл развития проблемы, варианты реакции и последствия для показателей и компетенций.</p>
                  <p>Администратор настраивает саму механику кейса: что происходит, через какой канал приходит сигнал, какие ответы доступны студенту и как каждый ответ влияет на магазин и итоговый профиль.</p>
                  <p>Основные компетенции задают ожидаемую зону оценки, а варианты ответа формируют фактический вклад кейса в результат студента. Чем точнее настроены развилки, тем честнее будет итоговая оценка.</p>
                </div>
              </div>
            </div>
            <div className="dns-admin-case-workspace grid gap-5 min-[1900px]:grid-cols-[minmax(920px,1fr),380px] min-[1900px]:gap-6 items-start">
              <div className="dns-admin-case-editor-panel min-w-0 rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4 2xl:p-5">
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
                    selectedCycleIndex={selectedCaseCycleIndex}
                    onSelectedCycleIndexChange={setSelectedCaseCycleIndex}
                  />
                )}
              </div>
              <div className="dns-admin-case-impact-panel min-w-0 rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4 min-[1900px]:sticky min-[1900px]:top-4 min-[1900px]:max-h-[calc(100vh-2rem)] min-[1900px]:overflow-y-auto min-[1900px]:overflow-x-hidden min-[1900px]:p-5 min-[1900px]:pr-4 custom-scroll">
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
                          { key: "aggregate", label: "Профиль кейса", color: "#4a9eff" },
                          { key: "selected", label: "Регулируемый вклад", color: "#00d4aa" },
                        ]}
                      />
                    </div>
                    <div id="admin-case-logic-preview" className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">Предпросмотр логики</div>
                          <div className="mt-1 text-[11px] leading-relaxed text-[#8aa2c4]">
                            Проверка связей «ответ → цикл» без запуска реальной сессии.
                          </div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${caseSetupIssues.length === 0 ? "border-[#00d4aa]/40 text-[#7fffd4]" : "border-[#ffb000]/40 text-[#ffd36e]"}`}>
                          {caseSetupIssues.length === 0 ? "Готово" : `${caseSetupIssues.length} замеч.`}
                        </span>
                      </div>
                      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1 custom-scroll">
                        {caseRouteRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-[#31455f] px-3 py-3 text-[11px] text-[#8aa2c4]">
                            Добавьте активные варианты ответа, чтобы увидеть переходы.
                          </div>
                        )}
                        {caseRouteRows.map((row) => (
                          <div key={row.id} className="rounded-lg border border-[#223245] bg-[#0d1522]/75 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-semibold text-[#cfe6ff]">{row.from}</span>
                              <span className="text-[#ffb27a]">→ {row.targetLabel}</span>
                            </div>
                            <div className="mt-1 line-clamp-2 text-[11px] text-[#8aa2c4]">{row.text}</div>
                            {row.delay > 0 && <div className="mt-1 text-[10px] text-[#7fffd4]">Задержка: {row.delay} сек.</div>}
                          </div>
                        ))}
                      </div>
                      {caseSetupIssues.length > 0 && (
                        <div className="mt-3 rounded-lg border border-[#ffb000]/25 bg-[#ffb000]/8 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffd36e]">Что исправить до запуска</div>
                          <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-[#ffe6a6]">
                            {caseSetupIssues.slice(0, 5).map((issue) => <li key={issue}>• {issue}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="dns-admin-case-control-panel mt-4">
                      <div className="dns-admin-case-control-head">
                        <div>
                          <span>Статус кейса</span>
                          <strong>{caseDraft.isActive ? "Опубликован" : "Черновик"}</strong>
                        </div>
                        <b>{caseCompletionPercent}%</b>
                      </div>
                      <div className="dns-admin-case-progress" aria-label={`Заполненность кейса ${caseCompletionPercent}%`}>
                        <span style={{ width: `${caseCompletionPercent}%` }} />
                      </div>
                      <div className="dns-admin-case-control-stats">
                        <div><strong>{caseDraft.cycles?.length || 0}</strong><span>циклов</span></div>
                        <div><strong>{caseRouteRows.length}</strong><span>переходов</span></div>
                        <div><strong>{caseSetupIssues.length}</strong><span>замечаний</span></div>
                      </div>
                      <div className="dns-admin-case-control-actions">
                        <Button type="button" onClick={saveCurrent} disabled={saving || uploading}>
                          <Save className="mr-2 h-4 w-4" />
                          {saving ? "Сохраняем..." : "Сохранить"}
                        </Button>
                        <Button type="button" variant="outline" onClick={focusCaseLogicPreview}>
                          <Eye className="mr-2 h-4 w-4" />
                          Предпросмотр
                        </Button>
                        <Button type="button" variant="outline" onClick={focusCaseLogicPreview}>
                          {caseSetupIssues.length === 0 ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                          Проверить логику
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setAdminWikiOpen(true)}>
                          <BookOpen className="mr-2 h-4 w-4" />
                          Wiki раздела
                        </Button>
                        <Button type="button" className="dns-admin-publish-button" onClick={publishCurrentCase} disabled={saving || caseSetupIssues.length > 0}>
                          Опубликовать
                        </Button>
                      </div>
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
              <div className="grid gap-5 xl:grid-cols-[300px,minmax(680px,1fr)] 2xl:grid-cols-[320px,minmax(760px,1fr),380px] 2xl:gap-6">
                <div className="min-w-0 rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4 2xl:p-5 h-full">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-white">Письма</div>
                    <Button size="sm" onClick={() => openSignalWizard("email")}>Новое</Button>
                  </div>
                  <div className="dns-admin-side-list space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {contentQuery.data.emailCases.map((item: EmailCase) => (
                      <button key={item.id} onClick={() => setSelectedEmailId(item.id)} className={`w-full rounded-lg border px-3 py-2 text-left ${selectedEmailId === item.id ? "border-[#4a9eff] bg-[#4a9eff]/10" : "border-[#2a3a4e]"}`}>
                        <div className="text-sm text-white">{item.subject || item.id}</div>
                        <div className="text-xs text-[#8890a8]">{item.id}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-w-0 rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4 2xl:p-5 h-full">
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
                    <div className="dns-admin-side-list space-y-2 max-h-[240px] overflow-y-auto">
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
                  <div className="dns-admin-action-block mt-4 justify-start">
                    <Button size="sm" className="bg-[#00d4aa] hover:bg-[#00c39c] text-[#0d1117]" onClick={saveChatDraft}>
                      Сохранить чат
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#ff4444]/30 text-[#ff9999] bg-transparent" onClick={deleteChatDraft}>
                      Удалить чат
                    </Button>
                  </div>
                </div>
                <div className="grid gap-5 xl:grid-cols-[300px,minmax(680px,1fr)] 2xl:grid-cols-[320px,minmax(760px,1fr),380px] 2xl:gap-6">
                  <div className="min-w-0 rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4 2xl:p-5 h-full">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-white">Сообщения</div>
                      <Button size="sm" onClick={() => openSignalWizard("messenger")}>Новое</Button>
                    </div>
                    <div className="dns-admin-side-list space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                      {contentQuery.data.messengerCases.map((item: MessengerCase) => (
                        <button key={item.id} onClick={() => setSelectedMessengerId(item.id)} className={`w-full rounded-lg border px-3 py-2 text-left ${selectedMessengerId === item.id ? "border-[#00d4aa] bg-[#00d4aa]/10" : "border-[#2a3a4e]"}`}>
                          <div className="text-sm text-white">{item.senderName || item.id}</div>
                          <div className="text-xs text-[#8890a8]">{item.id}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4 2xl:p-5 h-full">
                    {messengerDraft && <EntityEditor title="Редактор сообщения" entity={messengerDraft} assets={assets} competencies={competencies} caseSourceOptions={caseSourceOptions} emailSenderOptions={emailSenderOptions} emailDepartmentOptions={emailDepartmentOptions} messengerSenderOptions={messengerSenderOptions} messengerRoleOptions={messengerRoleOptions} videoSenderOptions={videoSenderOptions} videoRoleOptions={videoRoleOptions} onChange={setMessengerDraft} onUploadAsset={handleUploadAsset} chats={chats} mode="messenger" onAddOption={() => addOption(setMessengerDraft)} onTogglePreviewAudio={togglePreviewAudio} activePreviewKey={activePreviewKey} />}
                  </div>
                  <ChannelInfluencePanel entity={messengerDraft} mode="messenger" data={channelDraftBarData} />
                </div>
              </div>
            )}
            {channelTab === "video" && (
              <div className="grid gap-5 xl:grid-cols-[300px,minmax(680px,1fr)] 2xl:grid-cols-[320px,minmax(760px,1fr),380px] 2xl:gap-6">
                <div className="min-w-0 rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4 2xl:p-5 h-full">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-white">Видео</div>
                    <Button size="sm" onClick={() => openSignalWizard("video")}>Новое</Button>
                  </div>
                  <div className="dns-admin-side-list space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {contentQuery.data.videoCases.map((item: VideoCase) => (
                      <button key={item.id} onClick={() => setSelectedVideoId(item.id)} className={`w-full rounded-lg border px-3 py-2 text-left ${selectedVideoId === item.id ? "border-[#a78bfa] bg-[#a78bfa]/10" : "border-[#2a3a4e]"}`}>
                        <div className="text-sm text-white">{item.title || item.id}</div>
                        <div className="text-xs text-[#8890a8]">{item.id}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-w-0 rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4 2xl:p-5 h-full">
                  {videoDraft && <EntityEditor title="Редактор видео-кейса" entity={videoDraft} assets={assets} competencies={competencies} caseSourceOptions={caseSourceOptions} emailSenderOptions={emailSenderOptions} emailDepartmentOptions={emailDepartmentOptions} messengerSenderOptions={messengerSenderOptions} messengerRoleOptions={messengerRoleOptions} videoSenderOptions={videoSenderOptions} videoRoleOptions={videoRoleOptions} onChange={setVideoDraft} onUploadAsset={handleUploadAsset} chats={[]} mode="video" onAddOption={() => addOption(setVideoDraft)} onTogglePreviewAudio={togglePreviewAudio} activePreviewKey={activePreviewKey} />}
                </div>
                <ChannelInfluencePanel entity={videoDraft} mode="video" data={channelDraftBarData} />
              </div>
            )}
          </div>
        )}

        {tab === "schedule" && (
          <div className="rounded-2xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4 shadow-2xl">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb27a]">Единый сценарный таймлайн</div>
                <h2 className="mt-1 text-xl font-bold text-white">Порядок поступления кейсов и каналов</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#aebbd2]">
                  Перемещайте события вверх/вниз. При ручном изменении порядка система автоматически пересчитает минуты прихода,
                  но каждую минуту, срок решения и повтор можно скорректировать вручную.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#2a3a4e] bg-transparent text-[#c7d3e7]"
                  onClick={() => setScheduleDraft(autoAssignScheduleTimes(scheduleDraft))}
                >
                  Автораспределить время
                </Button>
                <Button
                  type="button"
                  className="bg-[#FF6B00] hover:bg-[#e06000]"
                  onClick={saveSchedule}
                  disabled={saving}
                >
                  {saving ? "Сохраняем..." : "Сохранить расписание"}
                </Button>
              </div>
            </div>

            <div className="custom-scroll max-h-[72vh] space-y-3 overflow-y-auto pr-1">
              {scheduleDraft.map((row, index) => (
                <div key={row.rowId} className="rounded-2xl border border-[#30445f] bg-[#101826]/78 p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#FF6B00]/35 bg-[#FF6B00]/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb27a]">
                          {index + 1}
                        </span>
                        <span className="rounded-full border border-[#4a9eff]/35 bg-[#4a9eff]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8ec5ff]">
                          {getScheduleSourceLabel(row.sourceType)}
                        </span>
                        <span className="text-xs text-[#7f90ad]">{row.id}</span>
                      </div>
                      <div className="mt-2 text-base font-bold text-white">{row.title}</div>
                      <div className="mt-1 text-xs text-[#9fb0ca]">{row.subtitle}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-[#2a3a4e] bg-transparent text-[#9fb0ca]"
                        onClick={() => moveScheduleRow(row.rowId, -1)}
                        disabled={index === 0}
                      >
                        Выше
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-[#2a3a4e] bg-transparent text-[#9fb0ca]"
                        onClick={() => moveScheduleRow(row.rowId, 1)}
                        disabled={index === scheduleDraft.length - 1}
                      >
                        Ниже
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <Field
                      label="Минута поступления"
                      value={row.arrivalMinute ?? ""}
                      onChange={(value) => updateScheduleRow(row.rowId, { arrivalMinute: value ? Number(value) : null })}
                    />
                    {row.sourceType === "main_case" && (
                      <>
                        <Field
                          label="Мин. интервал, сек"
                          value={row.minIntervalSeconds ?? ""}
                          onChange={(value) => updateScheduleRow(row.rowId, { minIntervalSeconds: value ? Number(value) : null })}
                        />
                        <Field
                          label="Макс. интервал, сек"
                          value={row.maxIntervalSeconds ?? ""}
                          onChange={(value) => updateScheduleRow(row.rowId, { maxIntervalSeconds: value ? Number(value) : null })}
                        />
                      </>
                    )}
                    <Field
                      label="Срок решения, сек"
                      value={row.decisionDeadlineSeconds ?? ""}
                      onChange={(value) => updateScheduleRow(row.rowId, { decisionDeadlineSeconds: value ? Number(value) : null })}
                    />
                    <Field
                      label="Повтор напоминания, сек"
                      value={row.reminderIntervalSeconds ?? ""}
                      onChange={(value) => updateScheduleRow(row.rowId, { reminderIntervalSeconds: value ? Number(value) : null })}
                    />
                  </div>
                </div>
              ))}
            </div>
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
              <div className="dns-admin-side-list space-y-2 max-h-[65vh] overflow-y-auto">
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
                        <div className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] ${item.technicalStatus === "completed" ? "border-[#00d4aa66] text-[#7fffd4]" : "border-[#ff6b6b66] text-[#ffb3b3]"}`}>
                          {item.technicalStatus === "completed" ? "Прошел" : "Не прошел"}
                        </div>
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
                  <div className="dns-admin-result-detail-head">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-white">{resultDetailQuery.data.session.participantName}</div>
                      <div className="mt-1 text-sm text-[#d3deee]">
                        Оценщик: {resultDetailQuery.data.session.evaluatorName || "—"} • {formatTechnicalStatus(resultDetailQuery.data.session.technicalStatus)}
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
                        Итоговая карточка прохождения. Здесь можно скачать отчёт или удалить ошибочный/тестовый результат.
                      </div>
                    </div>
                    <div className="dns-admin-action-block">
                      <Button size="sm" variant="outline" className="border-[#2a3a4e] bg-transparent text-[#8890a8]" onClick={exportSelectedResultPdf} disabled={pdfLoading || !selectedResultReport}>
                        {pdfLoading ? "PDF..." : "Скачать PDF"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#ff4444]/35 bg-[#ff4444]/8 text-[#ff9999] hover:bg-[#ff4444]/12"
                        onClick={deleteSelectedResult}
                        disabled={deleteResultLoading}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deleteResultLoading ? "Удаляем..." : "Удалить"}
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

        {tab === "comparison" && (
          <div className="dns-comparison-view space-y-4">
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Сотрудники для сравнения</div>
                  <div className="mt-1 text-xs text-[#8aa2c4]">Выбрано: {comparisonSelection.length}/{MAX_COMPARISON_ITEMS}</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[#2a3a4e] bg-transparent text-[#8890a8]"
                  onClick={() => setComparisonSelection([])}
                  disabled={comparisonSelection.length === 0}
                >
                  <X className="mr-2 h-4 w-4" />
                  Очистить
                </Button>
              </div>

              <div className="mt-3 grid max-h-[22rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {completedResults.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[#2a3a4e] bg-[#101826]/65 px-3 py-4 text-xs text-[#8aa2c4] sm:col-span-2 lg:col-span-3 2xl:col-span-5">
                    Нет завершенных симуляций для сравнения.
                  </div>
                )}
                {completedResults.map((item) => {
                  const resultId = Number(item.id);
                  const checked = comparisonSelection.includes(resultId);
                  const atLimit = !checked && comparisonSelection.length >= MAX_COMPARISON_ITEMS;

                  return (
                    <label
                      key={resultId}
                      className={`flex min-h-[5.75rem] cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                        checked
                          ? "border-[#00d4aa] bg-[#00d4aa]/10"
                          : atLimit
                            ? "border-[#2a3a4e] bg-[#101826]/45 opacity-60"
                            : "border-[#2a3a4e] bg-[#101826]/65 hover:border-[#3f5876]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={atLimit}
                        onChange={(event) => {
                          const nextChecked = event.target.checked;
                          setComparisonSelection((current) => {
                            if (nextChecked) {
                              if (current.length >= MAX_COMPARISON_ITEMS || current.includes(resultId)) {
                                return current;
                              }
                              return [...current, resultId];
                            }

                            return current.filter((id) => id !== resultId);
                          });
                        }}
                        className="mt-1 h-4 w-4 rounded border-[#3b4b61] bg-[#141c2b]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">{item.participantName}</span>
                        <span className="mt-1 block text-[11px] text-[#8aa2c4]">{formatDateTimeLabel(item.startedAt)}</span>
                        <span className="mt-1 block text-[11px] text-[#cbd8ef]">
                          {formatTechnicalStatus(item.technicalStatus)} · {formatScoreValue(item.averageScore)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {completedResults.length > 0 && comparisonRows.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#2a3a4e] bg-[#101826]/70 px-4 py-8 text-center text-sm text-[#8aa2c4]">
                Отметьте сотрудников выше, чтобы собрать сравнительную таблицу.
              </div>
            )}

            {comparisonRows.length > 0 && (
              <>
                <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white">Карточки прохождений</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[#6f829e]">Шкала 0-5</div>
                  </div>
                  <div
                    className="dns-comparison-product-row"
                    style={{ gridTemplateColumns: `repeat(${comparisonRows.length}, minmax(14rem, 1fr))` }}
                  >
                    {comparisonRows.map((row, index) => {
                      const overallScore = Number(row.report?.overallAvg || row.averageScore || 0);
                      const accentColor = ["#00d4aa", "#4a9eff", "#ff9f43", "#ff5e7a", "#a78bfa"][index % 5];

                      return (
                        <div key={row.id} className="dns-comparison-person-card" style={{ borderTopColor: accentColor }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="dns-comparison-avatar" style={{ backgroundColor: `${accentColor}24`, color: accentColor }}>
                                {getParticipantInitials(row.participantName)}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">{row.participantName}</div>
                                <div className="mt-1 text-[11px] text-[#8aa2c4]">#{row.id} · {formatDifficultyLabel(row.difficulty)}</div>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 shrink-0 border-[#2a3a4e] bg-transparent p-0 text-[#8890a8]"
                              onClick={() => setComparisonSelection((current) => current.filter((id) => id !== row.id))}
                              aria-label="Убрать из сравнения"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-4 flex items-end justify-between gap-3">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.14em] text-[#6f829e]">Общая оценка</div>
                              <div className="mt-1 text-3xl font-bold tabular-nums text-white">
                                {row.isLoading ? "..." : formatScoreValue(overallScore)}
                              </div>
                            </div>
                            <div className="rounded-full border border-[#2a3a4e] bg-[#101826]/75 px-2 py-1 text-[10px] text-[#cbd8ef]">
                              {row.isLoading ? "Загрузка" : formatTechnicalStatus(row.technicalStatus)}
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#121b2a]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(0, Math.min(overallScore, 5)) * 20}%`,
                                backgroundColor: getScoreColor(overallScore),
                              }}
                            />
                          </div>
                          {row.isError && (
                            <div className="mt-3 rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/10 px-3 py-2 text-[11px] text-[#ff9999]">
                              Детали результата не загрузились.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                  <div className="mb-3 text-sm font-semibold text-white">Оценка компетенций</div>
                  <div className="dns-comparison-table-wrap">
                    <table className="dns-comparison-table">
                      <thead>
                        <tr>
                          <th>Показатель</th>
                          {comparisonRows.map((row) => (
                            <th key={row.id}>{row.participantName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonMetricRows.map((metric) => (
                          <tr key={metric.label}>
                            <td>{metric.label}</td>
                            {comparisonRows.map((row) => (
                              <td key={row.id}>{metric.render(row)}</td>
                            ))}
                          </tr>
                        ))}
                        {competencies.map((competency: CompetencyDefinition) => {
                          const values = comparisonRows.map((row) => Number(row.competencyAverages[competency.id] || 0));
                          const bestValue = Math.max(...values);

                          return (
                            <tr key={competency.id}>
                              <td>{competency.name}</td>
                              {comparisonRows.map((row) => {
                                const value = Number(row.competencyAverages[competency.id] || 0);
                                const isBest = value > 0 && value === bestValue;

                                return (
                                  <td key={row.id}>
                                    {row.isLoading && value === 0 ? (
                                      "..."
                                    ) : (
                                      <div className="dns-comparison-score-cell">
                                        <span className={`tabular-nums ${isBest ? "text-[#7fffd4]" : "text-white"}`}>{formatScoreValue(value)}</span>
                                        <span className="dns-comparison-score-track">
                                          <span
                                            className="dns-comparison-score-fill"
                                            style={{
                                              width: `${Math.max(0, Math.min(value, 5)) * 20}%`,
                                              backgroundColor: getScoreColor(value),
                                            }}
                                          />
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                  <div className="mb-3 text-sm font-semibold text-white">Характеристики прохождения</div>
                  <div className="dns-comparison-table-wrap">
                    <table className="dns-comparison-table dns-comparison-table--characteristics">
                      <thead>
                        <tr>
                          <th>Параметр</th>
                          {comparisonRows.map((row) => (
                            <th key={row.id}>{row.participantName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonCharacteristicRows.map((metric) => (
                          <tr key={metric.label}>
                            <td>{metric.label}</td>
                            {comparisonRows.map((row) => (
                              <td key={row.id}>{metric.render(row)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="dns-comparison-insights rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-4">
                  <div className="dns-comparison-insights-head">
                    <div>
                      <div className="text-sm font-semibold text-white">Выводы по сравнению</div>
                      <p>
                        Сводка переводит баллы компетенций в управленческие выводы: сильные стороны, слабые зоны, риски и вопросы для руководителя.
                      </p>
                    </div>
                    <span>{comparisonRows.length} профиля</span>
                  </div>
                  {comparisonGroupConclusion && (
                    <div className="dns-comparison-group-conclusion">
                      {comparisonGroupConclusion}
                    </div>
                  )}
                  <div className="dns-comparison-insight-grid">
                    {comparisonInsights.map((insight) => (
                      <article key={insight.rowId} className="dns-comparison-insight-card">
                        <div className="dns-comparison-insight-card-head">
                          <div>
                            <span>Сотрудник</span>
                            <h3>{insight.participantName}</h3>
                          </div>
                          <strong>{formatScoreValue(insight.overallScore)}</strong>
                        </div>
                        <p className="dns-comparison-insight-summary">{insight.summary}</p>

                        <div className="dns-comparison-insight-columns">
                          <div>
                            <span>Сильные стороны</span>
                            <ul>
                              {insight.strongCompetencies.length > 0 ? insight.strongCompetencies.map((item) => (
                                <li key={item.id}>{formatComparisonInsightItem(item)}</li>
                              )) : <li>Недостаточно данных по компетенциям.</li>}
                            </ul>
                          </div>
                          <div>
                            <span>Слабые зоны</span>
                            <ul>
                              {insight.weakCompetencies.length > 0 ? insight.weakCompetencies.map((item) => (
                                <li key={item.id}>{formatComparisonInsightItem(item)}</li>
                              )) : <li>Недостаточно данных по компетенциям.</li>}
                            </ul>
                          </div>
                        </div>

                        {insight.leaderNotes.length > 0 && (
                          <div className="dns-comparison-leader-notes">
                            {insight.leaderNotes.map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                        )}

                        <div className="dns-comparison-risk-block">
                          <span>Риски</span>
                          <ul>
                            {insight.risks.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="dns-comparison-question-block">
                          <span>Вопросы руководителю</span>
                          <ol>
                            {insight.questions.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ol>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            )}
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

            <div className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:overflow-x-hidden xl:pr-2 custom-scroll">
              <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Влияние выбранного кейса</div>
                    <div className="mt-1 text-xs leading-relaxed text-[#8aa2c4]">
                      График показывает статичный профиль симуляции по контенту и регулируемый вклад кейса, который вы сейчас настраиваете.
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
                      { key: "aggregate", label: "Статичный профиль", color: "#4a9eff" },
                      { key: "selected", label: "Регулируемый вклад", color: "#00d4aa" },
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

              <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4">
                <div className="text-sm font-semibold text-white mb-3">WIKI: составление кейсов</div>
                <div className="space-y-3">
                  {CASE_AUTHORING_WIKI.map((section) => (
                    <div key={section.title} className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#6fa0ff]">{section.title}</div>
                      <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#b8c5db]">
                        {section.items.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6B00]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="rounded-xl border border-[#FF6B00]/30 bg-[#FF6B00]/10 p-3 text-xs leading-relaxed text-[#ffd9bf]">
                    Пример: вариант “провести планёрку и перераспределить людей” может дать Команда / мораль +5,
                    Выдача / скорость +3 и Финансы / выручка +3. Если решение грубое и без контроля, ставьте отрицательные
                    значения там, где магазин реально проседает.
                  </div>
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

        {tab !== "dashboard" && tab !== "results" && tab !== "schedule" && tab !== "comparison" && (
          <div className="dns-admin-action-block mt-6 justify-start">
            <Button className="bg-[#FF6B00] hover:bg-[#e06000]" onClick={saveCurrent} disabled={saving || uploading}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
            {(tab === "cases" || tab === "channels") && (
              <Button variant="outline" className="border-[#ff4444]/30 text-[#ff9999] bg-transparent" onClick={handleDeleteCurrent}>
                Удалить
              </Button>
            )}
          </div>
        )}
          </main>
        </div>
      </div>
    </div>
  );
}
