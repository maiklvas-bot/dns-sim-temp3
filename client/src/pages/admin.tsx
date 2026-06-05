import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ThemeToggle, useDnsTheme } from "@/components/theme-toggle";
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
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, FileSpreadsheet, Info, Pause, Play, Trash2, X } from "lucide-react";
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

type TabKey = "cases" | "channels" | "schedule" | "results" | "comparison" | "settings";
type ChannelTab = "email" | "messenger" | "video";
type SystemSoundSettingKey = "callSoundAssetId" | "emailSoundAssetId" | "messengerSoundAssetId" | "videoSoundAssetId";
type ScheduleSourceType = "main_case" | "email" | "messenger" | "video";
const MAX_COMPARISON_ITEMS = 5;

const ADMIN_BRAND_ASSETS = {
  success: "/brand-admin/admin-mascot-success.png",
  assistant: "/brand-admin/admin-mascot-assistant.png",
  workstation: "/brand-admin/admin-device-workstation.png",
  control: "/brand-admin/admin-device-control.png",
  content: "/brand-admin/admin-mascot-content.png",
  supervisor: "/brand-admin/admin-mascot-supervisor.png",
  monitoring: "/brand-admin/admin-mascot-monitoring.png",
  greeting: "/brand-admin/admin-mascot-greeting.png",
  balance: "/brand-admin/admin-mascot-balance.png",
} as const;

type AdminVisualTone = "orange" | "teal" | "blue" | "purple" | "cyan" | "amber";

interface AdminVisualIdentity {
  label: string;
  title: string;
  subtitle: string;
  primarySrc: string;
  primaryAlt: string;
  primaryClassName: string;
  tone: AdminVisualTone;
}

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

const ADMIN_VISUALS: Record<TabKey, AdminVisualIdentity> = {
  cases: {
    label: "Кейсы",
    title: "Сценарный контент",
    subtitle: "Образ редактора держит фокус на сборке кейсов, развилок и компетенций.",
    primarySrc: ADMIN_BRAND_ASSETS.content,
    primaryAlt: "Фирменный персонаж-администратор для раздела кейсов",
    primaryClassName: "dns-admin-visual-primary--content",
    tone: "orange",
  },
  channels: {
    label: "Каналы",
    title: "Коммуникационные каналы",
    subtitle: "Помощник и приветственный персонаж подчеркивают живой поток сигналов.",
    primarySrc: ADMIN_BRAND_ASSETS.assistant,
    primaryAlt: "Фирменный помощник для коммуникационных каналов",
    primaryClassName: "dns-admin-visual-primary--assistant",
    tone: "teal",
  },
  schedule: {
    label: "Расписание",
    title: "Ритм симуляции",
    subtitle: "Спокойный образ балансирует таймлайн, а устройство управления отвечает за точность.",
    primarySrc: ADMIN_BRAND_ASSETS.balance,
    primaryAlt: "Фирменный персонаж для баланса расписания",
    primaryClassName: "dns-admin-visual-primary--balance",
    tone: "blue",
  },
  results: {
    label: "Результаты",
    title: "Аналитическая панель",
    subtitle: "Рабочая станция показывает, что отчеты и выгрузки остаются в центре внимания.",
    primarySrc: ADMIN_BRAND_ASSETS.workstation,
    primaryAlt: "Фирменная рабочая станция для аналитики результатов",
    primaryClassName: "dns-admin-visual-primary--workstation",
    tone: "purple",
  },
  comparison: {
    label: "Сравнение",
    title: "Сравнение прохождений",
    subtitle: "Мониторинговый образ помогает сопоставлять завершенные симуляции без смешивания с одиночными отчетами.",
    primarySrc: ADMIN_BRAND_ASSETS.monitoring,
    primaryAlt: "Фирменный персонаж для сравнения результатов симуляций",
    primaryClassName: "dns-admin-visual-primary--monitoring",
    tone: "cyan",
  },
  settings: {
    label: "Настройки",
    title: "Системные параметры",
    subtitle: "Сдержанный супервайзер и управляющее устройство визуально отделяют критичные настройки.",
    primarySrc: ADMIN_BRAND_ASSETS.supervisor,
    primaryAlt: "Фирменный супервайзер для системных настроек",
    primaryClassName: "dns-admin-visual-primary--supervisor",
    tone: "amber",
  },
};

interface ScheduleRow {
  rowId: string;
  sourceType: ScheduleSourceType;
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
  arrivalMinute: number | null;
  minIntervalSeconds: number | null;
  maxIntervalSeconds: number | null;
  decisionDeadlineSeconds: number | null;
  reminderIntervalSeconds: number | null;
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

const CASE_AUTHORING_WIKI = [
  {
    title: "Как метрики ответа влияют на карту магазина",
    items: [
      "Торг. зал / поток меняет нагрузку в зале и количество покупателей, которых нужно удержать в сервисе.",
      "Торг. зал / конверсия показывает, сколько клиентов дошли до покупки. Например, -5 значит: решение ухудшило продажи в зале.",
      "Команда / мораль влияет на состояние смены. Например, +5 означает, что руководитель снял напряжение и люди понимают роли.",
      "Финансы / выручка отражает прямой денежный эффект. Например, -5 фиксирует потерю продаж из-за плохого сервиса.",
      "Выдача / скорость влияет на очередь и срок получения товара. Плюс ускоряет выдачу, минус делает ожидание дольше.",
    ],
  },
  {
    title: "Как составлять кейс",
    items: [
      "Опишите одну управленческую проблему без лишних сюжетов: кто обратился, что случилось, что нужно решить сейчас.",
      "Дайте 3-5 вариантов ответа: слабый, частично рабочий, нормальный, сильный и при необходимости экспертный.",
      "Для каждого варианта отдельно задайте эффект на магазин и влияние на компетенции. Это две разные настройки.",
      "Первичные компетенции показывают главный фокус кейса, вторичные - дополнительную область оценки.",
      "Вес кейса меняет вклад кейса в общий сценарий, но не должен переписывать сам профиль компетенций кейса.",
    ],
  },
] as const;

const ADMIN_WIKI_CONTENT: Record<TabKey, {
  title: string;
  purpose: string;
  steps: string[];
  fields: string[];
  example: string;
  mistakes: string[];
  checklist: string[];
}> = {
  cases: {
    title: "Wiki: кейсы, ответы и циклы",
    purpose: "Раздел собирает управленческий сценарий: стартовый сигнал, варианты ответа, переходы к циклам, медиа, тайминги и влияние на оценку.",
    steps: [
      "Выберите существующий кейс или нажмите «Новый».",
      "Заполните карточку кейса: название, описание, источник, тип сигнала и зоны магазина.",
      "Откройте «Циклы и медиа»: цикл 1 обычно является стартовым событием, последующие циклы — развитием ситуации.",
      "В каждом цикле настройте варианты ответа и укажите, какой цикл запускается после выбранного ответа.",
      "Добавьте медиа на уровне кейса по умолчанию или отдельно для нужного цикла.",
      "Сохраните кейс и проверьте предпросмотр/влияние справа.",
    ],
    fields: [
      "Основные компетенции — главный фокус оценки кейса.",
      "Вторичные компетенции — дополнительное наблюдение, не заменяющее основной фокус.",
      "Статус ответа «Активен» показывает вариант студенту, «Скрыт» и «Черновик» не участвуют в симуляции.",
      "«После ответа запустить» связывает конкретный ответ с конкретным циклом.",
      "Метрики магазина меняют операционную карту, а компетенции формируют итоговый профиль участника.",
    ],
    example: "Ответ «Провести планёрку» может дать +5 к коммуникации и запустить цикл с проверкой склада через 30 секунд. Ответ «Разберитесь сами» может ухудшить мораль и завершить кейс.",
    mistakes: [
      "Ответ создан, но оставлен в статусе «Черновик». Студент его не увидит.",
      "Цикл заполнен, но ни один ответ на него не ссылается.",
      "Вариант ответа влияет только на магазин, но не имеет компетенций: в итоговом профиле он почти не объясняется.",
      "Слишком длинный текст сигнала без конкретного управленческого выбора.",
    ],
    checklist: [
      "У кейса есть название, описание, источник и стартовый сигнал.",
      "В первом цикле есть минимум 3-5 активных ответов.",
      "Каждый важный ответ ведёт к циклу или явно завершает кейс.",
      "Медиа выбраны там, где они должны заменить fallback кейса.",
      "Влияние на магазин и компетенции заполнено отдельно.",
    ],
  },
  channels: {
    title: "Wiki: каналы коммуникации",
    purpose: "Каналы добавляют параллельную нагрузку: почта, мессенджер и видеообращения приходят по расписанию и проверяют реакцию участника вне основного кейса.",
    steps: [
      "Выберите тип канала: почта, мессенджер или видео.",
      "Создайте сигнал и заполните отправителя, текст, время прихода и варианты ответа.",
      "Для мессенджера сначала настройте чат, затем привяжите к нему сообщения.",
      "Укажите срок решения и интервал напоминаний.",
      "Проверьте влияние вариантов на метрики и компетенции.",
    ],
    fields: [
      "Минута прихода — когда сигнал появится в симуляции.",
      "Срок решения — когда задача станет просроченной.",
      "Первичная компетенция помогает отнести канал к нужному профилю оценки.",
      "Аудио и изображение усиливают сигнал, но не меняют его механику.",
    ],
    example: "Письмо клиента на 15-й минуте с дедлайном 5 минут проверяет коммуникацию и ответственность, а мессенджер от склада может проверить делегирование.",
    mistakes: [
      "Не выбран чат для сообщения мессенджера.",
      "Минута прихода совпадает у слишком большого числа сигналов.",
      "Варианты ответа есть, но все с нулевыми компетенциями.",
    ],
    checklist: [
      "У каждого сигнала есть отправитель и текст.",
      "Настроены arrivalMinute, deadline и reminder.",
      "Все варианты ответа активны и читаемы.",
      "Канал выбран оценщиком при запуске сессии.",
    ],
  },
  schedule: {
    title: "Wiki: расписание событий",
    purpose: "Расписание управляет порядком и временем поступления кейсов и сигналов, чтобы нагрузка была предсказуемой и тестируемой.",
    steps: [
      "Проверьте общий список событий.",
      "Переместите событие выше или ниже.",
      "После ручной перестановки система предложит новое время прихода.",
      "При необходимости скорректируйте минуту, deadline и напоминания вручную.",
      "Сохраните расписание и проверьте тестовый запуск.",
    ],
    fields: [
      "Порядок отвечает за последовательность.",
      "Минута прихода отвечает за фактическое время в симуляции.",
      "Deadline задаёт критический таймер.",
      "Reminder определяет повторное напоминание.",
    ],
    example: "Основной кейс можно поставить первым, письмо клиента — на 15-й минуте, мессенджер склада — на 22-й минуте, видео руководителя — ближе к финалу.",
    mistakes: [
      "Все события приходят в одну минуту и перегружают участника.",
      "Deadline пустой, поэтому критический таймер не появляется.",
      "Порядок изменён, но расписание не сохранено.",
    ],
    checklist: [
      "У каждого события есть понятное время прихода.",
      "Нагрузка распределена по всей симуляции.",
      "Критичные сигналы имеют deadline.",
      "После сохранения список не сбрасывается.",
    ],
  },
  results: {
    title: "Wiki: результаты",
    purpose: "Раздел хранит прохождения, отчёты, PDF/XLSX-выгрузки и удаление тестовых или ошибочных результатов.",
    steps: [
      "Выберите участника в списке результатов.",
      "Проверьте статус, итоговый балл, ответы и профиль компетенций.",
      "Скачайте PDF для передачи руководителю или HR.",
      "Удаляйте только тестовые и ошибочные результаты.",
    ],
    fields: [
      "НАДО — ожидаемый профиль по текущей настройке симуляции.",
      "ФАКТ — фактический результат участника.",
      "Ответы показывают, где именно сформировался балл.",
    ],
    example: "Если участник получил низкую коммуникацию, откройте ответы и найдите, какие письма, сообщения или циклы кейса дали слабые оценки.",
    mistakes: [
      "Удаление результата необратимо.",
      "Нельзя сравнивать тестовый запуск с рабочим без пометки.",
    ],
    checklist: [
      "Выбран правильный участник.",
      "PDF открывается и содержит читаемые данные.",
      "Перед удалением понятно, что результат лишний.",
    ],
  },
  comparison: {
    title: "Wiki: сравнение",
    purpose: "Сравнение помогает сопоставить несколько участников по общему баллу и компетенциям, чтобы увидеть группу, лидеров и зоны риска.",
    steps: [
      "Выберите до пяти завершённых прохождений.",
      "Сравните общий балл и компетенции.",
      "Откройте сильные и слабые зоны каждого участника.",
      "Сформулируйте вопросы руководителю и план развития.",
    ],
    fields: [
      "Лучшее значение подсвечивает лидера по компетенции.",
      "Групповая средняя помогает увидеть отклонение участника.",
      "Инсайты переводят цифры в управленческий вывод.",
    ],
    example: "У одного участника сильное планирование, но слабая ответственность; у другого наоборот. Это помогает распределить наставничество.",
    mistakes: [
      "Сравниваются прохождения разной сложности без учёта контекста.",
      "Выбраны незавершённые или тестовые сессии.",
    ],
    checklist: [
      "Выбраны сопоставимые сессии.",
      "Проверены сильные и слабые компетенции.",
      "Сделан вывод для обучения или отбора.",
    ],
  },
  settings: {
    title: "Wiki: настройки симуляции",
    purpose: "Настройки задают системную механику: интервалы, длительность, звуки, стартовые инструкции, веса кейсов и общий режим оценки.",
    steps: [
      "Проверьте интервалы первого сигнала и последующих событий.",
      "Настройте количество кейсов по сложности.",
      "Задайте медиа и звуки по умолчанию.",
      "Настройте веса кейсов без изменения их внутреннего профиля.",
      "Сохраните настройки и сделайте тестовый запуск.",
    ],
    fields: [
      "Вес кейса меняет вклад кейса в общий сценарий, но не переписывает компетенции внутри кейса.",
      "Time influence включает влияние сроков и просрочек.",
      "Звуки каналов помогают участнику различать типы событий.",
    ],
    example: "Для сложного режима можно увеличить количество кейсов, но оставить профиль компетенций статичным, чтобы сравнение участников было честным.",
    mistakes: [
      "Сильно увеличены кейсы, но не увеличена длительность.",
      "Весами пытаются исправить неправильные компетенции внутри ответов.",
      "Не сохранены настройки после изменения.",
    ],
    checklist: [
      "Длительность соответствует количеству кейсов.",
      "Веса проверены на вкладке влияния.",
      "Звуки и инструкции открываются.",
      "После сохранения настройки остались на месте.",
    ],
  },
};

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

function AdminWikiDialog({
  open,
  onOpenChange,
  tab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: TabKey;
}) {
  const wiki = ADMIN_WIKI_CONTENT[tab];
  const sections = [
    { title: "Пошаговая инструкция", items: wiki.steps },
    { title: "Описание полей", items: wiki.fields },
    { title: "Частые ошибки", items: wiki.mistakes },
    { title: "Чек-лист перед запуском", items: wiki.checklist },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto border-[#2a3a4e] bg-[#101826] text-white custom-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="h-5 w-5 text-[#FF6B00]" />
            {wiki.title}
          </DialogTitle>
          <DialogDescription className="text-[#9fb0ca]">
            {wiki.purpose}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="rounded-xl border border-[#243244] bg-[#141c2b]/70 p-4">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8ec5ff]">{section.title}</div>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#d5e2f4]">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#FF6B00]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#FF6B00]/35 bg-[#FF6B00]/10 p-4 text-sm leading-relaxed text-[#ffe1cb]">
          <div className="mb-1 font-semibold text-[#ffb27a]">Пример настройки</div>
          {wiki.example}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminVisualPanel({ visual }: { visual: AdminVisualIdentity }) {
  return (
    <section className={`dns-admin-visual-panel dns-admin-visual-panel--${visual.tone}`} aria-label={visual.title}>
      <div className="dns-admin-visual-copy">
        <div className="dns-admin-visual-kicker">Фирменный контекст</div>
        <h2 className="dns-admin-visual-title">{visual.title}</h2>
        <p className="dns-admin-visual-subtitle">{visual.subtitle}</p>
      </div>
      <div className="dns-admin-visual-stage">
        <img
          src={visual.primarySrc}
          alt={visual.primaryAlt}
          className={`dns-admin-visual-image dns-admin-visual-primary ${visual.primaryClassName}`}
        />
      </div>
    </section>
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

function readDraftFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    if (
      fallback &&
      typeof fallback === "object" &&
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(fallback) &&
      !Array.isArray(parsed)
    ) {
      return { ...fallback, ...parsed };
    }

    return parsed as T;
  } catch {
    return fallback;
  }
}

function writeDraftToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Локальный черновик вспомогательный: ошибка localStorage не должна блокировать админку.
  }
}

function clearDraftFromStorage(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // См. комментарий выше: очистка черновика не критична для runtime.
  }
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
      situation: "",
      signal: { type: "message", content: "" },
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

function getScheduleSourceLabel(sourceType: ScheduleSourceType) {
  switch (sourceType) {
    case "main_case":
      return "Кейс";
    case "email":
      return "Почта";
    case "messenger":
      return "Мессенджер";
    case "video":
      return "Видео";
  }
}

function buildScheduleRows(content: any): ScheduleRow[] {
  const cases = ((content?.cases || []) as SimCase[]).map((item) => ({
    rowId: `main_case:${item.id}`,
    sourceType: "main_case" as const,
    id: item.id,
    title: item.title || item.id,
    subtitle: item.trigger?.source || "Основной кейс",
    sortOrder: item.sortOrder ?? 0,
    arrivalMinute: item.timing?.arrivalMinute ?? null,
    minIntervalSeconds: item.timing?.minIntervalSeconds ?? 45,
    maxIntervalSeconds: item.timing?.maxIntervalSeconds ?? 90,
    decisionDeadlineSeconds: item.timing?.decisionDeadlineSeconds ?? 180,
    reminderIntervalSeconds: item.timing?.reminderIntervalSeconds ?? 180,
  }));

  const emails = ((content?.emailCases || []) as EmailCase[]).map((item) => ({
    rowId: `email:${item.id}`,
    sourceType: "email" as const,
    id: item.id,
    title: item.subject || item.id,
    subtitle: item.from || item.department || "Почта",
    sortOrder: item.sortOrder ?? 0,
    arrivalMinute: item.timing?.arrivalMinute ?? item.arrivalMinute ?? null,
    minIntervalSeconds: null,
    maxIntervalSeconds: null,
    decisionDeadlineSeconds: item.timing?.decisionDeadlineSeconds ?? 300,
    reminderIntervalSeconds: item.timing?.reminderIntervalSeconds ?? 180,
  }));

  const messages = ((content?.messengerCases || []) as MessengerCase[]).map((item) => ({
    rowId: `messenger:${item.id}`,
    sourceType: "messenger" as const,
    id: item.id,
    title: item.senderName || item.id,
    subtitle: item.senderRole || "Мессенджер",
    sortOrder: item.sortOrder ?? 0,
    arrivalMinute: item.timing?.arrivalMinute ?? item.arrivalMinute ?? null,
    minIntervalSeconds: null,
    maxIntervalSeconds: null,
    decisionDeadlineSeconds: item.timing?.decisionDeadlineSeconds ?? 180,
    reminderIntervalSeconds: item.timing?.reminderIntervalSeconds ?? 5,
  }));

  const videos = ((content?.videoCases || []) as VideoCase[]).map((item) => ({
    rowId: `video:${item.id}`,
    sourceType: "video" as const,
    id: item.id,
    title: item.title || item.id,
    subtitle: item.sender || "Видео",
    sortOrder: item.sortOrder ?? 0,
    arrivalMinute: item.timing?.arrivalMinute ?? item.arrivalMinute ?? null,
    minIntervalSeconds: null,
    maxIntervalSeconds: null,
    decisionDeadlineSeconds: item.timing?.decisionDeadlineSeconds ?? 240,
    reminderIntervalSeconds: item.timing?.reminderIntervalSeconds ?? 180,
  }));

  return [...cases, ...emails, ...messages, ...videos].sort((left, right) => {
    const leftArrival = left.arrivalMinute ?? left.sortOrder * 10;
    const rightArrival = right.arrivalMinute ?? right.sortOrder * 10;
    if (leftArrival !== rightArrival) {
      return leftArrival - rightArrival;
    }
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.rowId.localeCompare(right.rowId);
  });
}

function autoAssignScheduleTimes(rows: ScheduleRow[]) {
  const stepMinutes = Math.max(5, Math.floor(600 / Math.max(1, rows.length + 1)));
  return rows.map((row, index) => ({
    ...row,
    sortOrder: index + 1,
    arrivalMinute: Math.min(650, 10 + index * stepMinutes),
  }));
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { theme, themeClass, toggleTheme } = useDnsTheme();
  const [tab, setTab] = useState<TabKey>("cases");
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
      const response = await apiRequest("GET", `/api/staff/results${suffix}`);
      return response.json();
    },
    enabled: !!staffQuery.data,
  });
  const resultDetailQuery = useQuery({
    queryKey: ["/api/staff/results/detail", selectedResultId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/staff/results/${selectedResultId}`);
      return response.json();
    },
    enabled: !!staffQuery.data && selectedResultId != null,
  });
  const comparisonDetailQueries = useQueries({
    queries: comparisonSelection.map((id) => ({
      queryKey: ["/api/staff/results/detail", id],
      queryFn: async () => {
        const response = await apiRequest("GET", `/api/staff/results/${id}`);
        return response.json();
      },
      enabled: !!staffQuery.data && tab === "comparison",
    })),
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

  const invalidateRuntimeContent = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/staff/content"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/simulation-content"] });
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
      className={`dns-product-shell ${themeClass} relative`}
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="dns-theme-overlay absolute inset-0 bg-gradient-to-b from-[#0d1421ef] via-[#16213ef5] to-[#0d1421f7]" />
      <div className="dns-page-frame max-w-[1560px]">
        <header className="dns-brand-header dns-admin-header-surface">
          <div className="dns-brand-title">
            <div className="dns-brand-mark">D</div>
            <div>
              <div className="dns-brand-kicker">DNS SimCenter</div>
              <h1 className="dns-brand-heading">Администрирование симуляции</h1>
              <p className="dns-brand-subtitle">Контент, каналы, тайминги, результаты и параметры хода симуляции.</p>
            </div>
          </div>
          <div className="dns-header-actions dns-admin-header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
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

        <div className="dns-admin-tab-menu mb-4 flex flex-wrap items-center justify-center gap-2 overflow-x-auto pb-1">
          {(["cases", "channels", "schedule", "results", "comparison", "settings"] as TabKey[]).map((item) => {
            const itemVisual = ADMIN_VISUALS[item];

            return (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`dns-tab-button dns-admin-tab-button whitespace-nowrap px-3 py-2 text-sm ${tab === item ? "dns-tab-button-active" : ""}`}
              >
                <span className="dns-admin-tab-art" aria-hidden="true">
                  <img src={itemVisual.primarySrc} alt="" className={itemVisual.primaryClassName} />
                </span>
                <span>{itemVisual.label}</span>
              </button>
            );
          })}
        </div>

        {error && <div className="mb-4 rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/10 px-4 py-3 text-sm text-[#ff9999]">{error}</div>}

        <AdminWikiDialog open={adminWikiOpen} onOpenChange={setAdminWikiOpen} tab={tab} />

        <AdminVisualPanel visual={activeAdminVisual} />

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
                    <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
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

        {tab !== "results" && tab !== "schedule" && tab !== "comparison" && (
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
  selectedCycleIndex,
  onSelectedCycleIndexChange,
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
  selectedCycleIndex?: number;
  onSelectedCycleIndexChange?: (index: number) => void;
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
  const [caseEditorSection, setCaseEditorSection] = useState<"details" | "cycles">("details");

  useEffect(() => {
    if (mode === "case" && typeof selectedCycleIndex === "number") {
      setCaseEditorSection("cycles");
    }
  }, [entity.id, mode, selectedCycleIndex]);

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
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
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
        <div className="flex flex-wrap gap-2 rounded-xl border border-[#243244] bg-[#101826]/60 p-2">
          {([
            ["details", "Карточка кейса"],
            ["cycles", "Циклы и медиа"],
          ] as const).map(([section, label]) => (
            <button
              key={section}
              type="button"
              onClick={() => setCaseEditorSection(section)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                caseEditorSection === section
                  ? "border-[#FF6B00] bg-[#FF6B00]/15 text-white"
                  : "border-[#2a3a4e] bg-[#0d1522]/70 text-[#9aabc6] hover:border-[#3b5878]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === "case" && (
        <>
          {caseEditorSection === "details" && (
            <>
              <CaseMediaPanel
                title="Медиа кейса по умолчанию"
                helper="Эти файлы используются как fallback, если у конкретного цикла не выбраны свои изображение или озвучка."
                target={entity}
                assets={assets}
                onChange={(patch) => update(patch)}
                onUploadAsset={onUploadAsset}
                onTogglePreviewAudio={onTogglePreviewAudio}
                activePreviewKey={activePreviewKey}
                previewKey={`case-default:${entity.id}`}
              />
              <Field label="Название" value={entity.title} onChange={(value) => update({ title: value })} />
              <FieldArea label="Описание" value={entity.description} onChange={(value) => update({ description: value })} />
              <div className="grid gap-4 md:grid-cols-3">
                <SuggestField label="Источник сигнала" value={entity.trigger.source} onChange={(value) => update({ trigger: { ...entity.trigger, source: value } })} options={caseSourceOptions} />
                <SelectField label="Тип сигнала" value={entity.trigger.type} onChange={(value) => update({ trigger: { ...entity.trigger, type: value } })} options={[...CASE_SIGNAL_TYPE_OPTIONS]} />
                <MultiSelectField label="Зоны магазина" values={entity.zones_affected || []} onChange={(values) => update({ zones_affected: values })} options={[...STORE_ZONE_OPTIONS]} />
              </div>
              <FieldArea label="Текст сигнала" value={entity.trigger.text} onChange={(value) => update({ trigger: { ...entity.trigger, text: value } })} />
              <CompetencyRoleSelector
                primaryValues={entity.primaryCompetencies || []}
                secondaryValues={entity.secondaryCompetencies || []}
                onChange={(next) => update(next)}
                competencies={competencies}
              />
            </>
          )}
          {caseEditorSection === "cycles" && (
            <StructuredCyclesEditor
              cycles={entity.cycles || []}
              competencies={competencies}
              assets={assets}
              onUploadAsset={onUploadAsset}
              onTogglePreviewAudio={onTogglePreviewAudio}
              activePreviewKey={activePreviewKey}
              selectedCycleIndex={selectedCycleIndex}
              onSelectedCycleIndexChange={onSelectedCycleIndexChange}
              onChange={(cycles) => update({ cycles })}
            />
          )}
        </>
      )}
      {mode === "email" && (
        <>
          <Field label="Тема" value={entity.subject} onChange={(value) => update({ subject: value })} />
          <SuggestField label="Отправитель" value={entity.from} onChange={(value) => update({ from: value })} options={emailSenderOptions} />
          <div className="grid gap-4 md:grid-cols-2">
            <SuggestField label="Подразделение" value={entity.department} onChange={(value) => update({ department: value })} options={emailDepartmentOptions} />
            <Field label="Цвет отдела" value={entity.departmentColor} onChange={(value) => update({ departmentColor: value })} />
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
          <div className="grid gap-4 md:grid-cols-3">
            <SuggestField label="Отправитель" value={entity.senderName} onChange={(value) => update({ senderName: value })} options={messengerSenderOptions} />
            <SuggestField label="Роль" value={entity.senderRole} onChange={(value) => update({ senderRole: value })} options={messengerRoleOptions} />
            <Field label="Аватар" value={entity.senderAvatar} onChange={(value) => update({ senderAvatar: value })} />
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
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Длительность" value={entity.duration} onChange={(value) => update({ duration: value })} />
            <SelectField
              label="Компетенция"
              value={entity.primaryCompetency}
              onChange={(value) => update({ primaryCompetency: value })}
              options={competencyOptions}
            />
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

      {mode === "case" ? null : mode === "video" ? (
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
    comment: "",
    nextCycleId: "",
    nextDelaySeconds: null,
    nextChannel: "main_case",
    status: "active",
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
  onConfirm: () => void | Promise<void>;
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
                <CompetencyRoleSelector
                  primaryValues={draft.primaryCompetencies || []}
                  secondaryValues={draft.secondaryCompetencies || []}
                  onChange={(next) => setDraft(next)}
                  competencies={competencies}
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
                Создать и сохранить
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
  onConfirm: () => void | Promise<void>;
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
                Создать и сохранить
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
  cycleOptions = [],
  currentCycleId,
}: {
  title: string;
  options: any[];
  onChange: (options: any[]) => void;
  competencies: CompetencyDefinition[];
  cycleOptions?: Array<{ value: string; label: string }>;
  currentCycleId?: string;
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
    <div className="dns-admin-options-card rounded-xl border border-[#2a3a4e] bg-[#141c2b]/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-[11px] text-[#8890a8]">Каждый вариант ответа заполняется отдельными полями без JSON.</div>
        </div>
        <Button type="button" size="sm" className="shrink-0 whitespace-nowrap" onClick={addOption}>Добавить вариант</Button>
      </div>
      <div className="space-y-3">
        {(options || []).map((option, index) => (
          <div key={`${option.id || "option"}-${index}`} className="dns-admin-option-card rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
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
            <div className="dns-admin-option-routing-grid">
              <SelectField
                label="Статус ответа"
                value={option.status || "active"}
                onChange={(value) => updateOption(index, { status: value || "active" })}
                options={[
                  { value: "active", label: "Активен" },
                  { value: "hidden", label: "Скрыт" },
                  { value: "draft", label: "Черновик" },
                ]}
              />
              {cycleOptions.length > 0 && (
                <SelectField
                  label="После ответа запустить"
                  value={option.nextCycleId || ""}
                  onChange={(value) => updateOption(index, { nextCycleId: value || "" })}
                  emptyLabel="Следующий цикл по порядку"
                  options={[
                    ...cycleOptions.filter((cycle) => cycle.value !== currentCycleId),
                    { value: "__complete", label: "Завершить кейс" },
                  ]}
                />
              )}
              <Field
                label="Задержка, сек"
                value={option.nextDelaySeconds ?? ""}
                onChange={(value) => updateOption(index, { nextDelaySeconds: value ? Number(value) : null })}
              />
              <SelectField
                label="Канал следующего события"
                value={option.nextChannel || "main_case"}
                onChange={(value) => updateOption(index, { nextChannel: value || "main_case" })}
                options={[
                  { value: "main_case", label: "Основной кейс" },
                  { value: "email", label: "Почта" },
                  { value: "messenger", label: "Мессенджер" },
                  { value: "video", label: "Видео" },
                ]}
              />
            </div>
            <FieldArea
              label="Комментарий / пояснение для администратора"
              value={option.comment || ""}
              onChange={(value) => updateOption(index, { comment: value })}
            />
            <div className="dns-admin-store-effects-grid">
              {STORE_EFFECT_FIELDS.map((field) => (
                <div key={field.key}>
                  <Field
                    label={field.label}
                    value={option.effects?.[field.key] ?? 0}
                    onChange={(value) => updateEffects(index, field.key, Number(value))}
                  />
                  <div className="mt-1 text-[10px] leading-relaxed text-[#71839d]">{field.metric}</div>
                </div>
              ))}
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

function CaseMediaPanel({
  title,
  helper,
  target,
  assets,
  onChange,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  previewKey,
}: {
  title: string;
  helper: string;
  target: { imageAssetId?: string | null; imageUrl?: string | null; audioAssetId?: string | null; audioUrl?: string | null };
  assets: any[];
  onChange: (patch: Record<string, any>) => void;
  onUploadAsset: (file: File) => Promise<string | null>;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
  previewKey: string;
}) {
  const imageAssets = assets.filter((asset) => asset.kind === "image");
  const audioAssets = assets.filter((asset) => asset.kind === "audio");
  const selectedImage = imageAssets.find((asset) => asset.id === target.imageAssetId);
  const selectedAudio = audioAssets.find((asset) => asset.id === target.audioAssetId);
  const audioUrl = selectedAudio?.publicUrl || target.audioUrl || null;
  const isPreviewActive = activePreviewKey === previewKey;
  const imageInputId = useId();
  const audioInputId = useId();

  return (
    <div className="dns-admin-media-panel rounded-2xl border border-[#4a9eff]/25 bg-[#122031]/80 p-4 shadow-[0_18px_45px_rgba(74,158,255,0.08)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Медиа</div>
          <div className="mt-1 text-base font-bold text-white">{title}</div>
          <div className="mt-1 max-w-2xl text-xs leading-relaxed text-[#b8c7df]">{helper}</div>
        </div>
        {(target.imageAssetId || target.audioAssetId) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-[#2a3a4e] bg-transparent text-[#cbd8ef]"
            onClick={() => onChange({ imageAssetId: null, imageUrl: null, audioAssetId: null, audioUrl: null })}
          >
            Очистить медиа
          </Button>
        )}
      </div>

      <div className="dns-admin-media-grid">
        <div className="dns-admin-media-card rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6fa0ff]">Изображение</div>
          <div className="dns-admin-media-picker">
            <select
              value={target.imageAssetId || ""}
              onChange={(e) => onChange({ imageAssetId: e.target.value || null })}
              className="dns-admin-select min-w-0 rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
            >
              <option value="">Без изображения</option>
              {imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <input
              id={imageInputId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const assetId = await onUploadAsset(file);
                if (assetId) onChange({ imageAssetId: assetId });
              }}
            />
            <label className="dns-admin-upload-button" htmlFor={imageInputId}>
              Выбрать файл
            </label>
          </div>
          <div className="mt-2 min-h-[1rem] truncate text-[11px] text-[#9fb0ca]">
            {selectedImage?.name || (target.imageUrl ? "Внешнее изображение" : "Файл не выбран")}
          </div>
          {(selectedImage?.publicUrl || target.imageUrl) && (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#2a3a4e]">
              <img
                src={selectedImage?.publicUrl || target.imageUrl || ""}
                alt={selectedImage?.name || "Изображение"}
                className="h-28 w-full object-cover"
              />
            </div>
          )}
        </div>

        <div className="dns-admin-media-card rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6fa0ff]">Озвучка</div>
          <div className="dns-admin-media-picker">
            <select
              value={target.audioAssetId || ""}
              onChange={(e) => onChange({ audioAssetId: e.target.value || null })}
              className="dns-admin-select min-w-0 rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
            >
              <option value="">Без отдельной озвучки</option>
              {audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <input
              id={audioInputId}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/x-m4a,audio/aac"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const assetId = await onUploadAsset(file);
                if (assetId) onChange({ audioAssetId: assetId });
              }}
            />
            <label className="dns-admin-upload-button" htmlFor={audioInputId}>
              Выбрать файл
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[#00d4aa] text-[#0d1117] hover:bg-[#00c39c]"
              onClick={() => onTogglePreviewAudio(previewKey, audioUrl)}
              disabled={!audioUrl}
            >
              <Play className="mr-2 h-4 w-4" />
              {isPreviewActive ? "Стоп" : "Плей"}
            </Button>
            <span className="min-w-0 truncate text-[11px] text-[#8aa2c4]">
              {selectedAudio?.name || (audioUrl ? "Связанный аудиофайл" : "Аудио не выбрано")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StructuredCyclesEditor({
  cycles,
  onChange,
  competencies,
  assets,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  selectedCycleIndex: controlledSelectedCycleIndex,
  onSelectedCycleIndexChange,
}: {
  cycles: any[];
  onChange: (cycles: any[]) => void;
  competencies: CompetencyDefinition[];
  assets: any[];
  onUploadAsset: (file: File) => Promise<string | null>;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
  selectedCycleIndex?: number;
  onSelectedCycleIndexChange?: (index: number) => void;
}) {
  const [internalSelectedCycleIndex, setInternalSelectedCycleIndex] = useState(0);
  const normalizedCycles = cycles || [];
  const selectedCycleIndex = controlledSelectedCycleIndex ?? internalSelectedCycleIndex;
  const setSelectedCycleIndex = (index: number) => {
    setInternalSelectedCycleIndex(index);
    onSelectedCycleIndexChange?.(index);
  };
  const selectedCycle = normalizedCycles[Math.min(selectedCycleIndex, Math.max(0, normalizedCycles.length - 1))] || null;

  useEffect(() => {
    if (selectedCycleIndex > Math.max(0, normalizedCycles.length - 1)) {
      setSelectedCycleIndex(Math.max(0, normalizedCycles.length - 1));
    }
  }, [normalizedCycles.length, selectedCycleIndex]);

  const updateCycle = (index: number, patch: Record<string, any>) => {
    onChange(cycles.map((cycle, cycleIndex) => cycleIndex === index ? { ...cycle, ...patch } : cycle));
  };

  const addCycle = () => {
    onChange([
      ...(cycles || []),
      {
        id: `draft-cycle-${Date.now()}`,
        cycle: (cycles?.length || 0) + 1,
        situation: "",
        signal: { type: "message", content: "" },
        options: [createEmptyStructuredOption(1)],
        imageAssetId: null,
        imageUrl: null,
        audioAssetId: null,
        audioUrl: null,
      },
    ]);
    setSelectedCycleIndex(cycles?.length || 0);
  };

  const removeCycle = (index: number) => {
    if ((cycles || []).length <= 1) {
      return;
    }
    onChange(cycles.filter((_, cycleIndex) => cycleIndex !== index).map((cycle, cycleIndex) => ({ ...cycle, cycle: cycleIndex + 1 })));
    setSelectedCycleIndex(Math.max(0, index - 1));
  };

  return (
    <div className="dns-admin-cycles-panel rounded-xl border border-[#2a3a4e] bg-[#141c2b]/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Циклы кейса</div>
          <div className="mt-1 text-[11px] text-[#8890a8]">Каждый цикл, сигнал и варианты ответа редактируются отдельными полями.</div>
        </div>
        <Button type="button" size="sm" className="shrink-0 whitespace-nowrap" onClick={addCycle}>Добавить цикл</Button>
      </div>

      <div className="dns-admin-cycles-grid">
        <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8ec5ff]">Циклы выбранного кейса</div>
          <div className="space-y-2">
            {normalizedCycles.map((cycle, index) => (
              <button
                key={`${cycle.id || "cycle"}-${index}`}
                type="button"
                onClick={() => setSelectedCycleIndex(index)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  index === selectedCycleIndex
                    ? "border-[#FF6B00] bg-[#FF6B00]/12"
                    : "border-[#2a3a4e] bg-[#0d1522]/75 hover:border-[#3b5878]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">Цикл {index + 1}</span>
                  <span className="rounded-full border border-[#2a3a4e] bg-[#101826] px-2 py-0.5 text-[10px] text-[#8aa2c4]">
                    {(cycle.options || []).length} отв.
                  </span>
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#8aa2c4]">
                  {cycle.situation || cycle.signal?.content || "Пустой цикл"}
                </div>
              </button>
            ))}
          </div>
          <Button type="button" size="sm" className="mt-3 w-full" onClick={addCycle}>
            Добавить цикл
          </Button>
        </div>

        {selectedCycle && (
          <div className="dns-admin-cycle-detail rounded-xl border border-[#243244] bg-[#101826]/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Цикл {selectedCycleIndex + 1}</div>
                <div className="mt-1 text-[11px] text-[#8890a8]">Ситуация, сигнал, медиа и варианты ответа для текущего цикла.</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[#ff4444]/30 bg-transparent text-[#ff9999]"
                onClick={() => removeCycle(selectedCycleIndex)}
                disabled={normalizedCycles.length <= 1}
              >
                Удалить цикл
              </Button>
            </div>

            <CaseMediaPanel
              title="Медиа выбранного цикла"
              helper="Если здесь выбрать файлы, в симуляции для этого цикла они заменят медиа кейса по умолчанию."
              target={selectedCycle}
              assets={assets}
              onChange={(patch) => updateCycle(selectedCycleIndex, patch)}
              onUploadAsset={onUploadAsset}
              onTogglePreviewAudio={onTogglePreviewAudio}
              activePreviewKey={activePreviewKey}
              previewKey={`case-cycle:${selectedCycle.id || selectedCycleIndex}`}
            />

            <FieldArea label="Ситуация" value={selectedCycle.situation} onChange={(value) => updateCycle(selectedCycleIndex, { situation: value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Тип сигнала" value={selectedCycle.signal?.type} onChange={(value) => updateCycle(selectedCycleIndex, { signal: { ...(selectedCycle.signal || {}), type: value } })} options={[...CASE_SIGNAL_TYPE_OPTIONS]} />
              <FieldArea label="Текст сигнала" value={selectedCycle.signal?.content} onChange={(value) => updateCycle(selectedCycleIndex, { signal: { ...(selectedCycle.signal || {}), content: value } })} />
            </div>
            <StructuredOptionsEditor
              title="Варианты ответа для цикла"
              options={selectedCycle.options || []}
              competencies={competencies}
              cycleOptions={normalizedCycles.map((cycle, index) => ({
                value: cycle.id || `cycle-${index + 1}`,
                label: `Цикл ${index + 1}: ${(cycle.situation || cycle.signal?.content || "без описания").slice(0, 48)}`,
              }))}
              currentCycleId={selectedCycle.id || `cycle-${selectedCycleIndex + 1}`}
              onChange={(options) => updateCycle(selectedCycleIndex, { options })}
            />
          </div>
        )}
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
        className="dns-admin-select w-full rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
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
        className="dns-admin-input bg-[#141c2b] border-[#2a3a4e] text-white"
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

function CompetencyRoleSelector({
  label = "Компетенции кейса",
  primaryValues,
  secondaryValues,
  onChange,
  competencies,
}: {
  label?: string;
  primaryValues: string[];
  secondaryValues: string[];
  onChange: (next: { primaryCompetencies: string[]; secondaryCompetencies: string[] }) => void;
  competencies: CompetencyDefinition[];
}) {
  const primarySet = new Set(primaryValues || []);
  const secondarySet = new Set(secondaryValues || []);

  const setRole = (competencyId: string, role: "none" | "primary" | "secondary") => {
    const nextPrimary = (primaryValues || []).filter((value) => value !== competencyId);
    const nextSecondary = (secondaryValues || []).filter((value) => value !== competencyId);

    if (role === "primary") {
      nextPrimary.push(competencyId);
    }
    if (role === "secondary") {
      nextSecondary.push(competencyId);
    }

    onChange({
      primaryCompetencies: nextPrimary,
      secondaryCompetencies: nextSecondary,
    });
  };

  return (
    <div>
      <Label className="mb-1.5 block text-xs text-[#8890a8]">{label}</Label>
      <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/45 p-3">
        <div className="mb-3 text-[11px] leading-relaxed text-[#9fb0ca]">
          Один список вместо двух блоков: первичная компетенция задаёт главный фокус кейса, вторичная добавляет дополнительный вес в оценке.
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {competencies.map((competency) => {
            const role = primarySet.has(competency.id)
              ? "primary"
              : secondarySet.has(competency.id)
                ? "secondary"
                : "none";

            return (
              <div key={competency.id} className="rounded-lg border border-[#243244] bg-[#101826]/70 p-2">
                <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white">{competency.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[#70829d]">{competency.category}</div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                    role === "primary"
                      ? "border-[#4a9eff]/50 bg-[#4a9eff]/15 text-[#b7d9ff]"
                      : role === "secondary"
                        ? "border-[#00d4aa]/45 bg-[#00d4aa]/12 text-[#8ff5de]"
                        : "border-[#2a3a4e] bg-[#0d1522] text-[#7f91ad]"
                  }`}>
                    {role === "primary" ? "Первичная" : role === "secondary" ? "Вторичная" : "Не выбрана"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {([
                    ["none", "Нет"],
                    ["primary", "Первичная"],
                    ["secondary", "Вторичная"],
                  ] as const).map(([targetRole, title]) => (
                    <button
                      key={targetRole}
                      type="button"
                      onClick={() => setRole(competency.id, targetRole)}
                      className={`rounded-md border px-2 py-1.5 text-[11px] transition ${
                        role === targetRole
                          ? "border-[#FF6B00] bg-[#FF6B00]/15 text-white"
                          : "border-[#2a3a4e] bg-[#0d1522]/70 text-[#91a2bd] hover:border-[#3b5878]"
                      }`}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: any; onChange: (value: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-[#8890a8] mb-1.5 block">{label}</Label>
      <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="dns-admin-input bg-[#141c2b] border-[#2a3a4e] text-white" />
    </div>
  );
}

function FieldArea({ label, value, onChange, onBlur }: { label: string; value: any; onChange: (value: string) => void; onBlur?: () => void }) {
  return (
    <div>
      <Label className="text-xs text-[#8890a8] mb-1.5 block">{label}</Label>
      <Textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className="dns-admin-textarea min-h-[120px] bg-[#141c2b] border-[#2a3a4e] text-white" />
    </div>
  );
}
