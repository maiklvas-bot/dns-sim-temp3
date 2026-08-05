/**
 * ЗРД v2 — 4 сценария партии (спека §6). Сценарий задаёт режим победы по умолчанию,
 * частоту лебедей, авто-набор миссий, веса колод при доборе и правку старта поверх сложности.
 */
import type { ScenarioDef, ScenarioId } from "./match-types";

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  conquest: {
    id: "conquest",
    title: "Покорение новых территорий",
    tagline: "Основной сценарий: сбалансированный рост дивизиона",
    winModeDefault: "year",
    swanFrequencyDefault: "standard",
    missionIds: ["m_sales_growth", "m_coverage_expand", "m_service_lead"],
    keyMissionId: "m_coverage_expand",
    deckWeights: { promo: 1, service: 1, logistics: 1, goods: 1, staff: 1, projects: 1 },
  },
  crisis: {
    id: "crisis",
    title: "Антикризисный год",
    tagline: "Управление в шторм: удержать регион на плаву",
    winModeDefault: "year",
    swanFrequencyDefault: "storm",
    missionIds: ["m_sales_hold", "m_coverage_hold", "m_service_base", "m_staffing"],
    keyMissionId: "m_sales_hold",
    deckWeights: { promo: 1, service: 1.4, logistics: 1.2, goods: 1, staff: 1.4, projects: 0.6 },
    startTweak: { resources: { capital: -8 }, metrics: { nps: -1 } },
  },
  race: {
    id: "race",
    title: "Гонка за лидером",
    tagline: "Кто первым водрузит флаг: скорость решает",
    winModeDefault: "race",
    swanFrequencyDefault: "rare",
    missionIds: ["m_race_flag", "m_sales_growth", "m_coverage_expand"],
    keyMissionId: "m_race_flag",
    deckWeights: { promo: 1.4, service: 0.8, logistics: 1, goods: 1.2, staff: 0.8, projects: 1.2 },
  },
  efficiency: {
    id: "efficiency",
    title: "Операционная эффективность",
    tagline: "Выжать максимум из ограниченных ресурсов",
    winModeDefault: "year",
    swanFrequencyDefault: "standard",
    missionIds: ["m_efficiency", "m_logistics", "m_sales_hold"],
    keyMissionId: "m_efficiency",
    deckWeights: { promo: 0.7, service: 1, logistics: 1.5, goods: 1.5, staff: 1, projects: 0.8 },
    startTweak: { resources: { capital: -6 } },
  },
};

export const SCENARIO_IDS: ScenarioId[] = ["conquest", "crisis", "race", "efficiency"];
