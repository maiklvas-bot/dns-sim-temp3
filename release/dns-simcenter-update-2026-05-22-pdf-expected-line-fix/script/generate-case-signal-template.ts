import "../server/load-env";
import fs from "fs";
import path from "path";
import { buildWorkbookBuffer } from "../server/excel-export";
import { contentStorage } from "../server/content-storage";
import type {
  ChatInfo,
  CompetencyDefinition,
  EmailCase,
  MessengerCase,
  SimCase,
  VideoCase,
} from "../shared/simulation-content";

type CellValue = string | number | boolean | null | undefined;
type Rows = CellValue[][];

const OUTPUT_FILENAME = "Шаблон_кейсов_и_сигналов.xlsx";
const MAX_PHONE_CYCLES = 3;
const MAX_OPTIONS = 5;

const SIGNAL_TYPES = [
  { value: "message", label: "Сообщение" },
  { value: "zone_signal", label: "Сигнал зоны" },
  { value: "email", label: "Письмо" },
  { value: "call", label: "Звонок" },
  { value: "visitor", label: "Посетитель" },
];

const ZONES = ["торговый_зал", "склад", "выдача", "начальство"];

function ensureText(value: string | null | undefined, fallback = "") {
  return value == null ? fallback : String(value);
}

function ensureYesNo(value: boolean | null | undefined) {
  return value === false ? "Нет" : "Да";
}

function joinList(values: string[] | null | undefined) {
  return (values || []).filter(Boolean).join(", ");
}

function resolveCompetencyName(id: string, competencies: CompetencyDefinition[]) {
  const found = competencies.find((item) => item.id === id);
  return found?.name || id;
}

function formatCompetencyList(ids: string[] | undefined, competencies: CompetencyDefinition[]) {
  return (ids || []).map((id) => resolveCompetencyName(id, competencies)).join(", ");
}

function formatCompetencyScores(
  scores: Record<string, number> | undefined,
  competencies: CompetencyDefinition[],
) {
  const entries = Object.entries(scores || {});
  if (entries.length === 0) {
    return "";
  }

  return entries
    .map(([id, score]) => `${resolveCompetencyName(id, competencies)}:${score}`)
    .join(", ");
}

function normalizeSignalType(value: string | undefined, fallback = "call") {
  if (!value) {
    return fallback;
  }

  return SIGNAL_TYPES.some((item) => item.value === value) ? value : fallback;
}

function firstCompetencyName(competencies: CompetencyDefinition[]) {
  return competencies[0]?.name || "Планирование";
}

function secondCompetencyName(competencies: CompetencyDefinition[]) {
  return competencies[1]?.name || competencies[0]?.name || "Коммуникация";
}

function createFallbackPhoneCase(competencies: CompetencyDefinition[]): SimCase {
  const primary = firstCompetencyName(competencies);
  const secondary = secondCompetencyName(competencies);

  return {
    id: "CASE-01",
    title: "Срочный звонок по смене",
    description: "Сотрудник сообщает о сбое в работе смены и ждёт решения руководителя.",
    primaryCompetencies: [primary],
    secondaryCompetencies: [secondary],
    trigger: {
      type: "call",
      source: "Старший продавец",
      text: "Нужна помощь: два сотрудника одновременно просят перестановку по задачам.",
    },
    zones_affected: ["торговый_зал", "склад"],
    cycles: [
      {
        id: "CASE-01__cycle_1",
        cycle: 1,
        situation: "На линии старший продавец. В торговом зале растёт очередь, а склад просит срочную помощь.",
        signal: {
          type: "call",
          content: "Нужно быстро решить, кого оставить в зале, а кого перевести на склад.",
        },
        options: [
          {
            id: "CASE-01__cycle_1__option_1",
            level: 1,
            text: "Прошу старшего продавца назвать приоритеты и перераспределяю людей по двум зонам.",
            score: 3,
            effects: { queue: -2, conversion: 1, morale: 1, revenue_impact: 1, delivery_status: 1 },
            competency_scores: { [primary]: 3, [secondary]: 2 },
          },
          {
            id: "CASE-01__cycle_1__option_2",
            level: 2,
            text: "Говорю разобраться самим и перезвонить позже.",
            score: 1,
            effects: { queue: 1, conversion: -1, morale: -1, revenue_impact: -1, delivery_status: -1 },
            competency_scores: { [primary]: 1 },
          },
        ],
      },
      {
        id: "CASE-01__cycle_2",
        cycle: 2,
        situation: "Через несколько минут звонит склад: поставщик уже ждёт подтверждения разгрузки.",
        signal: {
          type: "call",
          content: "Если не подтвердить приёмку сейчас, поставщик уедет на следующий слот.",
        },
        options: [
          {
            id: "CASE-01__cycle_2__option_1",
            level: 1,
            text: "Согласовываю ответственного, фиксирую сроки и подтверждаю приёмку.",
            score: 3,
            effects: { queue: 0, conversion: 0, morale: 1, revenue_impact: 1, delivery_status: 2 },
            competency_scores: { [primary]: 2, [secondary]: 2 },
          },
        ],
      },
      {
        id: "CASE-01__cycle_3",
        cycle: 3,
        situation: "Финальный созвон: нужно снять напряжение у команды и закрепить порядок действий.",
        signal: {
          type: "call",
          content: "Команда ждёт короткое и понятное решение без новых переносов.",
        },
        options: [
          {
            id: "CASE-01__cycle_3__option_1",
            level: 1,
            text: "Подвожу итог, называю ответственных и договариваюсь о контрольной точке через 10 минут.",
            score: 3,
            effects: { queue: -1, conversion: 1, morale: 2, revenue_impact: 1, delivery_status: 1 },
            competency_scores: { [primary]: 2, [secondary]: 3 },
          },
        ],
      },
    ],
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: {
      minIntervalSeconds: 120,
      maxIntervalSeconds: 180,
      reminderIntervalSeconds: 180,
    },
    sortOrder: 1,
    isActive: true,
  };
}

function createFallbackMessengerCase(
  competencies: CompetencyDefinition[],
  chats: ChatInfo[],
): MessengerCase {
  return {
    id: "MSG-01",
    chatId: chats[0]?.id || "CHAT-01",
    isGroup: chats[0]?.isGroup || false,
    senderName: chats[0]?.name || "Старший смены",
    senderRole: chats[0]?.role || "Смена",
    senderAvatar: chats[0]?.avatar || "👤",
    message: "В ТёрКограмме пришло срочное сообщение: нужна быстрая координация по задачам на ближайшие 15 минут.",
    arrivalMinute: 10,
    options: [
      {
        id: "MSG-01__option_1",
        level: 1,
        text: "Уточняю контекст, фиксирую решение одним сообщением и назначаю ответственного.",
        score: 3,
        effects: { queue: -1, conversion: 1, morale: 1, revenue_impact: 1, delivery_status: 1 },
        competency_scores: { [firstCompetencyName(competencies)]: 3 },
      },
      {
        id: "MSG-01__option_2",
        level: 2,
        text: "Пишу коротко без уточнений и прошу подождать.",
        score: 1,
        effects: { queue: 0, conversion: 0, morale: -1, revenue_impact: 0, delivery_status: -1 },
        competency_scores: { [secondCompetencyName(competencies)]: 1 },
      },
    ],
    primaryCompetency: competencies[0]?.id || "",
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: {
      arrivalMinute: 10,
      reminderIntervalSeconds: 5,
    },
    sortOrder: 1,
    isActive: true,
  };
}

function createFallbackEmailCase(competencies: CompetencyDefinition[]): EmailCase {
  return {
    id: "EMAIL-01",
    subject: "Срочное письмо по операционной ситуации",
    from: "Ольга Смирнова",
    department: "Операционный отдел",
    departmentColor: "#4a9eff",
    preview: "Нужно быстро согласовать порядок действий по текущей ситуации в магазине.",
    body: "Коллеги, прошу в течение ближайших 10 минут подтвердить порядок действий: кто берёт коммуникацию с клиентом, кто фиксирует решение, кто контролирует исполнение.",
    arrivalMinute: 12,
    options: [
      {
        id: "EMAIL-01__option_1",
        level: 1,
        text: "Подтверждаю ответственных, фиксирую срок ответа и отправляю короткий план действий.",
        score: 3,
        effects: { queue: -1, conversion: 1, morale: 1, revenue_impact: 1, delivery_status: 1 },
        competency_scores: { [firstCompetencyName(competencies)]: 3, [secondCompetencyName(competencies)]: 2 },
      },
      {
        id: "EMAIL-01__option_2",
        level: 2,
        text: "Пересылаю письмо без контекста и прошу коллег разобраться самостоятельно.",
        score: 1,
        effects: { queue: 0, conversion: 0, morale: -1, revenue_impact: 0, delivery_status: -1 },
        competency_scores: { [secondCompetencyName(competencies)]: 1 },
      },
    ],
    primaryCompetency: competencies[0]?.id || "",
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: {
      arrivalMinute: 12,
      reminderIntervalSeconds: 180,
    },
    sortOrder: 1,
    isActive: true,
  };
}

function createFallbackVideoCase(competencies: CompetencyDefinition[]): VideoCase {
  return {
    id: "VIDEO-01",
    title: "Видеозвонок от коллеги",
    sender: "Алексей",
    role: "Заместитель директора",
    senderAvatar: "👤",
    duration: "1:20",
    situation: "Коллега подключается по видеосвязи и просит быстро согласовать порядок действий по спорной ситуации с клиентом.",
    arrivalMinute: 15,
    options: [
      {
        id: "VIDEO-01__option_1",
        level: 1,
        text: "Спокойно уточняю факты, даю последовательность действий и подтверждаю контрольную точку.",
        score: 3,
        effects: { queue: -1, conversion: 1, morale: 1, revenue_impact: 1, delivery_status: 1 },
        competency_scores: { [firstCompetencyName(competencies)]: 2, [secondCompetencyName(competencies)]: 2 },
      },
      {
        id: "VIDEO-01__option_2",
        level: 2,
        text: "Прошу решить вопрос самостоятельно без дополнительной координации.",
        score: 1,
        effects: { queue: 0, conversion: -1, morale: -1, revenue_impact: 0, delivery_status: 0 },
        competency_scores: { [secondCompetencyName(competencies)]: 1 },
      },
    ],
    primaryCompetency: competencies[0]?.id || "",
    imageAssetId: null,
    imageUrl: null,
    videoAssetId: null,
    videoUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: {
      arrivalMinute: 15,
      reminderIntervalSeconds: 180,
    },
    sortOrder: 1,
    isActive: true,
  };
}

function addTitle(rows: Rows, title: string, description: string, notes: string[]) {
  rows.push([title]);
  rows.push([description]);
  notes.forEach((note) => rows.push([note]));
  rows.push([]);
}

function addFieldTable(rows: Rows, entries: Array<{
  field: string;
  status: string;
  value: CellValue;
  allowed?: string;
  note?: string;
}>) {
  rows.push(["Поле", "Статус", "Значение", "Допустимые значения", "Примечание"]);
  entries.forEach((entry) => {
    rows.push([
      entry.field,
      entry.status,
      entry.value,
      entry.allowed || "",
      entry.note || "",
    ]);
  });
  rows.push([]);
}

function addBlockHeading(rows: Rows, title: string, description?: string) {
  rows.push([title]);
  if (description) {
    rows.push([description]);
  }
}

function addOptionsTable(
  rows: Rows,
  options: Array<{
    id?: string;
    level?: number;
    text?: string;
    score?: number;
    effects?: {
      queue?: number;
      conversion?: number;
      morale?: number;
      revenue_impact?: number;
      delivery_status?: number;
    };
    competency_scores?: Record<string, number>;
  }>,
  competencies: CompetencyDefinition[],
) {
  rows.push([
    "Option ID",
    "Уровень",
    "Текст ответа",
    "Оценка",
    "Очередь",
    "Конверсия",
    "Мораль",
    "Влияние на выручку",
    "Статус доставки",
    "Компетенции:баллы",
    "Примечание",
  ]);

  for (let index = 0; index < MAX_OPTIONS; index += 1) {
    const option = options[index];
    rows.push([
      option?.id || "",
      option?.level ?? index + 1,
      option?.text || "",
      option?.score ?? "",
      option?.effects?.queue ?? "",
      option?.effects?.conversion ?? "",
      option?.effects?.morale ?? "",
      option?.effects?.revenue_impact ?? "",
      option?.effects?.delivery_status ?? "",
      formatCompetencyScores(option?.competency_scores, competencies),
      index === 0
        ? "Option ID можно оставить пустым: система умеет сгенерировать его при сохранении."
        : "",
    ]);
  }

  rows.push([]);
}

function buildPhoneBlock(
  title: string,
  description: string,
  entity: SimCase,
  competencies: CompetencyDefinition[],
) {
  const rows: Rows = [];
  addBlockHeading(rows, title, description);
  addFieldTable(rows, [
    { field: "ID", status: "Обязательно", value: entity.id, allowed: "CASE-01, CASE-02, ...", note: "ID кейса лучше задавать явно." },
    { field: "Порядок", status: "Обязательно", value: entity.sortOrder, note: "Порядок показа в списке админки." },
    { field: "Название", status: "Обязательно", value: entity.title },
    { field: "Описание", status: "Обязательно", value: entity.description },
    { field: "Источник сигнала", status: "Обязательно", value: ensureText(entity.trigger?.source), note: "Кто инициирует первый звонок." },
    {
      field: "Тип сигнала",
      status: "Обязательно",
      value: normalizeSignalType(entity.trigger?.type, "call"),
      allowed: SIGNAL_TYPES.map((item) => item.value).join(", "),
      note: "Для телефонного кейса по умолчанию используйте call.",
    },
    { field: "Текст сигнала", status: "Обязательно", value: ensureText(entity.trigger?.text) },
    {
      field: "Зоны",
      status: "Обязательно",
      value: joinList(entity.zones_affected),
      allowed: ZONES.join(", "),
      note: "Несколько зон пишите через запятую.",
    },
    {
      field: "Основные компетенции",
      status: "Обязательно",
      value: formatCompetencyList(entity.primaryCompetencies, competencies),
      note: "Можно указывать названия компетенций через запятую.",
    },
    {
      field: "Вторичные компетенции",
      status: "Опционально",
      value: formatCompetencyList(entity.secondaryCompetencies, competencies),
    },
    { field: "Мин. интервал, сек", status: "Опционально", value: entity.timing?.minIntervalSeconds ?? "" },
    { field: "Макс. интервал, сек", status: "Опционально", value: entity.timing?.maxIntervalSeconds ?? "" },
    { field: "Повтор, сек", status: "Опционально", value: entity.timing?.reminderIntervalSeconds ?? 180, note: "Если пусто, система использует значение по умолчанию." },
    { field: "Image asset", status: "Опционально", value: entity.imageAssetId || "", note: "Можно оставить пустым и позже прикрепить медиа в админке." },
    { field: "Audio asset", status: "Опционально", value: entity.audioAssetId || "", note: "Аудио сигнала для карточки кейса." },
    { field: "Активен", status: "Обязательно", value: ensureYesNo(entity.isActive) },
  ]);

  for (let cycleIndex = 0; cycleIndex < MAX_PHONE_CYCLES; cycleIndex += 1) {
    const cycle = entity.cycles[cycleIndex];
    rows.push([`Цикл ${cycleIndex + 1}`]);
    addFieldTable(rows, [
      {
        field: "ID цикла",
        status: "Опционально",
        value: cycle?.id || "",
        note: "Можно оставить пустым: система умеет сгенерировать ID цикла.",
      },
      { field: "Номер цикла", status: "Обязательно", value: cycle?.cycle ?? cycleIndex + 1 },
      { field: "Ситуация", status: "Обязательно", value: ensureText(cycle?.situation) },
      {
        field: "Тип сигнала цикла",
        status: "Обязательно",
        value: normalizeSignalType(cycle?.signal?.type, "call"),
        allowed: SIGNAL_TYPES.map((item) => item.value).join(", "),
      },
      { field: "Текст сигнала цикла", status: "Обязательно", value: ensureText(cycle?.signal?.content) },
    ]);
    rows.push([`Варианты ответа для цикла ${cycleIndex + 1}`]);
    addOptionsTable(rows, cycle?.options || [], competencies);
  }

  rows.push([]);
  return rows;
}

function buildMessengerBlock(
  title: string,
  description: string,
  entity: MessengerCase,
  competencies: CompetencyDefinition[],
) {
  const rows: Rows = [];
  addBlockHeading(rows, title, description);
  addFieldTable(rows, [
    { field: "ID", status: "Обязательно", value: entity.id, allowed: "MSG-01, MSG-02, ..." },
    { field: "Порядок", status: "Обязательно", value: entity.sortOrder },
    { field: "Chat ID", status: "Обязательно", value: entity.chatId, note: "Должен существовать в листе 'Справочник'." },
    { field: "Отправитель", status: "Обязательно", value: entity.senderName },
    { field: "Роль", status: "Опционально", value: entity.senderRole || "" },
    { field: "Аватар", status: "Опционально", value: entity.senderAvatar || "" },
    { field: "Минута прихода", status: "Обязательно", value: entity.arrivalMinute },
    { field: "Переопределение минуты", status: "Опционально", value: entity.timing?.arrivalMinute ?? entity.arrivalMinute },
    { field: "Повтор, сек", status: "Опционально", value: entity.timing?.reminderIntervalSeconds ?? 5, note: "Для messenger системное значение по умолчанию — 5 секунд." },
    {
      field: "Компетенция",
      status: "Обязательно",
      value: resolveCompetencyName(entity.primaryCompetency, competencies),
      note: "Preview отдельным полем не нужен: админка строит его из текста сообщения автоматически.",
    },
    { field: "Текст сообщения", status: "Обязательно", value: entity.message },
    { field: "Image asset", status: "Опционально", value: entity.imageAssetId || "" },
    { field: "Audio asset", status: "Опционально", value: entity.audioAssetId || "" },
    { field: "Активен", status: "Обязательно", value: ensureYesNo(entity.isActive) },
  ]);

  rows.push(["Варианты ответа"]);
  addOptionsTable(rows, entity.options || [], competencies);
  rows.push([]);
  return rows;
}

function buildEmailBlock(
  title: string,
  description: string,
  entity: EmailCase,
  competencies: CompetencyDefinition[],
) {
  const rows: Rows = [];
  addBlockHeading(rows, title, description);
  addFieldTable(rows, [
    { field: "ID", status: "Обязательно", value: entity.id, allowed: "EMAIL-01, EMAIL-02, ..." },
    { field: "Порядок", status: "Обязательно", value: entity.sortOrder },
    { field: "Тема", status: "Обязательно", value: entity.subject },
    { field: "Отправитель", status: "Обязательно", value: entity.from },
    { field: "Подразделение", status: "Опционально", value: entity.department || "" },
    { field: "Цвет подразделения", status: "Опционально", value: entity.departmentColor || "#4a9eff", note: "Обычно hex-цвет, например #4a9eff." },
    { field: "Короткое превью письма", status: "Опционально", value: entity.preview || "", note: "Для почты это отдельное поле и его нужно задавать вручную." },
    { field: "Тело письма", status: "Обязательно", value: entity.body },
    { field: "Минута прихода", status: "Обязательно", value: entity.arrivalMinute },
    { field: "Переопределение минуты", status: "Опционально", value: entity.timing?.arrivalMinute ?? entity.arrivalMinute },
    { field: "Повтор, сек", status: "Опционально", value: entity.timing?.reminderIntervalSeconds ?? 180 },
    {
      field: "Компетенция",
      status: "Обязательно",
      value: resolveCompetencyName(entity.primaryCompetency, competencies),
    },
    { field: "Image asset", status: "Опционально", value: entity.imageAssetId || "" },
    { field: "Audio asset", status: "Опционально", value: entity.audioAssetId || "" },
    { field: "Активен", status: "Обязательно", value: ensureYesNo(entity.isActive) },
  ]);

  rows.push(["Варианты ответа"]);
  addOptionsTable(rows, entity.options || [], competencies);
  rows.push([]);
  return rows;
}

function buildVideoBlock(
  title: string,
  description: string,
  entity: VideoCase,
  competencies: CompetencyDefinition[],
) {
  const rows: Rows = [];
  addBlockHeading(rows, title, description);
  addFieldTable(rows, [
    { field: "ID", status: "Обязательно", value: entity.id, allowed: "VIDEO-01, VIDEO-02, ..." },
    { field: "Порядок", status: "Обязательно", value: entity.sortOrder },
    { field: "Название", status: "Обязательно", value: entity.title },
    { field: "Отправитель", status: "Обязательно", value: entity.sender },
    { field: "Роль", status: "Опционально", value: entity.role || "" },
    { field: "Аватар", status: "Опционально", value: entity.senderAvatar || "" },
    { field: "Длительность", status: "Обязательно", value: entity.duration || "" },
    { field: "Минута прихода", status: "Обязательно", value: entity.arrivalMinute },
    { field: "Переопределение минуты", status: "Опционально", value: entity.timing?.arrivalMinute ?? entity.arrivalMinute },
    { field: "Повтор, сек", status: "Опционально", value: entity.timing?.reminderIntervalSeconds ?? 180 },
    {
      field: "Компетенция",
      status: "Обязательно",
      value: resolveCompetencyName(entity.primaryCompetency, competencies),
    },
    { field: "Ситуация", status: "Обязательно", value: entity.situation },
    {
      field: "Video asset",
      status: "Опционально",
      value: entity.videoAssetId || "",
      note: "Главный источник для видеозвонка. Если заполняете его, image asset используйте только как запасной вариант.",
    },
    {
      field: "Image asset",
      status: "Опционально",
      value: entity.imageAssetId || "",
      note: "Запасной вариант, если видеофайла пока нет. Не рассчитывайте на одновременное использование с Video asset.",
    },
    { field: "Audio asset", status: "Опционально", value: entity.audioAssetId || "" },
    { field: "Активен", status: "Обязательно", value: ensureYesNo(entity.isActive) },
  ]);

  rows.push(["Варианты ответа"]);
  addOptionsTable(rows, entity.options || [], competencies);
  rows.push([]);
  return rows;
}

function buildEmptyPhoneCase(): SimCase {
  return {
    id: "",
    title: "",
    description: "",
    primaryCompetencies: [],
    secondaryCompetencies: [],
    trigger: { type: "call", source: "", text: "" },
    zones_affected: [],
    cycles: Array.from({ length: MAX_PHONE_CYCLES }, (_, index) => ({
      id: "",
      cycle: index + 1,
      situation: "",
      signal: { type: "call", content: "" },
      options: [],
    })),
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: { minIntervalSeconds: null, maxIntervalSeconds: null, reminderIntervalSeconds: 180 },
    sortOrder: 1,
    isActive: true,
  };
}

function buildEmptyEmailCase(): EmailCase {
  return {
    id: "",
    subject: "",
    from: "",
    department: "",
    departmentColor: "#4a9eff",
    preview: "",
    body: "",
    arrivalMinute: 12,
    options: [],
    primaryCompetency: "",
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: { arrivalMinute: 12, reminderIntervalSeconds: 180 },
    sortOrder: 1,
    isActive: true,
  };
}

function buildEmptyMessengerCase(): MessengerCase {
  return {
    id: "",
    chatId: "",
    isGroup: false,
    senderName: "",
    senderRole: "",
    senderAvatar: "",
    message: "",
    arrivalMinute: 10,
    options: [],
    primaryCompetency: "",
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: { arrivalMinute: 10, reminderIntervalSeconds: 5 },
    sortOrder: 1,
    isActive: true,
  };
}

function buildEmptyVideoCase(): VideoCase {
  return {
    id: "",
    title: "",
    sender: "",
    role: "",
    senderAvatar: "",
    duration: "",
    situation: "",
    arrivalMinute: 15,
    options: [],
    primaryCompetency: "",
    imageAssetId: null,
    imageUrl: null,
    videoAssetId: null,
    videoUrl: null,
    audioAssetId: null,
    audioUrl: null,
    timing: { arrivalMinute: 15, reminderIntervalSeconds: 180 },
    sortOrder: 1,
    isActive: true,
  };
}

function buildPhoneSheet(
  exampleCase: SimCase,
  competencies: CompetencyDefinition[],
) {
  const rows: Rows = [];
  addTitle(
    rows,
    "Телефонный звонок",
    "Шаблон для раздела 'Кейсы' в админке. Ниже есть один заполненный пример и один пустой блок для копирования.",
    [
      "Как пользоваться: сначала посмотрите пример, затем копируйте блок 'Пустой шаблон' для нового кейса.",
      "Подсказка: ID кейса заполняйте явно, а ID циклов и вариантов можно оставить пустыми.",
      "Тип сигнала для телефонного кейса обычно = call.",
    ],
  );
  rows.push(...buildPhoneBlock("Пример заполнения", "Ниже пример кейса, который показывает структуру карточки, циклов и вариантов.", exampleCase, competencies));
  rows.push(...buildPhoneBlock("Пустой шаблон", "Скопируйте этот блок и заполните значениями для нового телефонного кейса.", buildEmptyPhoneCase(), competencies));
  return rows;
}

function buildEmailSheet(
  exampleCase: EmailCase,
  competencies: CompetencyDefinition[],
) {
  const rows: Rows = [];
  addTitle(
    rows,
    "Почта",
    "Шаблон для раздела email в админке. Для почты поле preview заполняется отдельно, в отличие от messenger.",
    [
      "Как пользоваться: сначала посмотрите пример, затем копируйте блок 'Пустой шаблон' для нового письма.",
      "Подсказка: короткое превью и тело письма — это разные поля.",
    ],
  );
  rows.push(...buildEmailBlock("Пример заполнения", "Ниже пример для email-кейса.", exampleCase, competencies));
  rows.push(...buildEmailBlock("Пустой шаблон", "Скопируйте этот блок и заполните значениями для нового письма.", buildEmptyEmailCase(), competencies));
  return rows;
}

function buildMessengerSheet(
  exampleCase: MessengerCase,
  competencies: CompetencyDefinition[],
) {
  const rows: Rows = [];
  addTitle(
    rows,
    "Сообщение в ТёрКограмм",
    "Шаблон для раздела messenger в админке. Отдельное поле preview не нужно: оно строится автоматически из текста сообщения.",
    [
      "Как пользоваться: chatId берите из листа 'Справочник'.",
      "Подсказка: isGroup отдельно не заполняется в кейсе, он наследуется от выбранного чата.",
    ],
  );
  rows.push(...buildMessengerBlock("Пример заполнения", "Ниже пример для сообщения в ТёрКограмм.", exampleCase, competencies));
  rows.push(...buildMessengerBlock("Пустой шаблон", "Скопируйте этот блок и заполните значениями для нового сообщения.", buildEmptyMessengerCase(), competencies));
  return rows;
}

function buildVideoSheet(
  exampleCase: VideoCase,
  competencies: CompetencyDefinition[],
) {
  const rows: Rows = [];
  addTitle(
    rows,
    "Видеозвонок",
    "Шаблон для раздела video в админке. Ниже есть пример и пустой шаблон.",
    [
      "Как пользоваться: заполняйте Video asset как основной источник, а Image asset оставляйте как запасной вариант.",
      "Подсказка: не рассчитывайте на одновременное рабочее заполнение и video asset, и image asset.",
    ],
  );
  rows.push(...buildVideoBlock("Пример заполнения", "Ниже пример видеозвонка.", exampleCase, competencies));
  rows.push(...buildVideoBlock("Пустой шаблон", "Скопируйте этот блок и заполните значениями для нового видеозвонка.", buildEmptyVideoCase(), competencies));
  return rows;
}

function buildReferenceSheet(
  competencies: CompetencyDefinition[],
  chats: ChatInfo[],
) {
  const rows: Rows = [];
  addTitle(
    rows,
    "Справочник",
    "Служебный лист с допустимыми значениями, шаблонами ID, текущими чатами и текущими компетенциями из базы.",
    [
      "Если справочник пуст, шаблон всё равно можно использовать: сначала создайте недостающие сущности в админке.",
    ],
  );

  rows.push(["Типы сигналов"]);
  rows.push(["Значение", "Русское описание", "Где использовать"]);
  SIGNAL_TYPES.forEach((item) => {
    rows.push([
      item.value,
      item.label,
      item.value === "call" ? "По умолчанию для телефонного кейса" : "По необходимости",
    ]);
  });
  rows.push([]);

  rows.push(["Зоны"]);
  rows.push(["Значение", "Пояснение"]);
  ZONES.forEach((zone) => rows.push([zone, "Используйте в поле 'Зоны' через запятую при необходимости."]));
  rows.push([]);

  rows.push(["Шаблоны ID"]);
  rows.push(["Тип", "Пример", "Комментарий"]);
  rows.push(["Телефонный кейс", "CASE-01", "Основной ID кейса лучше задавать явно."]);
  rows.push(["Сообщение", "MSG-01", "Основной ID channel-item для messenger."]);
  rows.push(["Видеозвонок", "VIDEO-01", "Основной ID channel-item для video."]);
  rows.push(["ID цикла", "CASE-01__cycle_1", "Можно оставить пустым и дать системе сгенерировать."]);
  rows.push(["ID варианта", "CASE-01__cycle_1__option_1", "Можно оставить пустым и дать системе сгенерировать."]);
  rows.push([]);

  rows.push(["Чаты ТёрКограмма"]);
  rows.push(["chatId", "Название", "Групповой чат", "Аватар", "Роль", "Иконка", "Участники", "Порядок"]);
  if (chats.length === 0) {
    rows.push(["", "Нет чатов в базе", "", "", "", "", "", ""]);
  } else {
    chats.forEach((chat) => {
      rows.push([
        chat.id,
        chat.name,
        ensureYesNo(chat.isGroup),
        chat.avatar,
        chat.role || "",
        chat.icon || "",
        joinList(chat.members),
        chat.sortOrder,
      ]);
    });
  }
  rows.push([]);

  rows.push(["Компетенции"]);
  rows.push(["ID", "Название", "Описание", "Категория"]);
  if (competencies.length === 0) {
    rows.push(["", "Нет компетенций в базе", "", ""]);
  } else {
    competencies.forEach((competency) => {
      rows.push([
        competency.id,
        competency.name,
        competency.description,
        competency.category,
      ]);
    });
  }
  rows.push([]);

  rows.push(["Правила по медиа и заполнению"]);
  rows.push(["Тема", "Правило"]);
  rows.push(["Image asset / Audio asset / Video asset", "Если медиа уже загружено в систему, указывайте asset ID. Если ещё нет — оставляйте поле пустым и прикрепляйте файл позже через админку."]);
  rows.push(["Компетенции:баллы", "Формат: Планирование:3, Коммуникация:2. Можно использовать названия компетенций или их ID."]);
  rows.push(["Preview в messenger", "Не заполняется отдельно: админка формирует preview автоматически из текста сообщения."]);
  rows.push(["Chat ID", "Для сообщений используйте только существующий chatId из этого листа."]);
  rows.push(["Video asset vs Image asset", "Для видеозвонка основной вариант — Video asset. Image asset можно использовать как запасной, если видео ещё не загружено."]);
  rows.push(["Статус поля", "Обязательно — без него кейс лучше не заводить. Опционально — можно заполнить позже."]);

  return rows;
}

function main() {
  const content = contentStorage.getPublicContent(true);
  const competencies = content.competencies || [];
  const chats = content.messengerChats || [];

  const examplePhone = content.cases?.[0] || createFallbackPhoneCase(competencies);
  const exampleEmail = content.emailCases?.[0] || createFallbackEmailCase(competencies);
  const exampleMessenger = content.messengerCases?.[0] || createFallbackMessengerCase(competencies, chats);
  const exampleVideo = content.videoCases?.[0] || createFallbackVideoCase(competencies);

  const workbook = buildWorkbookBuffer({
    sheets: [
      { name: "Телефонный звонок", rows: buildPhoneSheet(examplePhone, competencies) },
      { name: "Почта", rows: buildEmailSheet(exampleEmail, competencies) },
      { name: "Сообщение в ТёрКограмм", rows: buildMessengerSheet(exampleMessenger, competencies) },
      { name: "Видеозвонок", rows: buildVideoSheet(exampleVideo, competencies) },
      { name: "Справочник", rows: buildReferenceSheet(competencies, chats) },
    ],
  });

  const outputPath = path.resolve(process.cwd(), OUTPUT_FILENAME);
  fs.writeFileSync(outputPath, workbook);
  console.log(`Excel template created: ${outputPath}`);
}

main();
