import type { RealisticMetrics } from "@/context/SimulationContext";

export const STORE_METRIC_LABELS: Record<keyof RealisticMetrics, string> = {
  customersInStore: "Торг. зал / покупатели",
  avgCheck: "Клиенты / средний чек",
  conversion: "Торг. зал / конверсия",
  nps: "Клиенты / оценка",
  pickupSpeed: "Выдача / скорость",
  warehouseLoad: "Склад / загрузка",
  teamMorale: "Команда / мораль",
  dailyRevenue: "Финансы / выручка",
};

export const STORE_METRIC_HELPERS: Partial<Record<keyof RealisticMetrics, string>> = {
  avgCheck: "₽",
  conversion: "%",
  pickupSpeed: "мин",
  warehouseLoad: "%",
  dailyRevenue: "тыс. ₽",
};

export const STORE_STATE_PRESETS: Array<{
  id: string;
  title: string;
  summary: string;
  metrics: RealisticMetrics;
}> = [
  {
    id: "calm",
    title: "Уровень 1: спокойный старт",
    summary: "Зал под контролем, склад разгружен, команда уверена.",
    metrics: {
      customersInStore: 12,
      avgCheck: 7600,
      conversion: 54,
      nps: 4.6,
      pickupSpeed: 8,
      warehouseLoad: 34,
      teamMorale: 8.2,
      dailyRevenue: 1900,
    },
  },
  {
    id: "standard",
    title: "Уровень 2: рабочая смена",
    summary: "Нормальная нагрузка без явных провалов, базовый рабочий ритм.",
    metrics: {
      customersInStore: 18,
      avgCheck: 7200,
      conversion: 48,
      nps: 3.8,
      pickupSpeed: 16,
      warehouseLoad: 44,
      teamMorale: 6.8,
      dailyRevenue: 1800,
    },
  },
  {
    id: "attention",
    title: "Уровень 3: зона внимания",
    summary: "Есть узкие места, но магазин ещё удерживается в рабочем контуре.",
    metrics: {
      customersInStore: 24,
      avgCheck: 6700,
      conversion: 42,
      nps: 3.2,
      pickupSpeed: 21,
      warehouseLoad: 58,
      teamMorale: 5.6,
      dailyRevenue: 1500,
    },
  },
  {
    id: "stress",
    title: "Уровень 4: напряжение",
    summary: "Просели ключевые зоны, решения студента уже сильно влияют на исход смены.",
    metrics: {
      customersInStore: 30,
      avgCheck: 6100,
      conversion: 35,
      nps: 2.6,
      pickupSpeed: 27,
      warehouseLoad: 72,
      teamMorale: 4.7,
      dailyRevenue: 1200,
    },
  },
  {
    id: "critical",
    title: "Уровень 5: критический старт",
    summary: "Магазин входит в смену из проблемного состояния, нужен сильный управленческий ответ.",
    metrics: {
      customersInStore: 38,
      avgCheck: 5400,
      conversion: 30,
      nps: 1.9,
      pickupSpeed: 34,
      warehouseLoad: 86,
      teamMorale: 3.6,
      dailyRevenue: 900,
    },
  },
];
