import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { RealisticMetrics } from "../context/SimulationContext";
import { CASES_DATA } from "../data/cases";
import { EMAIL_CASES } from "../data/email-cases";
import { MESSENGER_CASES } from "../data/messenger-cases";
import { VIDEO_CASES } from "../data/video-cases";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ThemeToggle, useDnsTheme } from "@/components/theme-toggle";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { getSimulationSettingsSnapshot } from "@/lib/runtime-content";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";
import {
  ArrowLeft, Play, Shield, Zap, Flame,
  GraduationCap, Award, Mail, MessageSquare, Video, Phone, BarChart3, Eye, Users,
  ArrowRight, Trash2, FileText, ChevronDown, ChevronUp, HelpCircle,
  UserCheck, Timer, CheckCircle2, Rocket, Info, BookOpen, Workflow,
  MousePointerClick, ListChecks, Settings2, Target, GitBranch,
  ArrowUpRight, ArrowDownRight, SlidersHorizontal, ClipboardCheck, Map,
  Activity, Gauge, Copy,
} from "lucide-react";
import { primeAudioPlayback } from "@/data/audio-map";
import {
  createRemoteLiveSimulation,
  fetchRemoteLiveSimulation,
  resetLiveSimulation,
  setLiveSimulationConfig,
  setLiveSimulationRole,
} from "@/lib/live-session";
import type { LiveSimulationMonitorSummary } from "@shared/live-session";
import { STORE_METRIC_LABELS, STORE_STATE_PRESETS } from "@/lib/store-metrics";
import storeBg from "@assets/store_bg.png";

// ═══════════════════════════════════════════════════════════
// HR-подсказки для уровней сложности
// ═══════════════════════════════════════════════════════════
const HR_TOOLTIPS: Record<string, string> = {
  easy: "Для первого прохождения. Очевидные ситуации с понятными решениями. Только звонки.",
  medium: "Стандартная оценка. Баланс сложности для типового кандидата. Звонки, почта, чат.",
  hard: "Для опытных кандидатов. Сложные ситуации с неочевидными решениями. Все каналы.",
};

// ═══════════════════════════════════════════════════════════
// Упрощённые описания уровней сложности для HR
// ═══════════════════════════════════════════════════════════
const DIFFICULTY_INFO = {
  easy: {
    icon: Shield,
    label: "Лёгкий",
    color: "#00C853",
    description: "Простые ситуации. Подходит для первого раза.",
    duration: "~20 минут",
    channels: { audio: true, email: false, messenger: false, video: false },
  },
  medium: {
    icon: Zap,
    label: "Средний",
    color: "#FFB300",
    description: "Стандартная оценка. Баланс сложности.",
    duration: "~40 минут",
    channels: { audio: true, email: true, messenger: true, video: false },
  },
  hard: {
    icon: Flame,
    label: "Сложный",
    color: "#FF1744",
    description: "Для опытных. Неочевидные решения.",
    duration: "~60 минут",
    channels: { audio: true, email: true, messenger: true, video: true },
  },
};

// ═══════════════════════════════════════════════════════════
// Стартовые метрики по умолчанию (спокойная смена)
// ═══════════════════════════════════════════════════════════
const DEFAULT_METRICS: RealisticMetrics = {
  customersInStore: 8,
  avgCheck: 3200,
  conversion: 22,
  nps: 3.25,
  pickupSpeed: 12,
  warehouseLoad: 35,
  teamMorale: 7,
  dailyRevenue: 125000,
};

// ═══════════════════════════════════════════════════════════
// Роли симуляции — упрощённые для HR
// ═══════════════════════════════════════════════════════════
const SIMULATION_ROLE_CARDS = [
  {
    id: "participant",
    title: "Космонавт",
    description: "Стандартный режим для оценки компетенций",
    participantRole: "Участник",
    available: true,
  },
  {
    id: "deputy-manager",
    title: "Заместитель управляющего",
    description: "Отдельный набор сценариев — в разработке",
    participantRole: "Заместитель управляющего",
    available: false,
  },
  {
    id: "manager",
    title: "Управляющий",
    description: "Отдельный набор сценариев — в разработке",
    participantRole: "Управляющий",
    available: false,
  },
] as const;

type AssessorSimulationRoleId = (typeof SIMULATION_ROLE_CARDS)[number]["id"];

interface AssessorParticipantConfig {
  id: string;
  name: string;
  simulationRole: AssessorSimulationRoleId;
  difficulty: AssessorDifficulty;
  setupMode: AssessorSetupMode;
  scenarioConfirmed: boolean;
  compositionConfirmed: boolean;
  channelReviewDone: boolean;
  showAdvanced: boolean;
  manualSelection: boolean;
  repeatCases: boolean;
  selectedCases: string[];
  channels: AssessorChannels;
  selectedChannelItemIds: AssessorChannelItemIds;
  initialMetrics: RealisticMetrics;
  isTestMode: boolean;
  speedMultiplier: number;
}

interface AssessorLaunchResult {
  participantName: string;
  liveSessionId: string;
  accessCode: string;
}

function createAssessorParticipantId() {
  return `participant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneMetrics(metrics: RealisticMetrics): RealisticMetrics {
  return { ...metrics };
}

function cloneChannelItemIds(ids: AssessorChannelItemIds): AssessorChannelItemIds {
  return {
    email: [...ids.email],
    messenger: [...ids.messenger],
    video: [...ids.video],
  };
}

function createDefaultParticipantSetup(id = createAssessorParticipantId(), name = ""): AssessorParticipantConfig {
  return {
    id,
    name,
    simulationRole: "participant",
    difficulty: "medium",
    setupMode: "recommended",
    scenarioConfirmed: false,
    compositionConfirmed: false,
    channelReviewDone: false,
    showAdvanced: false,
    manualSelection: false,
    repeatCases: false,
    selectedCases: CASES_DATA.map((item) => item.id),
    channels: { ...DIFFICULTY_INFO.medium.channels },
    selectedChannelItemIds: {
      email: EMAIL_CASES.map((item) => item.id),
      messenger: MESSENGER_CASES.map((item) => item.id),
      video: VIDEO_CASES.map((item) => item.id),
    },
    initialMetrics: cloneMetrics(DEFAULT_METRICS),
    isTestMode: false,
    speedMultiplier: 1,
  };
}

const TIME_PROFILE_RATIO = {
  easy: 1.1,
  medium: 1,
  hard: 0.8,
} as const;

// ═══════════════════════════════════════════════════════════
// Tooltip component
// ═══════════════════════════════════════════════════════════
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#0f1923] border border-[#2a3a4e] rounded-lg text-xs text-[#a5b2c8] whitespace-normal max-w-[280px] shadow-xl z-50">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2a3a4e]" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Wizard step indicator
// ═══════════════════════════════════════════════════════════
function WizardSteps({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Кто участник?", icon: UserCheck },
    { num: 2, label: "Уровень сложности", icon: Shield },
    { num: 3, label: "Запуск", icon: Rocket },
  ];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isActive = step.num === currentStep;
        const isDone = step.num < currentStep;
        return (
          <div key={step.num} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all ${
                isActive
                  ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]"
                  : isDone
                  ? "border-[#00C853] bg-[#00C853]/10 text-[#00C853]"
                  : "border-[#2a3a4e] bg-[#141c2b]/50 text-[#6f7990]"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span className="text-xs font-medium whitespace-nowrap">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight className="w-4 h-4 text-[#3a4a5e] flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════
type AssessorWikiFocus =
  | "entry"
  | "wizard"
  | "participant"
  | "difficulty"
  | "mode"
  | "advanced"
  | "cases"
  | "channels"
  | "metrics"
  | "sessions";

type AssessorPanel = "participant" | "scenario" | "composition" | "review" | "sessions";
type AssessorSetupMode = "recommended" | "expert";
type AssessorDifficulty = "easy" | "medium" | "hard";
type AssessorChannels = { audio: boolean; email: boolean; messenger: boolean; video: boolean };
type AssessorChannelItemIds = { email: string[]; messenger: string[]; video: string[] };

const ASSESSOR_WIKI_BLOCKS: Array<{
  id: string;
  focus: AssessorWikiFocus;
  title: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  controls: string[];
  dynamics: Array<{ type: "up" | "down" | "neutral"; text: string }>;
}> = [
  {
    id: "entry",
    focus: "entry",
    title: "Вход в WIKI оценщика",
    label: "Большая кнопка вверху кабинета",
    icon: BookOpen,
    summary: "Отдельная точка входа в инструкцию. Оценщик может открыть методику до запуска, не ломая текущий мастер настройки.",
    controls: [
      "Открыть WIKI - перейти к подробной карте настройки.",
      "Вернуться к настройке - снова показать обычный мастер оценщика.",
    ],
    dynamics: [
      { type: "neutral", text: "На оценку не влияет. Это навигационный и обучающий элемент." },
      { type: "up", text: "Снижает риск неверной настройки, потому что объясняет зависимость до запуска." },
    ],
  },
  {
    id: "wizard",
    focus: "wizard",
    title: "Мастер настройки",
    label: "3 шага: участник, сложность, запуск",
    icon: ListChecks,
    summary: "Главный сценарий оценщика. Он ведет от ввода людей к выбору нагрузки и финальному запуску live-сессии.",
    controls: [
      "Шаг 1 фиксирует, кого оцениваем и кто проводит оценку.",
      "Шаг 2 задает базовую сложность, режим и стартовый контекст магазина.",
      "Шаг 3 проверяет итоговую конфигурацию и открывает расширенные настройки.",
    ],
    dynamics: [
      { type: "up", text: "Последовательное прохождение снижает шанс забыть обязательные поля и получить неполный отчет." },
      { type: "down", text: "Если менять только расширенные параметры, можно сузить доказательную базу по компетенциям." },
    ],
  },
  {
    id: "participant",
    focus: "participant",
    title: "Участник и тип симуляции",
    label: "ФИО, роль и сценарная роль",
    icon: UserCheck,
    summary: "Блок отвечает за идентификацию оценки и будущий профиль прохождения. Сейчас активна базовая симуляция участника.",
    controls: [
      "ФИО оценщика попадает в сессию и итоговый отчет.",
      "ФИО участника связывает live-сессию, результат и PDF/экспорт.",
      "Тип симуляции определяет сценарную роль. Недоступные роли показаны как будущие режимы.",
    ],
    dynamics: [
      { type: "neutral", text: "ФИО не меняют баллы компетенций, но влияют на корректность отчета и поиск результата." },
      { type: "up", text: "Когда будут активны новые роли, выбор роли изменит набор ситуаций и проверяемые управленческие контексты." },
    ],
  },
  {
    id: "difficulty",
    focus: "difficulty",
    title: "Сложность",
    label: "Количество ситуаций, каналы и время",
    icon: Shield,
    summary: "Сложность задает стартовый профиль испытания: сколько кейсов будет, какие каналы включены и сколько времени заложено.",
    controls: [
      "Легкий уровень - меньше ситуаций и только базовые сигналы.",
      "Средний уровень - рабочая нагрузка с несколькими каналами.",
      "Сложный уровень - максимум ситуаций, каналов и управленческого давления.",
    ],
    dynamics: [
      { type: "up", text: "Повышение сложности увеличивает число решений и ширину проверки компетенций." },
      { type: "down", text: "Понижение сложности уменьшает нагрузку, но может снизить видимость компетенций, которые проявляются только в сложных кейсах." },
    ],
  },
  {
    id: "mode",
    focus: "mode",
    title: "Рекомендованный и экспертный режим",
    label: "Автосборка или ручная настройка",
    icon: Gauge,
    summary: "Рекомендованный режим собирает сценарий автоматически. Экспертный режим открывает ручные уровни влияния: кейсы, каналы, стартовые метрики и скорость тренировки.",
    controls: [
      "Рекомендованный - оценщик выбирает смысл оценки, система подбирает состав.",
      "Экспертный - методист вручную меняет доказательную базу и нагрузку.",
      "Тренировочная скорость доступна только внутри экспертных настроек.",
    ],
    dynamics: [
      { type: "up", text: "Рекомендованный режим снижает риск случайной ошибки: параметры связаны с выбранной сложностью." },
      { type: "down", text: "Экспертный режим дает полный контроль, но требует проверить все поля: пустые кейсы, каналы или метрики блокируют запуск." },
    ],
  },
  {
    id: "advanced",
    focus: "advanced",
    title: "Расширенные настройки",
    label: "Ручной контроль сценария",
    icon: Settings2,
    summary: "Свернутый блок для опытного оценщика. Он меняет доказательную базу оценки: кейсы, каналы, события и стартовые метрики.",
    controls: [
      "Открыть блок - показать ручной выбор ситуаций, каналов и метрик.",
      "Закрыть блок - оставить автоматический профиль по выбранной сложности.",
    ],
    dynamics: [
      { type: "up", text: "Расширенные настройки полезны для целевой проверки конкретной зоны компетенций." },
      { type: "down", text: "Чрезмерное сужение сценария может сделать итоговый профиль менее репрезентативным." },
    ],
  },
  {
    id: "cases",
    focus: "cases",
    title: "Выбор ситуаций",
    label: "Автоподбор, ручной выбор, повтор кейсов",
    icon: Target,
    summary: "Ситуации являются основной доказательной базой. В каждом кейсе есть варианты решений, метрики и оценки компетенций.",
    controls: [
      "Автоподбор выбирает число ситуаций по сложности.",
      "Ручной выбор оставляет только отмеченные кейсы.",
      "Повтор по циклу разрешает повторять ситуации, если сценарий идет дольше набора кейсов.",
    ],
    dynamics: [
      { type: "up", text: "Добавление кейсов увеличивает количество наблюдений и устойчивость оценки." },
      { type: "down", text: "Исключение кейса убирает его вклад. Например, если убрать кейсы на делегирование, влияние на компетенцию делегирования снизится или исчезнет." },
    ],
  },
  {
    id: "channels",
    focus: "channels",
    title: "Каналы и события",
    label: "Звонки, почта, мессенджер, видео",
    icon: SlidersHorizontal,
    summary: "Каналы управляют тем, откуда приходят сигналы. События внутри каналов добавляют отдельные управленческие развилки.",
    controls: [
      "Включить канал - добавить тип сигналов в симуляцию.",
      "Отключить канал - убрать этот поток сигналов.",
      "Выбор событий - оставить конкретные письма, сообщения или видеообращения.",
    ],
    dynamics: [
      { type: "up", text: "Больше каналов повышают многозадачность и проверяют переключение внимания." },
      { type: "down", text: "Отключение почты или мессенджера снижает число письменных управленческих развилок и их вклад в компетенции." },
    ],
  },
  {
    id: "metrics",
    focus: "metrics",
    title: "Стартовые метрики магазина",
    label: "Начальное состояние подразделения",
    icon: Activity,
    summary: "Метрики задают фон смены: нагрузку, настроение команды, клиентскую оценку, склад, скорость выдачи и выручку.",
    controls: [
      "Готовые состояния задают быстрый профиль нагрузки от спокойного до критического.",
      "Ручные поля позволяют тонко настроить начальные значения.",
      "Эти показатели затем меняются решениями участника.",
    ],
    dynamics: [
      { type: "up", text: "Более высокий стартовый стресс делает последствия решений заметнее в динамике магазина." },
      { type: "down", text: "Если задать слишком спокойный старт, часть управленческих ошибок будет визуально менее заметна по метрикам." },
    ],
  },
  {
    id: "sessions",
    focus: "sessions",
    title: "Текущие симуляции",
    label: "Наблюдение, прогресс, результаты",
    icon: ClipboardCheck,
    summary: "Оценщик видит активные и завершенные live-сессии, может открыть наблюдение или перейти к результатам.",
    controls: [
      "Наблюдать - открыть текущую симуляцию без вмешательства в решения участника.",
      "Результаты - перейти к отчету завершенной сессии.",
      "Следующий с копией - подготовить нового испытуемого с теми же настройками.",
      "Пустая настройка - начать новую карточку без переноса параметров.",
      "Удалить - убрать live-сессию из текущего списка.",
    ],
    dynamics: [
      { type: "neutral", text: "Наблюдение не меняет баллы: оно только показывает ход прохождения." },
      { type: "down", text: "Удаление незавершенной live-сессии может прервать доступ к ее текущему состоянию." },
    ],
  },
];

const WIKI_PROCESS_STEPS = [
  { lane: "Оценщик", title: "Вводит участников", note: "ФИО связывают сессию и отчет." },
  { lane: "Оценщик", title: "Выбирает сложность", note: "Зависимость: кейсы, каналы, время." },
  { lane: "Оценщик", title: "Настраивает сценарий", note: "Зависимость: покрытие компетенций." },
  { lane: "Система", title: "Создает live-сессию", note: "Код получает участник." },
  { lane: "Участник", title: "Проходит симуляцию", note: "Решения меняют метрики и оценки." },
  { lane: "Система", title: "Считает результат", note: "Компетенции, средний балл, динамика." },
  { lane: "Оценщик", title: "Разбирает отчет", note: "Решения, сильные зоны, ИПР." },
] as const;

function WikiScreenshot({ focus, label }: { focus: AssessorWikiFocus; label: string }) {
  const cards: Array<{ focus: AssessorWikiFocus; title: string; note: string }> = [
    { focus: "participant", title: "Участник", note: "ФИО и роль" },
    { focus: "difficulty", title: "Сценарий", note: "уровень нагрузки" },
    { focus: "mode", title: "Режим", note: "авто / эксперт" },
    { focus: "advanced", title: "Расширенно", note: "ручные параметры" },
    { focus: "cases", title: "Кейсы", note: "состав оценки" },
    { focus: "channels", title: "Каналы", note: "почта, чат, видео" },
    { focus: "metrics", title: "Метрики", note: "старт магазина" },
    { focus: "sessions", title: "Результаты", note: "сессии и отчеты" },
  ];

  return (
    <div className={`dns-assessor-wiki-shot dns-assessor-wiki-shot--${focus}`} aria-label={`Скриншот: ${label}`}>
      <div className="dns-assessor-wiki-shot-top">
        <span>Панель оценщика</span>
        <span>live-сессия</span>
      </div>
      <div className="dns-assessor-wiki-shot-entry">WIKI оценщика</div>
      <div className="dns-assessor-wiki-shot-steps">
        <span>1. Люди</span>
        <span>2. Сценарий</span>
        <span>3. Запуск</span>
      </div>
      <div className="dns-assessor-wiki-shot-grid">
        {cards.map((card) => {
          const active = focus === card.focus;
          const overview = focus === "entry" || focus === "wizard";
          return (
            <div
              key={card.focus}
              className={`dns-assessor-wiki-shot-card dns-assessor-wiki-shot-card--${card.focus} ${
                active ? "dns-assessor-wiki-shot-card--focus" : overview ? "dns-assessor-wiki-shot-card--overview" : "dns-assessor-wiki-shot-card--dim"
              }`}
            >
              <strong>{card.title}</strong>
              <span>{card.note}</span>
            </div>
          );
        })}
      </div>
      <div className="dns-assessor-wiki-shot-highlight" aria-hidden="true" />
      <div className="dns-assessor-wiki-shot-callout">{label}</div>
    </div>
  );
}

function AssessorWiki({
  onBack,
  processOpen,
  onToggleProcess,
}: {
  onBack: () => void;
  processOpen: boolean;
  onToggleProcess: () => void;
}) {
  return (
    <div className="dns-assessor-wiki space-y-5">
      <section className="dns-assessor-wiki-hero">
        <div>
          <div className="dns-assessor-wiki-kicker">WIKI оценщика</div>
          <h2>Как настроить и провести симуляцию</h2>
          <p>
            Эта страница объясняет каждый блок меню оценщика: что он меняет, как влияет на сценарий,
            где возникает зависимость и какой результат увидит заказчик в отчете.
          </p>
        </div>
        <button type="button" onClick={onBack} className="dns-assessor-wiki-back">
          <ArrowLeft className="h-4 w-4" />
          Вернуться к настройке
        </button>
      </section>

      <section className="dns-assessor-wiki-summary">
        <div>
          <MousePointerClick className="h-5 w-5" />
          <span>1. Оценщик задает рамки</span>
        </div>
        <div>
          <GitBranch className="h-5 w-5" />
          <span>2. Система строит сценарий</span>
        </div>
        <div>
          <Activity className="h-5 w-5" />
          <span>3. Участник принимает решения</span>
        </div>
        <div>
          <ClipboardCheck className="h-5 w-5" />
          <span>4. Отчет показывает доказательства</span>
        </div>
      </section>

      <section className="dns-assessor-wiki-note">
        <Info className="h-5 w-5" />
        <div>
          <h3>Главный принцип оценки</h3>
          <p>
            Итог не должен быть "ощущением оценщика". Он строится из решений участника:
            выбранные кейсы и каналы дают ситуации, решения меняют метрики магазина и формируют
            вклад в компетенции, а отчет собирает это в понятную картину.
          </p>
        </div>
      </section>

      <section className="dns-assessor-wiki-grid">
        {ASSESSOR_WIKI_BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <article key={block.id} className="dns-assessor-wiki-card">
              <div className="dns-assessor-wiki-card-head">
                <div className="dns-assessor-wiki-icon">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3>{block.title}</h3>
                  <p>{block.label}</p>
                </div>
              </div>
              <WikiScreenshot focus={block.focus} label={block.label} />
              <p className="dns-assessor-wiki-card-summary">{block.summary}</p>
              <div className="dns-assessor-wiki-columns">
                <div>
                  <h4>Как менять</h4>
                  <ul>
                    {block.controls.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Динамика</h4>
                  <ul>
                    {block.dynamics.map((item) => (
                      <li key={item.text} className={`dns-assessor-wiki-dynamic dns-assessor-wiki-dynamic--${item.type}`}>
                        {item.type === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
                        {item.type === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
                        {item.type === "neutral" && <Info className="h-3.5 w-3.5" />}
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="dns-assessor-wiki-process">
        <button type="button" onClick={onToggleProcess} className="dns-assessor-wiki-process-toggle">
          <div>
            <div className="dns-assessor-wiki-kicker">Процесс оценки</div>
            <h3>BPMN-схема настройки и прохождения симуляции</h3>
            <p>Большой блок для сотрудника без погружения в механику: от настройки до отчета.</p>
          </div>
          {processOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {processOpen && (
          <div className="dns-assessor-bpmn">
            <div className="dns-assessor-bpmn-lanes">
              <span>Оценщик</span>
              <span>Система</span>
              <span>Участник</span>
            </div>
            <div className="dns-assessor-bpmn-flow">
              {WIKI_PROCESS_STEPS.map((step, index) => (
                <div key={`${step.lane}-${step.title}`} className="dns-assessor-bpmn-node">
                  <div className="dns-assessor-bpmn-lane">{step.lane}</div>
                  <div className="dns-assessor-bpmn-title">{step.title}</div>
                  <div className="dns-assessor-bpmn-note">{step.note}</div>
                  {index < WIKI_PROCESS_STEPS.length - 1 && <ArrowRight className="dns-assessor-bpmn-arrow h-4 w-4" />}
                </div>
              ))}
            </div>
            <div className="dns-assessor-bpmn-dependencies">
              <div>
                <Target className="h-4 w-4" />
                Сложность и ручной выбор определяют, какие компетенции реально проверяются.
              </div>
              <div>
                <SlidersHorizontal className="h-4 w-4" />
                Каналы и события определяют поток сигналов и управленческую нагрузку.
              </div>
              <div>
                <BarChart3 className="h-4 w-4" />
                Стартовые метрики задают исходный контекст, а решения участника двигают показатели вверх или вниз.
              </div>
              <div>
                <Map className="h-4 w-4" />
                Итоговый отчет связывает решения, метрики и компетенции в доказательный результат.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AssessorPage() {
  const [, navigate] = useLocation();
  const { theme, themeClass, toggleTheme } = useDnsTheme();
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const easyCount = Number(settings?.easyAutoCaseCount ?? 6);
  const mediumCount = Number(settings?.mediumAutoCaseCount ?? 10);
  const hardCount = Number(settings?.hardAutoCaseCount ?? CASES_DATA.length);
  const hardSimulationMinutes = Number(settings?.hardSimulationMinutes ?? 60);
  const defaultTimePerCaseMinutes = Number(settings?.defaultTimePerCaseMinutes ?? 4);
  const minSimulationMinutes = Number(settings?.minSimulationMinutes ?? 20);

  // ── Wizard state ──
  const [wizardStep, setWizardStep] = useState(1);

  // ── Basic fields ──
  const [assessorName, setAssessorName] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantSetups, setParticipantSetups] = useState<AssessorParticipantConfig[]>(() => [
    createDefaultParticipantSetup("participant-1"),
  ]);
  const [activeParticipantId, setActiveParticipantId] = useState("participant-1");
  const [simulationRole, setSimulationRole] = useState<AssessorSimulationRoleId>("participant");
  const [difficulty, setDifficulty] = useState<AssessorDifficulty>("medium");

  // ── Advanced settings (hidden behind toggle) ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualSelection, setManualSelection] = useState(false);
  const [repeatCases, setRepeatCases] = useState(false);
  const [selectedCases, setSelectedCases] = useState<string[]>(CASES_DATA.map(c => c.id));
  const [isTestMode, setIsTestMode] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [channels, setChannels] = useState<AssessorChannels>({ audio: true, email: true, messenger: true, video: false });
  const [selectedChannelItemIds, setSelectedChannelItemIds] = useState<AssessorChannelItemIds>({
    email: EMAIL_CASES.map((item) => item.id),
    messenger: MESSENGER_CASES.map((item) => item.id),
    video: VIDEO_CASES.map((item) => item.id),
  });
  const [initialMetrics, setInitialMetrics] = useState<RealisticMetrics>(DEFAULT_METRICS);

  // ── Loading & errors ──
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [observeLoadingId, setObserveLoadingId] = useState<string | null>(null);
  const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);
  const [copiedAccessCode, setCopiedAccessCode] = useState<string | null>(null);
  const [launchResults, setLaunchResults] = useState<AssessorLaunchResult[]>([]);

  // ── Wiki toggle ──
  const [showWiki, setShowWiki] = useState(false);
  const [wikiProcessOpen, setWikiProcessOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<AssessorPanel>("participant");
  const [setupMode, setSetupMode] = useState<AssessorSetupMode>("recommended");
  const [scenarioConfirmed, setScenarioConfirmed] = useState(false);
  const [compositionConfirmed, setCompositionConfirmed] = useState(false);
  const [channelReviewDone, setChannelReviewDone] = useState(false);

  const liveSessionsQuery = useQuery({
    queryKey: ["/api/staff/live-sessions"],
    queryFn: getQueryFn<LiveSimulationMonitorSummary[]>({ on401: "throw" }),
    refetchInterval: 2500,
  });

  // Auto-set channels based on difficulty
  useEffect(() => {
    setLiveSimulationRole("assessor-setup");
  }, [difficulty]);

  useEffect(() => {
    setLiveSimulationRole("assessor-setup");
  }, []);

  useEffect(() => {
    setSelectedCases(CASES_DATA.map((item) => item.id));
  }, [CASES_DATA.length]);

  const monitorSessions = useMemo(
    () => liveSessionsQuery.data || [],
    [liveSessionsQuery.data],
  );

  const captureCurrentParticipantSetup = (): AssessorParticipantConfig => ({
    id: activeParticipantId,
    name: participantName,
    simulationRole,
    difficulty,
    setupMode,
    scenarioConfirmed,
    compositionConfirmed,
    channelReviewDone,
    showAdvanced,
    manualSelection,
    repeatCases,
    selectedCases: [...selectedCases],
    channels: { ...channels },
    selectedChannelItemIds: cloneChannelItemIds(selectedChannelItemIds),
    initialMetrics: cloneMetrics(initialMetrics),
    isTestMode,
    speedMultiplier,
  });

  const applyParticipantSetup = (setup: AssessorParticipantConfig) => {
    setParticipantName(setup.name);
    setSimulationRole(setup.simulationRole);
    setDifficulty(setup.difficulty);
    setSetupMode(setup.setupMode);
    setScenarioConfirmed(setup.scenarioConfirmed);
    setCompositionConfirmed(setup.compositionConfirmed);
    setChannelReviewDone(setup.channelReviewDone);
    setShowAdvanced(setup.showAdvanced);
    setManualSelection(setup.manualSelection);
    setRepeatCases(setup.repeatCases);
    setSelectedCases([...setup.selectedCases]);
    setChannels({ ...setup.channels });
    setSelectedChannelItemIds(cloneChannelItemIds(setup.selectedChannelItemIds));
    setInitialMetrics(cloneMetrics(setup.initialMetrics));
    setIsTestMode(setup.isTestMode);
    setSpeedMultiplier(setup.speedMultiplier);
    setStartError(null);
  };

  const saveActiveParticipantSetup = () => {
    const nextSetup = captureCurrentParticipantSetup();
    setParticipantSetups((current) => current.map((item) => (
      item.id === activeParticipantId ? nextSetup : item
    )));
    return nextSetup;
  };

  const switchParticipantSetup = (id: string) => {
    if (id === activeParticipantId) return;
    const nextSetup = participantSetups.find((item) => item.id === id);
    if (!nextSetup) return;
    saveActiveParticipantSetup();
    setActiveParticipantId(id);
    applyParticipantSetup(nextSetup);
    setActivePanel("participant");
  };

  const addParticipantSetup = (mode: "blank" | "copy" = "blank") => {
    saveActiveParticipantSetup();
    const sourceSetup = captureCurrentParticipantSetup();
    const nextSetup = mode === "copy"
      ? {
          ...sourceSetup,
          id: createAssessorParticipantId(),
          name: "",
        }
      : createDefaultParticipantSetup();
    setParticipantSetups((current) => [...current, nextSetup]);
    setActiveParticipantId(nextSetup.id);
    applyParticipantSetup(nextSetup);
    setActivePanel("participant");
  };

  const removeParticipantSetup = (id: string) => {
    if (participantSetups.length <= 1) {
      const resetSetup = createDefaultParticipantSetup(id);
      setParticipantSetups([resetSetup]);
      setActiveParticipantId(resetSetup.id);
      applyParticipantSetup(resetSetup);
      return;
    }

    const savedCurrent = captureCurrentParticipantSetup();
    const withSavedCurrent = participantSetups.map((item) => (
      item.id === activeParticipantId ? savedCurrent : item
    ));
    const nextSetups = withSavedCurrent.filter((item) => item.id !== id);
    setParticipantSetups(nextSetups);

    if (id === activeParticipantId) {
      const nextActive = nextSetups[0];
      setActiveParticipantId(nextActive.id);
      applyParticipantSetup(nextActive);
    }
  };

  const markCompositionDirty = () => {
    setCompositionConfirmed(false);
    setChannelReviewDone(false);
  };

  const toggleCase = (id: string) => {
    markCompositionDirty();
    setSelectedCases(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleChannelItem = (channelType: "email" | "messenger" | "video", id: string) => {
    markCompositionDirty();
    setSelectedChannelItemIds((current) => {
      const currentIds = current[channelType] || [];
      const nextIds = currentIds.includes(id)
        ? currentIds.filter((itemId) => itemId !== id)
        : [...currentIds, id];

      return { ...current, [channelType]: nextIds };
    });
  };

  const setAllChannelItems = (channelType: "email" | "messenger" | "video", ids: string[]) => {
    markCompositionDirty();
    setSelectedChannelItemIds((current) => ({ ...current, [channelType]: ids }));
  };

  // ── Quick start: запускает симуляцию в 1 клик с предустановленными настройками ──
  const quickStart = async (diff: AssessorDifficulty) => {
    if (!participantName.trim()) {
      setStartError("Введите ФИО участника");
      setWizardStep(1);
      setActivePanel("participant");
      return;
    }
    setDifficulty(diff);
    setIsTestMode(false);
    setSpeedMultiplier(1);
    setChannels({ ...DIFFICULTY_INFO[diff].channels });
    await handleStartInternal(diff, false, 1, { ...DIFFICULTY_INFO[diff].channels }, initialMetrics);
  };

  const buildLiveConfigPayload = (setup: AssessorParticipantConfig) => {
    const casesToUse = getCasesForSetup(setup);
    const baseTimeLimit =
      setup.difficulty === "hard"
        ? hardSimulationMinutes
        : Math.max(casesToUse.length * defaultTimePerCaseMinutes, minSimulationMinutes);
    const resolvedTimeLimit = Boolean(settings?.timeInfluenceEnabled)
      ? Math.max(5, Math.round(baseTimeLimit * TIME_PROFILE_RATIO[setup.difficulty]))
      : baseTimeLimit;
    const roleCard = SIMULATION_ROLE_CARDS.find((item) => item.id === setup.simulationRole);

    return {
      assessorName,
      participantName: setup.name.trim(),
      participantRole: roleCard?.participantRole || "Участник",
      difficulty: setup.difficulty,
      selectedCaseIds: casesToUse,
      manualSelection: setup.manualSelection,
      repeatCases: setup.repeatCases,
      timeLimit: resolvedTimeLimit,
      isTestMode: setup.isTestMode,
      speedMultiplier: setup.isTestMode ? setup.speedMultiplier : 1,
      enabledChannels: setup.channels,
      selectedChannelItemIds: setup.selectedChannelItemIds,
      initialMetrics: setup.initialMetrics,
    };
  };

  const createLiveSessionForSetup = async (setup: AssessorParticipantConfig) => {
    const config = await createRemoteLiveSimulation(buildLiveConfigPayload(setup));
    return {
      participantName: config.participantName,
      liveSessionId: config.liveSessionId,
      accessCode: config.accessCode,
    };
  };

  // ── Основная логика запуска ──
  const handleStartInternal = async (
    diff: AssessorDifficulty,
    testMode: boolean,
    speed: number,
    channelOverride = channels,
    metricsOverride = initialMetrics,
  ) => {
    const currentSetup = {
      ...captureCurrentParticipantSetup(),
      difficulty: diff,
      scenarioConfirmed: true,
      compositionConfirmed: true,
      channelReviewDone: true,
      isTestMode: testMode,
      speedMultiplier: speed,
      channels: { ...channelOverride },
      initialMetrics: cloneMetrics(metricsOverride),
    };

    setStartError(null);
    setIsStarting(true);
    try {
      await primeAudioPlayback();
      resetLiveSimulation();
      const result = await createLiveSessionForSetup(currentSetup);
      setLaunchResults([result]);
      setLiveSimulationRole("assessor-setup");
      await liveSessionsQuery.refetch();
      setActivePanel("sessions");
    } catch (error) {
      console.error("Failed to create live session", error);
      setStartError("Не удалось запустить симуляцию. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStart = async () => {
    const savedActive = saveActiveParticipantSetup();
    const launchSetups = participantSetups
      .map((item) => (item.id === activeParticipantId ? savedActive : item))
      .filter(isSetupReadyToLaunch);

    if (launchSetups.length === 0) {
      setStartError("Подготовьте хотя бы одного участника: ФИО, сценарий, состав и подтверждение каналов.");
      return;
    }

    setStartError(null);
    setIsStarting(true);
    try {
      await primeAudioPlayback();
      resetLiveSimulation();
      const results: AssessorLaunchResult[] = [];
      for (const setup of launchSetups) {
        results.push(await createLiveSessionForSetup(setup));
      }
      setLaunchResults(results);
      setLiveSimulationRole("assessor-setup");
      await liveSessionsQuery.refetch();
      setActivePanel("sessions");
    } catch (error) {
      console.error("Failed to create live sessions", error);
      setStartError("Не удалось запустить очередь симуляций. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setIsStarting(false);
    }
  };

  const applyMetricPreset = (presetId: string) => {
    const preset = STORE_STATE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    markCompositionDirty();
    setInitialMetrics(preset.metrics);
  };

  const observeLiveSession = async (liveSessionId: string) => {
    setObserveLoadingId(liveSessionId);
    setStartError(null);
    try {
      const session = await fetchRemoteLiveSimulation(liveSessionId);
      setLiveSimulationConfig(session.config);
      setLiveSimulationRole("assessor-monitor");
      navigate("/simulation");
    } catch (error) {
      console.error("Failed to open live session monitor", error);
      setStartError("Не удалось открыть наблюдение. Попробуйте обновить список и повторить.");
    } finally {
      setObserveLoadingId(null);
    }
  };

  const removeLiveSession = async (liveSessionId: string) => {
    setRemoveLoadingId(liveSessionId);
    setStartError(null);
    try {
      await apiRequest("DELETE", `/api/live-sessions/${liveSessionId}`);
      await liveSessionsQuery.refetch();
    } catch (error) {
      console.error("Failed to remove live session", error);
      setStartError("Не удалось удалить сессию. Попробуйте ещё раз.");
    } finally {
      setRemoveLoadingId(null);
    }
  };

  const getAutoCases = (diff: string): string[] => {
    if (diff === "easy") return CASES_DATA.slice(0, easyCount).map(c => c.id);
    if (diff === "hard") return CASES_DATA.slice(0, hardCount).map(c => c.id);
    return CASES_DATA.slice(0, mediumCount).map(c => c.id);
  };

  const getCasesForSetup = (setup: AssessorParticipantConfig) => (
    setup.manualSelection ? setup.selectedCases : getAutoCases(setup.difficulty)
  );

  const getSetupValidation = (setup: AssessorParticipantConfig) => {
    const issues: string[] = [];
    const nameReady = assessorName.trim().length > 0 && setup.name.trim().length > 0;
    const roleReady = SIMULATION_ROLE_CARDS.some((item) => item.id === setup.simulationRole && item.available);
    const scenarioReady = setup.scenarioConfirmed && Boolean(setup.difficulty);
    const casesReady = getCasesForSetup(setup).length > 0;
    const enabledChannelIssues = [
      setup.channels.email && setup.selectedChannelItemIds.email.length === 0 ? "выберите письма или выключите почту" : "",
      setup.channels.messenger && setup.selectedChannelItemIds.messenger.length === 0 ? "выберите сообщения или выключите ТёрКограмм" : "",
      setup.channels.video && setup.selectedChannelItemIds.video.length === 0 ? "выберите видео или выключите видеоканал" : "",
    ].filter(Boolean);
    const metricsReady = (Object.keys(DEFAULT_METRICS) as Array<keyof RealisticMetrics>).every((key) => {
      const value = Number(setup.initialMetrics[key]);
      if (!Number.isFinite(value)) return false;
      if (key === "nps") return value >= 1 && value <= 5;
      return value >= 0;
    });

    if (!nameReady) issues.push("заполните ФИО оценщика и участника");
    if (!roleReady) issues.push("выберите доступный тип симуляции");
    if (!scenarioReady) issues.push("выберите сценарий оценки");
    if (!casesReady) issues.push("выберите хотя бы одну ситуацию");
    issues.push(...enabledChannelIssues);
    if (!metricsReady) issues.push("проверьте стартовые метрики магазина");

    const compositionReady = casesReady && enabledChannelIssues.length === 0 && metricsReady;
    const readyToLaunch =
      nameReady &&
      roleReady &&
      scenarioReady &&
      compositionReady &&
      setup.compositionConfirmed &&
      setup.channelReviewDone;

    return {
      nameReady,
      roleReady,
      scenarioReady,
      compositionReady,
      channelReviewReady: compositionReady,
      readyToLaunch,
      issues,
    };
  };

  const visibleParticipantSetups = participantSetups.map((item) => (
    item.id === activeParticipantId ? captureCurrentParticipantSetup() : item
  ));
  const activeParticipantIndex = Math.max(
    0,
    visibleParticipantSetups.findIndex((item) => item.id === activeParticipantId),
  );
  const activeParticipantLabel = participantName.trim() || `Участник ${activeParticipantIndex + 1}`;
  const isSetupReadyToLaunch = (setup: AssessorParticipantConfig) => getSetupValidation(setup).readyToLaunch;
  const readyParticipantSetups = visibleParticipantSetups.filter(isSetupReadyToLaunch);

  const activeCaseCount = manualSelection ? selectedCases.length : getAutoCases(difficulty).length;
  const selectedSimulationCard = SIMULATION_ROLE_CARDS.find((item) => item.id === simulationRole) || SIMULATION_ROLE_CARDS[0];
  const isParticipantSimulation = simulationRole === "participant";
  const updateMetric = <K extends keyof RealisticMetrics>(key: K, value: number) => {
    markCompositionDirty();
    const normalizedValue = key === "nps"
      ? Math.max(1, Math.min(5, Math.round((Number.isFinite(value) ? value : 3.3) * 100) / 100))
      : Number.isFinite(value) ? value : 0;
    setInitialMetrics((current) => ({ ...current, [key]: normalizedValue }));
  };

  // ── Status badge helper ──
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "running": return { label: "Идёт", color: "text-[#00C853]" };
      case "completed": return { label: "Завершена", color: "text-[#4a9eff]" };
      case "waiting": return { label: "Ожидает", color: "text-[#FFB300]" };
      default: return { label: status, color: "text-[#8890a8]" };
    }
  };

  const channelInfo = [
    { key: "audio", label: "Аудиозвонки", icon: Phone, color: "#FF6B00" },
    { key: "email", label: "Корпоративная почта", icon: Mail, color: "#4a9eff" },
    { key: "messenger", label: "ТёрКограмм", icon: MessageSquare, color: "#00C853" },
    { key: "video", label: "Видеосообщения", icon: Video, color: "#a78bfa" },
  ] as const;
  const channelSignalGroups = [
    {
      key: "email" as const,
      title: "Письма",
      enabled: channels.email,
      color: "#4a9eff",
      items: EMAIL_CASES.map((item) => ({
        id: item.id,
        title: item.subject || item.id,
        subtitle: item.from || "Корпоративная почта",
      })),
    },
    {
      key: "messenger" as const,
      title: "Мессенджер",
      enabled: channels.messenger,
      color: "#00C853",
      items: MESSENGER_CASES.map((item) => ({
        id: item.id,
        title: item.senderName || item.id,
        subtitle: item.senderRole || "Сообщение",
      })),
    },
    {
      key: "video" as const,
      title: "Видео",
      enabled: channels.video,
      color: "#a78bfa",
      items: VIDEO_CASES.map((item) => ({
        id: item.id,
        title: item.title || item.id,
        subtitle: item.sender || "Видеообращение",
      })),
    },
  ];
  const selectedChannelSignalCount = channelSignalGroups.reduce((sum, group) => (
    sum + (group.enabled ? selectedChannelItemIds[group.key].length : 0)
  ), 0);

  const activeSetupValidation = getSetupValidation(captureCurrentParticipantSetup());
  const participantReady = activeSetupValidation.nameReady;
  const compositionReady = activeSetupValidation.compositionReady;
  const firstValidationIssue = activeSetupValidation.issues[0] || "Проверьте заполнение предыдущего шага.";
  const enabledChannelLabels = channelInfo
    .filter((item) => channels[item.key])
    .map((item) => item.label);
  const estimatedBaseTime =
    difficulty === "hard"
      ? hardSimulationMinutes
      : Math.max(activeCaseCount * defaultTimePerCaseMinutes, minSimulationMinutes);
  const estimatedTimeLimit = Boolean(settings?.timeInfluenceEnabled)
    ? Math.max(5, Math.round(estimatedBaseTime * TIME_PROFILE_RATIO[difficulty]))
    : estimatedBaseTime;
  const scenarioName =
    manualSelection
      ? "Ручная сборка"
      : difficulty === "easy"
        ? "Первый проход"
        : difficulty === "hard"
          ? "Сложная смена"
          : "Стандартная оценка";
  const reviewItems = [
    {
      title: "Участник и оценщик указаны",
      detail: participantReady ? `${participantName || "Участник"} · ${assessorName || "Оценщик"}` : "Заполните ФИО оценщика и участника.",
      done: participantReady,
    },
    {
      title: "Сценарий выбран",
      detail: scenarioConfirmed ? `${scenarioName}, ${estimatedTimeLimit} минут.` : "Выберите один из сценариев оценки.",
      done: activeSetupValidation.scenarioReady,
    },
    {
      title: "Состав сценария проверен",
      detail: compositionReady ? `${activeCaseCount} ситуаций, ${enabledChannelLabels.length} каналов.` : `Проверьте состав: ${firstValidationIssue}.`,
      done: compositionConfirmed && compositionReady,
    },
    {
      title: "Каналы подтверждены",
      detail: channelReviewDone ? "События каналов проверены." : "Подтвердите почту, чат и видео перед запуском.",
      done: channelReviewDone && compositionReady,
    },
  ];
  const setupProgress = reviewItems.filter((item) => item.done).length;
  const completedSessionCount = monitorSessions.filter((item) => item.status === "completed").length;

  const copyAccessCode = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedAccessCode(code);
      window.setTimeout(() => {
        setCopiedAccessCode((current) => (current === code ? null : current));
      }, 1600);
    } catch {
      setCopiedAccessCode(null);
    }
  };

  const renderCopyAccessCodeButton = (code: string) => {
    const copied = copiedAccessCode === code;
    return (
      <button
        type="button"
        title={copied ? "Скопировано" : "Скопировать"}
        aria-label={`Скопировать код ${code}`}
        className="dns-assessor-v2-code-button group relative inline-flex items-center gap-1.5 rounded-lg border border-[#4a9eff]/35 bg-[#101826]/90 px-2 py-1 font-mono text-sm font-black tracking-[0.16em] text-white transition-all hover:border-[#ff6b00] hover:bg-[#ff6b00]/12 focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/50"
        onClick={() => copyAccessCode(code)}
      >
        <span>{code}</span>
        <Copy className="h-3.5 w-3.5 text-[#8ec5ff] transition-colors group-hover:text-[#ffd0a6]" />
        <span className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#2a3a4e] bg-[#0d1421] px-2 py-1 text-[10px] font-semibold tracking-normal text-[#f2f7ff] opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus:opacity-100">
          {copied ? "Скопировано" : "Скопировать"}
        </span>
      </button>
    );
  };

  useEffect(() => {
    if (activePanel === "sessions") {
      return;
    }

    if (!participantReady && activePanel !== "participant") {
      setActivePanel("participant");
      return;
    }

    if (!activeSetupValidation.scenarioReady && (activePanel === "composition" || activePanel === "review")) {
      setActivePanel("scenario");
      return;
    }

    if ((!compositionConfirmed || !compositionReady) && activePanel === "review") {
      setActivePanel("composition");
    }
  }, [
    activePanel,
    activeSetupValidation.scenarioReady,
    compositionConfirmed,
    compositionReady,
    participantReady,
  ]);

  const applyScenario = (nextDifficulty: AssessorDifficulty, manual = false) => {
    setDifficulty(nextDifficulty);
    setManualSelection(manual);
    setChannels({ ...DIFFICULTY_INFO[nextDifficulty].channels });
    setScenarioConfirmed(true);
    setCompositionConfirmed(false);
    setChannelReviewDone(false);
    setStartError(null);
    if (manual) {
      setSetupMode("expert");
    }
  };

  const chooseSetupMode = (nextMode: AssessorSetupMode) => {
    setSetupMode(nextMode);
    setCompositionConfirmed(false);
    setChannelReviewDone(false);
    setStartError(null);

    if (nextMode === "recommended") {
      setManualSelection(false);
      setShowAdvanced(false);
      setChannels({ ...DIFFICULTY_INFO[difficulty].channels });
      return;
    }

    setManualSelection(true);
    setShowAdvanced(true);
  };

  const openPanel = (panel: AssessorPanel) => {
    if (panel === "sessions") {
      setActivePanel(panel);
      return;
    }
    if (panel === "scenario" && !participantReady) return;
    if (panel === "composition" && !activeSetupValidation.scenarioReady) return;
    if (panel === "review" && (!compositionConfirmed || !compositionReady)) return;
    setActivePanel(panel);
  };

  const continueFromParticipant = () => {
    if (!participantReady) {
      setStartError("Заполните ФИО оценщика и участника");
      return;
    }
    setStartError(null);
    setWizardStep(2);
    setActivePanel("scenario");
  };

  const continueFromScenario = () => {
    if (!participantReady) {
      setActivePanel("participant");
      setStartError("Заполните ФИО оценщика и участника");
      return;
    }
    if (!activeSetupValidation.scenarioReady) {
      setStartError("Выберите сценарий оценки");
      return;
    }
    setStartError(null);
    setWizardStep(3);
    setActivePanel("composition");
  };

  const continueFromComposition = () => {
    if (!compositionReady) {
      setStartError(`Проверьте состав: ${firstValidationIssue}`);
      return;
    }
    setCompositionConfirmed(true);
    setStartError(null);
    setActivePanel("review");
  };

  const confirmChannels = () => {
    if (!compositionReady) {
      setStartError(`Проверьте состав: ${firstValidationIssue}`);
      setActivePanel("composition");
      return;
    }
    setChannelReviewDone(true);
    setStartError(null);
  };

  const railItems: Array<{ id: AssessorPanel; title: string; state: string; done: boolean; locked: boolean }> = [
    { id: "participant", title: "Участник", state: participantReady ? "готово" : "нужно", done: participantReady, locked: false },
    { id: "scenario", title: "Сценарий", state: activeSetupValidation.scenarioReady ? "готово" : participantReady ? "активно" : "после ФИО", done: activeSetupValidation.scenarioReady, locked: !participantReady },
    { id: "composition", title: "Состав", state: compositionConfirmed && compositionReady ? "готово" : activeSetupValidation.scenarioReady ? "можно" : "после выбора", done: compositionConfirmed && compositionReady, locked: !activeSetupValidation.scenarioReady },
    { id: "review", title: "Проверка", state: channelReviewDone && compositionReady ? "готово" : compositionConfirmed && compositionReady ? "нужно" : "закрыто", done: channelReviewDone && compositionReady, locked: !compositionConfirmed || !compositionReady },
    { id: "sessions", title: "Сессии и результаты", state: completedSessionCount > 0 ? `${completedSessionCount} готово` : "мониторинг", done: completedSessionCount > 0, locked: false },
  ];

  const renderRail = () => (
    <nav className="dns-assessor-v2-rail" aria-label="Разделы меню оценщика">
      {railItems.map((item, index) => {
        const active = activePanel === item.id;
        const className = [
          "dns-assessor-v2-rail-item",
          active ? "dns-assessor-v2-rail-item--active" : "",
          item.done && !active ? "dns-assessor-v2-rail-item--done" : "",
          item.locked ? "dns-assessor-v2-rail-item--locked" : "",
        ].filter(Boolean).join(" ");

        return (
          <button
            key={item.id}
            type="button"
            className={className}
            onClick={() => openPanel(item.id)}
            disabled={item.locked}
            aria-current={active ? "step" : undefined}
          >
            <span className="dns-assessor-v2-rail-num">{index + 1}</span>
            <span className="dns-assessor-v2-rail-title">{item.title}</span>
            <span className="dns-assessor-v2-rail-state">{item.state}</span>
          </button>
        );
      })}
    </nav>
  );

  const renderParticipantPanel = () => (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">Шаг 1</div>
          <h2>Кто проходит оценку</h2>
          <p>Сначала фиксируем оценщика, участника и роль симуляции. Следующие шаги откроются после заполнения этих данных.</p>
        </div>
        <span className={`dns-assessor-v2-pill ${participantReady ? "dns-assessor-v2-pill--ok" : "dns-assessor-v2-pill--warn"}`}>
          {participantReady ? "Готово" : "Нужно заполнить"}
        </span>
      </div>

      <div className="dns-assessor-v2-field-grid">
        <div>
          <Label className="dns-assessor-v2-label">ФИО оценщика</Label>
          <Input
            value={assessorName}
            onChange={(event) => setAssessorName(event.target.value)}
            placeholder="Иванов И.И."
            className="dns-assessor-v2-input"
            data-testid="input-assessor-name"
          />
        </div>
        <div>
          <Label className="dns-assessor-v2-label">ФИО участника</Label>
          <Input
            value={participantName}
            onChange={(event) => setParticipantName(event.target.value)}
            placeholder="Петров П.П."
            className="dns-assessor-v2-input"
            data-testid="input-participant-name"
          />
        </div>
      </div>

      <div className="dns-assessor-v2-section-title">Очередь участников</div>
      <div className="dns-assessor-v2-participant-queue">
        <div className="dns-assessor-v2-queue-head">
          <div>
            <strong>{visibleParticipantSetups.length} участников</strong>
            <p>{readyParticipantSetups.length} готовы к запуску. Настройки сохраняются отдельно для каждого участника.</p>
          </div>
          <div className="dns-assessor-v2-inline-actions">
            <button type="button" className="dns-assessor-v2-light-button" onClick={() => addParticipantSetup("copy")}>
              <ClipboardCheck className="h-4 w-4" />
              Копировать настройки
            </button>
            <button type="button" className="dns-assessor-v2-light-button" onClick={() => addParticipantSetup("blank")}>
              <Users className="h-4 w-4" />
              Пустые поля
            </button>
          </div>
        </div>
        <div className="dns-assessor-v2-participant-list">
          {visibleParticipantSetups.map((item, index) => {
            const active = item.id === activeParticipantId;
            const ready = isSetupReadyToLaunch(item);
            const casesCount = getCasesForSetup(item).length;
            return (
              <div
                key={item.id}
                className={`dns-assessor-v2-participant-card ${active ? "dns-assessor-v2-participant-card--active" : ""} ${ready ? "dns-assessor-v2-participant-card--ready" : ""}`}
                onClick={() => switchParticipantSetup(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    switchParticipantSetup(item.id);
                  }
                }}
              >
                <span className="dns-assessor-v2-participant-num">{index + 1}</span>
                <div>
                  <strong>{item.name.trim() || `Участник ${index + 1}`}</strong>
                  <p>{ready ? "готов к запуску" : item.name.trim() ? "нужно завершить настройку" : "укажите ФИО"} · {casesCount} кейсов · {DIFFICULTY_INFO[item.difficulty].label}</p>
                </div>
                {visibleParticipantSetups.length > 1 && (
                  <button
                    type="button"
                    className="dns-assessor-v2-participant-remove"
                    aria-label="Удалить участника"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeParticipantSetup(item.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="dns-assessor-v2-section-title">Тип симуляции</div>
      <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--roles">
        {SIMULATION_ROLE_CARDS.map((item) => {
          const active = simulationRole === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`dns-assessor-v2-choice-card ${active ? "dns-assessor-v2-choice-card--active" : ""} ${!item.available ? "dns-assessor-v2-choice-card--disabled" : ""}`}
              onClick={() => item.available && setSimulationRole(item.id)}
              disabled={!item.available}
            >
              <span>{item.title}</span>
              <p>{item.description}</p>
              {!item.available && <em>В разработке</em>}
            </button>
          );
        })}
      </div>

      <div className="dns-assessor-v2-note">
        После заполнения участника активируется раздел сценария. Так оценщик не видит все настройки сразу и не теряется в структуре.
      </div>
    </section>
  );

  const renderScenarioPanel = () => (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-mode-switch" role="group" aria-label="Режим настройки">
        <button
          type="button"
          className={setupMode === "recommended" ? "dns-assessor-v2-mode dns-assessor-v2-mode--active" : "dns-assessor-v2-mode"}
          onClick={() => chooseSetupMode("recommended")}
        >
          Рекомендованный режим
        </button>
        <button
          type="button"
          className={setupMode === "expert" ? "dns-assessor-v2-mode dns-assessor-v2-mode--active" : "dns-assessor-v2-mode"}
          onClick={() => chooseSetupMode("expert")}
        >
          Экспертный режим
        </button>
      </div>
      <div className="dns-assessor-v2-mode-explainer">
        <div className={setupMode === "recommended" ? "dns-assessor-v2-mode-note dns-assessor-v2-mode-note--active" : "dns-assessor-v2-mode-note"}>
          <strong>Рекомендованный</strong>
          <p>Оценщик выбирает сценарий, а система сама подбирает кейсы, каналы, время и стартовый профиль.</p>
        </div>
        <div className={setupMode === "expert" ? "dns-assessor-v2-mode-note dns-assessor-v2-mode-note--active" : "dns-assessor-v2-mode-note"}>
          <strong>Экспертный</strong>
          <p>Открывает ручной выбор кейсов, событий каналов, метрик и тренировочной скорости для методической настройки.</p>
        </div>
      </div>

      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">Шаг 2</div>
          <h2>Выберите сценарий оценки</h2>
          <p>Оценщик выбирает понятный смысл оценки. Система сама собирает сложность, каналы, кейсы и стартовые метрики.</p>
        </div>
        <span className={`dns-assessor-v2-pill ${scenarioConfirmed ? "dns-assessor-v2-pill--ok" : "dns-assessor-v2-pill--warn"}`}>
          {scenarioConfirmed ? "Сценарий выбран" : "Выберите"}
        </span>
      </div>

      <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--scenarios">
        <button
          type="button"
          className={`dns-assessor-v2-choice-card ${scenarioConfirmed && difficulty === "medium" && !manualSelection ? "dns-assessor-v2-choice-card--active" : ""}`}
          onClick={() => applyScenario("medium")}
        >
          <span>Стандартная оценка заместителя</span>
          <p>Баланс нагрузки, типовые каналы, умеренное время.</p>
          <div className="dns-assessor-v2-chip-row"><b>40 мин</b><b>{mediumCount} кейсов</b><b>3 канала</b></div>
        </button>
        <button
          type="button"
          className={`dns-assessor-v2-choice-card ${scenarioConfirmed && difficulty === "easy" && !manualSelection ? "dns-assessor-v2-choice-card--active" : ""}`}
          onClick={() => applyScenario("easy")}
        >
          <span>Первый проход</span>
          <p>Мягкий сценарий для знакомства с форматом.</p>
          <div className="dns-assessor-v2-chip-row"><b>20 мин</b><b>{easyCount} кейсов</b></div>
        </button>
        <button
          type="button"
          className={`dns-assessor-v2-choice-card ${scenarioConfirmed && difficulty === "hard" && !manualSelection ? "dns-assessor-v2-choice-card--active" : ""}`}
          onClick={() => applyScenario("hard")}
        >
          <span>Сложная смена</span>
          <p>Проверка при высокой параллельной нагрузке.</p>
          <div className="dns-assessor-v2-chip-row"><b>{hardSimulationMinutes} мин</b><b>{hardCount} кейсов</b><b>все каналы</b></div>
        </button>
        <button
          type="button"
          className={`dns-assessor-v2-choice-card dns-assessor-v2-choice-card--manual ${scenarioConfirmed && manualSelection ? "dns-assessor-v2-choice-card--active" : ""}`}
          onClick={() => applyScenario("medium", true)}
        >
          <span>Ручная сборка</span>
          <p>Для методиста: полный контроль кейсов, каналов и метрик.</p>
          <div className="dns-assessor-v2-chip-row"><b>экспертно</b><b>гибко</b></div>
        </button>
      </div>

      <div className="dns-assessor-v2-note">
        Раздел “Состав” откроется после выбора сценария. Это сохраняет понятность первого варианта и боковую навигацию второго.
      </div>
    </section>
  );

  const renderCompositionPanel = () => (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">Шаг 3</div>
          <h2>Состав сценария</h2>
          <p>Проверьте кейсы, каналы и стартовое состояние магазина. В рекомендованном режиме достаточно подтвердить состав.</p>
        </div>
        <span className={`dns-assessor-v2-pill ${compositionConfirmed ? "dns-assessor-v2-pill--ok" : ""}`}>
          {activeCaseCount} ситуаций
        </span>
      </div>

      <div className="dns-assessor-v2-summary-strip">
        <div><span>Сценарий</span><strong>{scenarioName}</strong></div>
        <div><span>Сложность</span><strong>{DIFFICULTY_INFO[difficulty].label}</strong></div>
        <div><span>Время</span><strong>{estimatedTimeLimit} мин</strong></div>
        <div><span>Каналы</span><strong>{enabledChannelLabels.length}</strong></div>
      </div>

      <div className="dns-assessor-v2-customizer">
        <div className="dns-assessor-v2-customizer-head">
          <div>
            <span>Настройка под участника</span>
            <strong>{activeParticipantLabel}</strong>
            <p>Эти параметры сохраняются только для выбранного участника из очереди.</p>
          </div>
          <div className="dns-assessor-v2-customizer-mode">
            <span>Ручной выбор кейсов</span>
            <Switch
              checked={manualSelection}
              onCheckedChange={(value) => {
                setManualSelection(value);
                setCompositionConfirmed(false);
                setChannelReviewDone(false);
                if (value) {
                  setShowAdvanced(true);
                  setSetupMode("expert");
                }
              }}
              data-testid="toggle-manual"
            />
          </div>
        </div>
        <div className="dns-assessor-v2-customizer-actions">
          <button type="button" className={difficulty === "easy" ? "dns-assessor-v2-customizer-button dns-assessor-v2-customizer-button--active" : "dns-assessor-v2-customizer-button"} onClick={() => applyScenario("easy", manualSelection)}>
            Снизить нагрузку
            <span>меньше кейсов и сигналов</span>
          </button>
          <button type="button" className={difficulty === "medium" ? "dns-assessor-v2-customizer-button dns-assessor-v2-customizer-button--active" : "dns-assessor-v2-customizer-button"} onClick={() => applyScenario("medium", manualSelection)}>
            Сбалансировать
            <span>типовая оценка</span>
          </button>
          <button type="button" className={difficulty === "hard" ? "dns-assessor-v2-customizer-button dns-assessor-v2-customizer-button--active" : "dns-assessor-v2-customizer-button"} onClick={() => applyScenario("hard", manualSelection)}>
            Усилить проверку
            <span>больше нагрузки и каналов</span>
          </button>
        </div>
        {manualSelection && (
          <div className="dns-assessor-v2-manual-case-block">
            <div className="dns-assessor-v2-case-tools">
              <strong>Кейсы участника</strong>
              <span>{selectedCases.length} выбрано</span>
              <button type="button" onClick={() => { markCompositionDirty(); setSelectedCases(CASES_DATA.map((item) => item.id)); }}>Все</button>
              <button type="button" onClick={() => { markCompositionDirty(); setSelectedCases([]); }}>Снять</button>
            </div>
            <div className="dns-assessor-v2-scroll-list">
              {CASES_DATA.map((item) => {
                const checked = selectedCases.includes(item.id);
                return (
                  <label key={item.id} className={`dns-assessor-v2-check-row ${checked ? "dns-assessor-v2-check-row--active" : ""}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleCase(item.id)} />
                    <span>{item.title || item.id}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="dns-assessor-v2-toggle-line">
        <div>
          <strong>Расширенные настройки</strong>
          <p>Откройте, если нужно вручную выбрать кейсы, события каналов или стартовые метрики.</p>
        </div>
        <Switch checked={showAdvanced || setupMode === "expert"} onCheckedChange={(value) => chooseSetupMode(value ? "expert" : "recommended")} />
      </div>

      {!(showAdvanced || setupMode === "expert") ? (
        <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--compact">
          <div className="dns-assessor-v2-info-card">
            <h3>Кейсы</h3>
            <p>Автоподбор по сценарию: {activeCaseCount} ситуаций.</p>
          </div>
          <div className="dns-assessor-v2-info-card">
            <h3>Каналы</h3>
            <p>{enabledChannelLabels.join(", ") || "Каналы выключены"}</p>
          </div>
          <div className="dns-assessor-v2-info-card">
            <h3>События</h3>
            <p>Выбрано событий из каналов: {selectedChannelSignalCount}.</p>
          </div>
          <div className="dns-assessor-v2-info-card">
            <h3>Метрики</h3>
            <p>Стартовое состояние магазина можно уточнить в экспертном режиме.</p>
          </div>
        </div>
      ) : (
        <div className="dns-assessor-v2-expert-stack">
          <div className="dns-assessor-v2-section-title">Каналы коммуникации</div>
          <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--compact">
            {channelInfo.map(({ key, label, icon: Icon, color }) => {
              const checked = channels[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`dns-assessor-v2-channel-card ${checked ? "dns-assessor-v2-channel-card--active" : ""}`}
                  onClick={() => { markCompositionDirty(); setChannels((current) => ({ ...current, [key]: !current[key] })); }}
                  style={{ "--channel-color": color } as any}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="dns-assessor-v2-section-title">События из каналов</div>
          <div className="dns-assessor-v2-channel-groups">
            {channelSignalGroups.map((group) => (
              <div key={group.key} className={`dns-assessor-v2-channel-group ${!group.enabled ? "dns-assessor-v2-channel-group--disabled" : ""}`}>
                <div className="dns-assessor-v2-channel-group-head">
                  <strong>{group.title}</strong>
                  <span>{selectedChannelItemIds[group.key].length} из {group.items.length}</span>
                </div>
                <div className="dns-assessor-v2-channel-actions">
                  <button type="button" onClick={() => setAllChannelItems(group.key, group.items.map((item) => item.id))} disabled={!group.enabled}>Все</button>
                  <button type="button" onClick={() => setAllChannelItems(group.key, [])} disabled={!group.enabled}>Нет</button>
                </div>
              </div>
            ))}
          </div>

          <div className="dns-assessor-v2-section-title">Стартовые метрики магазина</div>
          <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--compact">
            {STORE_STATE_PRESETS.map((preset) => {
              const active = Object.entries(preset.metrics).every(([key, value]) => initialMetrics[key as keyof RealisticMetrics] === value);
              return (
                <button key={preset.id} type="button" className={`dns-assessor-v2-info-card ${active ? "dns-assessor-v2-info-card--active" : ""}`} onClick={() => applyMetricPreset(preset.id)}>
                  <h3>{preset.title}</h3>
                  <p>{preset.summary}</p>
                </button>
              );
            })}
          </div>
          <div className="dns-assessor-v2-metric-grid">
            {Object.keys(STORE_METRIC_LABELS).map((key) => {
              const metricKey = key as keyof RealisticMetrics;
              const isClientRating = metricKey === "nps";
              return (
                <div key={key}>
                  <Label className="dns-assessor-v2-label">{STORE_METRIC_LABELS[metricKey]}</Label>
                  <Input
                    type="number"
                    min={isClientRating ? 1 : 0}
                    max={isClientRating ? 5 : undefined}
                    step={isClientRating ? 0.01 : 1}
                    value={initialMetrics[metricKey]}
                    onChange={(event) => updateMetric(metricKey, Number(event.target.value))}
                    className="dns-assessor-v2-input"
                  />
                </div>
              );
            })}
          </div>

          <div className="dns-assessor-v2-toggle-line">
            <div>
              <strong>Тренировочный режим</strong>
              <p>Для тестового прохождения можно ускорить время симуляции.</p>
            </div>
            <Switch checked={isTestMode} onCheckedChange={setIsTestMode} />
          </div>
          {isTestMode && (
            <div className="dns-assessor-v2-slider-row">
              <span>Скорость: x{speedMultiplier}</span>
              <Slider value={[speedMultiplier]} min={0.5} max={3} step={0.5} onValueChange={([value]) => setSpeedMultiplier(value)} />
            </div>
          )}
        </div>
      )}
    </section>
  );

  const renderReviewPanel = () => (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">Шаг 4</div>
          <h2>Проверка перед запуском</h2>
          <p>Финальный экран объясняет, почему запуск доступен или закрыт. Если что-то не готово, интерфейс показывает причину.</p>
        </div>
        <span className={`dns-assessor-v2-pill ${channelReviewDone ? "dns-assessor-v2-pill--ok" : "dns-assessor-v2-pill--warn"}`}>
          Готовность {setupProgress}/4
        </span>
      </div>

      <div className="dns-assessor-v2-review-list">
        {reviewItems.map((item, index) => (
          <div key={item.title} className="dns-assessor-v2-review-row">
            <span className={`dns-assessor-v2-review-num ${item.done ? "dns-assessor-v2-review-num--done" : ""}`}>{index + 1}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            <span className={`dns-assessor-v2-pill ${item.done ? "dns-assessor-v2-pill--ok" : "dns-assessor-v2-pill--warn"}`}>
              {item.done ? "готово" : "нужно"}
            </span>
          </div>
        ))}
      </div>

      <div className="dns-assessor-v2-launch-list">
        <div className="dns-assessor-v2-section-title">Очередь запуска</div>
        {visibleParticipantSetups.map((item, index) => {
          const ready = isSetupReadyToLaunch(item);
          return (
            <div key={item.id} className={`dns-assessor-v2-launch-row ${ready ? "dns-assessor-v2-launch-row--ready" : ""}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{item.name.trim() || `Участник ${index + 1}`}</strong>
                <p>{getCasesForSetup(item).length} кейсов · {DIFFICULTY_INFO[item.difficulty].label} · {item.manualSelection ? "ручная настройка" : "автосценарий"}</p>
              </div>
              <em>{ready ? "готов" : "не готов"}</em>
            </div>
          );
        })}
      </div>

      <div className="dns-assessor-v2-note">
        Запуск появляется только после подтверждения состава. Это делает подготовку понятной и снижает риск случайно стартовать непроверенный сценарий.
      </div>
    </section>
  );

  const renderSessionsPanel = () => (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">Рабочий центр</div>
          <h2>Текущие симуляции</h2>
          <p>Сессии вынесены в отдельный раздел, а не спрятаны внизу страницы настройки.</p>
        </div>
        <span className="dns-assessor-v2-pill dns-assessor-v2-pill--ok">
          {monitorSessions.filter((item) => item.status === "running").length} активные
        </span>
      </div>

      <div className="dns-assessor-v2-summary-strip">
        <div><span>Всего</span><strong>{monitorSessions.length}</strong></div>
        <div><span>Идут</span><strong className="text-[#35d38a]">{monitorSessions.filter((item) => item.status === "running").length}</strong></div>
        <div><span>Ожидают</span><strong className="text-[#f5c04e]">{monitorSessions.filter((item) => item.status === "waiting").length}</strong></div>
        <div><span>Завершены</span><strong className="text-[#5eb1ff]">{monitorSessions.filter((item) => item.status === "completed").length}</strong></div>
      </div>

      {launchResults.length > 0 && (
        <div className="dns-assessor-v2-launch-result">
          <div className="dns-assessor-v2-section-title">Последний запуск</div>
          {launchResults.map((item) => (
            <div key={item.liveSessionId} className="dns-assessor-v2-launch-result-row">
              <span>{item.participantName}</span>
              {renderCopyAccessCodeButton(item.accessCode)}
            </div>
          ))}
        </div>
      )}

      <div className="dns-assessor-v2-session-list">
        {monitorSessions.length === 0 && (
          <div className="dns-assessor-v2-empty">
            <Info className="h-4 w-4" />
            Пока нет симуляций. После запуска участники появятся здесь автоматически.
          </div>
        )}
        {monitorSessions.map((session) => {
          const statusInfo = getStatusLabel(session.status);
          return (
            <div key={session.liveSessionId} className="dns-assessor-v2-session-card">
              <div className="dns-assessor-v2-session-person">
                <span className="dns-assessor-v2-session-avatar">
                  {(session.participantName || "У").trim().slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <strong>{session.participantName}</strong>
                  <p>Оценщик: {session.assessorName || "—"}</p>
                </div>
              </div>
              <div className="dns-assessor-v2-session-code">
                <span>Код студента</span>
                {renderCopyAccessCodeButton(session.accessCode)}
              </div>
              <div className="dns-assessor-v2-session-state">
                <span className={statusInfo.color}>{statusInfo.label}</span>
                <div className="dns-assessor-v2-progress">
                  <span style={{ width: Math.round(session.progressPercent) + "%" }} />
                </div>
                <em>{Math.round(session.progressPercent)}%</em>
              </div>
              <div className="dns-assessor-v2-session-actions">
                {session.status === "completed" && session.runtimeSessionId ? (
                  <Button type="button" size="sm" className="bg-[#35d38a] text-[#061018] hover:bg-[#2bc479]" onClick={() => navigate(`/results/${session.runtimeSessionId}`)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Результаты
                  </Button>
                ) : (
                  <Button type="button" size="sm" className="bg-[#5eb1ff] text-white hover:bg-[#4a9fe8]" onClick={() => observeLiveSession(session.liveSessionId)} disabled={observeLoadingId === session.liveSessionId}>
                    <Eye className="mr-2 h-4 w-4" />
                    {observeLoadingId === session.liveSessionId ? "Открытие..." : "Наблюдать"}
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" className="border-[#ff6472]/35 bg-transparent text-[#ffc2c8] hover:bg-[#ff6472]/10" onClick={() => removeLiveSession(session.liveSessionId)} disabled={removeLoadingId === session.liveSessionId}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {removeLoadingId === session.liveSessionId ? "Удаление..." : "Удалить"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderMainPanel = () => {
    switch (activePanel) {
      case "participant": return renderParticipantPanel();
      case "scenario": return renderScenarioPanel();
      case "composition": return renderCompositionPanel();
      case "review": return renderReviewPanel();
      case "sessions": return renderSessionsPanel();
      default: return renderParticipantPanel();
    }
  };

  const goBackPanel = () => {
    if (activePanel === "scenario") setActivePanel("participant");
    if (activePanel === "composition") setActivePanel("scenario");
    if (activePanel === "review") setActivePanel("composition");
  };

  const renderBackAction = () => (
    activePanel === "scenario" || activePanel === "composition" || activePanel === "review" ? (
      <button type="button" className="dns-assessor-v2-secondary" onClick={goBackPanel}>
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>
    ) : null
  );

  const renderPrimaryAction = () => {
    if (activePanel === "participant") {
      return <Button type="button" className="dns-assessor-v2-primary" onClick={continueFromParticipant} disabled={!participantReady}>Продолжить к сценарию</Button>;
    }
    if (activePanel === "scenario") {
      return <Button type="button" className="dns-assessor-v2-primary" onClick={continueFromScenario} disabled={!scenarioConfirmed}>Продолжить к составу</Button>;
    }
    if (activePanel === "composition") {
      return <Button type="button" className="dns-assessor-v2-primary" onClick={continueFromComposition} disabled={!compositionReady}>Перейти к проверке</Button>;
    }
    if (activePanel === "review") {
      if (!channelReviewDone) {
        return <Button type="button" className="dns-assessor-v2-primary" onClick={confirmChannels}>Подтвердить каналы</Button>;
      }
      return (
        <Button type="button" className="dns-assessor-v2-primary" onClick={handleStart} disabled={readyParticipantSetups.length === 0 || isStarting} data-testid="button-start">
          <Play className="mr-2 h-4 w-4" />
          {isStarting ? "Запускаем..." : `Запустить участников: ${readyParticipantSetups.length}`}
        </Button>
      );
    }
    return <Button type="button" className="dns-assessor-v2-primary" onClick={() => addParticipantSetup("blank")}>Следующий испытуемый</Button>;
  };

  const renderSidePanel = () => (
    <aside className="dns-assessor-v2-side">
      {activePanel === "sessions" ? (
        <>
          <section className="dns-assessor-v2-panel dns-assessor-v2-side-card">
            <h3>Новая настройка</h3>
            <p>Пока текущий участник проходит симуляцию, можно подготовить следующего без остановки live-сессий.</p>
            <div className="dns-assessor-v2-side-field">
              <span>Испытуемый</span>
              <strong>{participantName.trim() || "Новый сотрудник"}</strong>
            </div>
            <div className="dns-assessor-v2-side-field">
              <span>Сценарий</span>
              <strong>{scenarioName}</strong>
            </div>
            <div className="dns-assessor-v2-side-actions">
              <Button type="button" className="dns-assessor-v2-primary" onClick={() => addParticipantSetup("copy")}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Следующий с копией
              </Button>
              <button type="button" className="dns-assessor-v2-secondary" onClick={() => addParticipantSetup("blank")}>
                <Users className="h-4 w-4" />
                Пустая настройка
              </button>
            </div>
          </section>
          <section className="dns-assessor-v2-panel dns-assessor-v2-side-card">
            <h3>Длительность</h3>
            <div className="dns-assessor-v2-passport-grid">
              <div><strong>{estimatedTimeLimit}</strong><span>минут</span></div>
              <div><strong>{activeCaseCount}</strong><span>кейсов</span></div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="dns-assessor-v2-panel dns-assessor-v2-side-card">
            <h3>{visibleParticipantSetups.length > 1 && activePanel === "review" ? "Паспорт активного участника" : "Паспорт оценки"}</h3>
            <p>
              {visibleParticipantSetups.length > 1 && activePanel === "review"
                ? `${activeParticipantLabel}: параметры показаны отдельно от общей очереди запуска.`
                : "Итог настройки виден всегда."}
            </p>
            <div className="dns-assessor-v2-passport-grid">
              <div><strong>{estimatedTimeLimit}</strong><span>минут</span></div>
              <div><strong>{activeCaseCount}</strong><span>ситуаций</span></div>
              <div><strong>{enabledChannelLabels.length}</strong><span>канала</span></div>
              <div><strong>5</strong><span>компетенций</span></div>
            </div>
          </section>
          <section className="dns-assessor-v2-panel dns-assessor-v2-side-card">
            <h3>Влияние на оценку</h3>
            <div className="dns-assessor-v2-impact-list">
              <div><span>Коммуникация</span><strong className="dns-assessor-v2-blue">{enabledChannelLabels.length >= 3 ? "выше вес" : "базово"}</strong></div>
              <div><span>Планирование</span><strong className="dns-assessor-v2-ok">баланс</strong></div>
              <div><span>Риск перегруза</span><strong className="dns-assessor-v2-warn">{difficulty === "hard" ? "высокий" : "умеренный"}</strong></div>
            </div>
          </section>
          {startError && <div className="dns-assessor-v2-error">{startError}</div>}
          {renderBackAction()}
          {renderPrimaryAction()}
        </>
      )}
    </aside>
  );

  return (
    <div
      className={`dns-product-shell ${themeClass} relative overflow-auto`}
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="dns-theme-overlay absolute inset-0 bg-gradient-to-b from-[#0d1421ee] via-[#16213ef2] to-[#0d1421f7]" />

      <div className="dns-page-frame dns-assessor-v2-frame">
        <header className="dns-brand-header dns-assessor-v2-header">
          <div className="dns-brand-title">
            <div className="dns-brand-mark">D</div>
            <div>
              <div className="dns-brand-kicker">DNS SimCenter</div>
              <h1 className="dns-brand-heading">Меню оценщика</h1>
              <p className="dns-brand-subtitle">Пошаговая подготовка, проверка запуска и контроль live-сессий в одном рабочем центре.</p>
            </div>
          </div>
          <div className="dns-header-actions dns-assessor-v2-header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button type="button" onClick={() => { setShowWiki(false); setActivePanel("sessions"); }} className="dns-assessor-v2-header-button">
              <FileText className="h-4 w-4" />
              Сессии / результаты
            </button>
            <button type="button" onClick={() => setShowWiki(true)} className="dns-assessor-v2-header-button">
              <BookOpen className="h-4 w-4" />
              WIKI
            </button>
            <button
              onClick={() => navigate("/")}
              className="dns-assessor-v2-header-button"
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4" /> К ролям
            </button>
          </div>
        </header>

        {showWiki ? (
          <AssessorWiki
            onBack={() => setShowWiki(false)}
            processOpen={wikiProcessOpen}
            onToggleProcess={() => setWikiProcessOpen(prev => !prev)}
          />
        ) : (
          <div className="dns-assessor-v2-shell">
            {renderRail()}
            <main className="dns-assessor-v2-main">
              {renderMainPanel()}
            </main>
            {renderSidePanel()}
          </div>
        )}
      </div>
    </div>
  );
}
