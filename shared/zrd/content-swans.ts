/**
 * ЗРД v2 — чёрные лебеди: редкие сильные риски (спека §4).
 * Срабатывают рандомно (seeded) в начале такта; local бьёт по одной РРС, global — по всем.
 * Штраф tickPenalty применяется целевым местам каждый такт, пока weeksLeft > 0 и место
 * не отреагировало (реакция = swanChoice: платишь цену опции — штраф к тебе больше не идёт).
 * У каждого лебедя есть бесплатная опция (инвариант «ход всегда возможен», §8a соло-вики).
 */
import type { EventOption } from "./types";
import type { BlackSwanDef, SwanFrequency } from "./match-types";

/** вероятность срабатывания лебедя в очередном такте, по профилю частоты */
export const SWAN_TICK_PROBABILITY: Record<SwanFrequency, number> = {
  off: 0,
  rare: 0.10,
  standard: 0.22,
  storm: 0.40,
};

/** бесплатная опция «принять и перетерпеть» — есть у каждого лебедя */
const acceptOption = (label = "Принять удар и перетерпеть"): EventOption => ({
  id: "accept",
  label,
  effects: {},
  fitsWhen: ["lowCapital"],
  weak: true,
});

export const BLACK_SWANS: BlackSwanDef[] = [
  {
    id: "proverka_organov",
    title: "Проверка органов",
    description: "Внеплановая проверка контролирующих органов: команда отвлекается на документы, операционка проседает.",
    scope: "local", weight: 3, durationWeeks: 2,
    tickPenalty: { metrics: { sales: -1 } },
    options: [
      { id: "compliance", label: "Бросить юристов и закрыть вопросы сразу", cost: { capital: 4 }, effects: {}, fitsWhen: ["highCapital"] },
      { id: "delegate", label: "Выделить ответственного и работать параллельно", cost: { staff: 1 }, effects: {}, fitsWhen: ["hasStaff"] },
      acceptOption(),
    ],
  },
  {
    id: "postavshik_bankrot",
    title: "Банкротство поставщика",
    description: "Ключевой поставщик остановил отгрузки: полки пустеют, склад не пополняется.",
    scope: "local", weight: 2, durationWeeks: 4,
    tickPenalty: { resources: { warehouse: -1 } },
    options: [
      { id: "new_supplier", label: "Срочно законтрактовать замену дороже", cost: { capital: 6 }, effects: { resources: { warehouse: 1 } }, fitsWhen: ["highCapital", "hasWarehouse"] },
      { id: "redistribute", label: "Перераспределить остатки по сети", cost: { staff: 1 }, effects: {}, fitsWhen: ["hasStaff"] },
      acceptOption(),
    ],
  },
  {
    id: "kiberataka",
    title: "Кибератака",
    description: "ИТ-инцидент: кассы и сайт работают с перебоями по всему дивизиону.",
    scope: "global", weight: 2, durationWeeks: 2,
    tickPenalty: { metrics: { sales: -1, nps: -1 } },
    options: [
      { id: "recover", label: "Экстренное восстановление с подрядчиком", cost: { capital: 5 }, effects: {}, fitsWhen: ["highCapital", "hasTech"] },
      { id: "manual", label: "Перевести процессы на ручной режим", cost: { staff: 1 }, effects: { metrics: { nps: -1 } }, fitsWhen: ["hasStaff"], weak: true },
      acceptOption(),
    ],
  },
  {
    id: "epidemiya",
    title: "Эпидемия в регионе",
    description: "Волна заболеваемости: трафик в магазинах падает на недели.",
    scope: "global", weight: 1, durationWeeks: 8,
    tickPenalty: { metrics: { sales: -2 } },
    options: [
      { id: "online_push", label: "Форсировать онлайн-каналы и доставку", cost: { capital: 6 }, effects: { metrics: { sales: 1 } }, fitsWhen: ["highCapital", "hasTech"] },
      { id: "safety", label: "Санитарные меры и график смен", cost: { capital: 3 }, effects: { metrics: { nps: 1 } }, fitsWhen: ["anyReasonable"] },
      acceptOption(),
    ],
  },
  {
    id: "valutnyi_shok",
    title: "Валютный шок",
    description: "Резкий скачок курса: закупка дорожает, маржа сжимается по всему дивизиону.",
    scope: "global", weight: 2, durationWeeks: 4,
    tickPenalty: { resources: { capital: -3 } },
    options: [
      { id: "hedge", label: "Зафиксировать цены контрактами", cost: { capital: 5 }, effects: {}, fitsWhen: ["highCapital"] },
      { id: "reprice", label: "Переоценить полку под курс", effects: { metrics: { nps: -1 } }, fitsWhen: ["lowCapital"], weak: true },
      acceptOption("Держать цены и терпеть маржу"),
    ],
  },
  {
    id: "zabastovka_perevozchikov",
    title: "Забастовка перевозчиков",
    description: "Транспортные подрядчики встали: поставки в РРС буксуют.",
    scope: "local", weight: 2, durationWeeks: 3,
    tickPenalty: { resources: { warehouse: -1 }, metrics: { sales: -1 } },
    options: [
      { id: "own_fleet", label: "Арендовать транспорт напрямую", cost: { capital: 5 }, effects: {}, fitsWhen: ["highCapital"] },
      { id: "negotiate", label: "Сесть за стол переговоров", cost: { staff: 1 }, effects: {}, fitsWhen: ["hasStaff"] },
      acceptOption(),
    ],
  },
  {
    id: "pozhar_sklada",
    title: "Пожар на складе",
    description: "Возгорание на распределительном складе РРС: часть запасов потеряна.",
    scope: "local", weight: 1, durationWeeks: 6,
    tickPenalty: { resources: { warehouse: -2 } },
    options: [
      { id: "rent", label: "Срочно арендовать резервные площади", cost: { capital: 7 }, effects: { resources: { warehouse: 1 } }, fitsWhen: ["highCapital"] },
      { id: "insurance", label: "Запустить страховое возмещение", cost: { staff: 1 }, effects: { resources: { capital: 4 } }, fitsWhen: ["hasStaff"] },
      acceptOption(),
    ],
  },
  {
    id: "reputatsionnyi_krizis",
    title: "Репутационный кризис",
    description: "Скандальный кейс с покупателем разлетелся по соцсетям региона.",
    scope: "local", weight: 2, durationWeeks: 4,
    tickPenalty: { metrics: { nps: -2 } },
    options: [
      { id: "pr", label: "Публичный разбор и компенсация клиенту", cost: { capital: 4 }, effects: { metrics: { nps: 1 } }, fitsWhen: ["highCapital", "lowNps"] },
      { id: "silence", label: "Не подогревать, работать точечно", effects: { metrics: { nps: -1 } }, fitsWhen: [], weak: true },
      acceptOption(),
    ],
  },
  {
    id: "federalnyi_konkurent",
    title: "Экспансия федерального конкурента",
    description: "Федеральная сеть открывает точки по всем городам дивизиона с агрессивными ценами.",
    scope: "global", weight: 2, durationWeeks: 6,
    tickPenalty: { metrics: { sales: -1, coverage: -1 } },
    options: [
      { id: "counter_promo", label: "Ответная ценовая кампания", cost: { capital: 6 }, effects: { metrics: { sales: 1 } }, fitsWhen: ["highCapital", "lowSales"] },
      { id: "service_moat", label: "Укрепить сервис как отличие", cost: { capital: 4 }, effects: { metrics: { nps: 1 } }, fitsWhen: ["lowNps", "anyReasonable"] },
      acceptOption(),
    ],
  },
  {
    id: "defitsit_kadrov",
    title: "Кадровый дефицит",
    description: "Рынок труда перегрет: людей не хватает по всему дивизиону, нагрузка на команды растёт.",
    scope: "global", weight: 2, durationWeeks: 4,
    tickPenalty: { resources: { staff: -1 } },
    options: [
      { id: "raise", label: "Поднять условия и удержать людей", cost: { capital: 5 }, effects: { resources: { staff: 1 } }, fitsWhen: ["highCapital", "lowStaff"] },
      { id: "rotate", label: "Ротация и совмещение ролей", effects: { metrics: { nps: -1 } }, fitsWhen: ["lowCapital"], weak: true },
      acceptOption(),
    ],
  },
  {
    id: "sboy_it_platformy",
    title: "Сбой ИТ-платформы",
    description: "Падение учётной системы в РРС: день торговли частично потерян.",
    scope: "local", weight: 3, durationWeeks: 1,
    tickPenalty: { metrics: { sales: -2 } },
    options: [
      { id: "hotfix", label: "Ночной хотфикс с командой ИТ", cost: { capital: 3 }, effects: {}, fitsWhen: ["hasTech", "highCapital"] },
      { id: "paper", label: "Торговать по бумажной схеме", cost: { staff: 1 }, effects: { metrics: { nps: -1 } }, fitsWhen: ["hasStaff"], weak: true },
      acceptOption(),
    ],
  },
  {
    id: "arenda_x2",
    title: "Пересмотр аренды",
    description: "Арендодатель ключевых площадей РРС поднимает ставку вдвое.",
    scope: "local", weight: 2, durationWeeks: 6,
    tickPenalty: { resources: { capital: -2 } },
    options: [
      { id: "renegotiate", label: "Переторговать договор с юристами", cost: { capital: 3 }, effects: {}, fitsWhen: ["highCapital"] },
      { id: "move", label: "Готовить переезд точки", cost: { capital: 5, staff: 1 }, effects: { metrics: { coverage: -1 } }, fitsWhen: ["hasStaff"], weak: true },
      acceptOption("Платить новую ставку"),
    ],
  },
  {
    id: "marketpleis_demping",
    title: "Демпинг маркетплейсов",
    description: "Онлайн-площадки уронили цены на ключевые категории по всей стране.",
    scope: "global", weight: 3, durationWeeks: 3,
    tickPenalty: { metrics: { sales: -1 } },
    options: [
      { id: "match", label: "Выровнять цены по корзине-индикатору", cost: { capital: 4 }, effects: {}, fitsWhen: ["highCapital"] },
      { id: "value_add", label: "Продавать экспертизой и сервисом", cost: { staff: 1 }, effects: { metrics: { nps: 1 } }, fitsWhen: ["hasStaff", "anyReasonable"] },
      acceptOption(),
    ],
  },
  {
    id: "blokirovka_reklamy",
    title: "Блокировка рекламных каналов",
    description: "Ключевые рекламные площадки недоступны: охват кампаний падает.",
    scope: "global", weight: 2, durationWeeks: 2,
    tickPenalty: { metrics: { coverage: -1 } },
    options: [
      { id: "alt_channels", label: "Перекинуть бюджеты в новые каналы", cost: { capital: 4 }, effects: { metrics: { coverage: 1 } }, fitsWhen: ["highCapital", "lowCoverage"] },
      { id: "local_marketing", label: "Локальный маркетинг силами команд", cost: { staff: 1 }, effects: {}, fitsWhen: ["hasStaff"] },
      acceptOption(),
    ],
  },
];

const SWAN_BY_ID = new Map(BLACK_SWANS.map((s) => [s.id, s]));
export function getSwan(id: string): BlackSwanDef | undefined {
  return SWAN_BY_ID.get(id);
}
