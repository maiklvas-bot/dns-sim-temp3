/**
 * ЗРД v2 — каталог миссий (спека §5). Миссия = KPI-цель с поквартальной лестницей:
 * в авто-режиме цель квартала берётся из quarterTargets, в ручном оценщик выбирает
 * набор миссий из каталога. weight — бонус к ТР за достижение финальной цели.
 */
import type { MissionDef } from "./match-types";

export const MISSION_CATALOG: MissionDef[] = [
  { id: "m_sales_growth", label: "Разогнать продажи", kpi: "sales_growth", quarterTargets: [30, 45, 60, 75], weight: 4 },
  { id: "m_sales_hold", label: "Удержать выручку", kpi: "sales_growth", quarterTargets: [25, 35, 45, 55], weight: 2 },
  { id: "m_coverage_expand", label: "Расширить покрытие рынка", kpi: "market_coverage", quarterTargets: [25, 40, 55, 70], weight: 4 },
  { id: "m_coverage_hold", label: "Удержать долю территории", kpi: "market_coverage", quarterTargets: [20, 30, 40, 50], weight: 2 },
  { id: "m_service_lead", label: "Сервис — лидерство DNS", kpi: "service_level", quarterTargets: [30, 45, 60, 75], weight: 4 },
  { id: "m_service_base", label: "Держать базовый сервис", kpi: "service_level", quarterTargets: [25, 35, 45, 55], weight: 2 },
  { id: "m_efficiency", label: "Выйти на эффективность", kpi: "efficiency", quarterTargets: [50, 58, 66, 74], weight: 3 },
  { id: "m_logistics", label: "Отстроить логистику", kpi: "logistics", quarterTargets: [45, 55, 65, 75], weight: 3 },
  { id: "m_staffing", label: "Укомплектовать команды", kpi: "staffing", quarterTargets: [50, 60, 70, 80], weight: 3 },
  { id: "m_race_flag", label: "Флаг на территории: продажи + покрытие", kpi: "sales_growth", quarterTargets: [35, 50, 65, 80], weight: 5 },
];

const MISSION_BY_ID = new Map(MISSION_CATALOG.map((m) => [m.id, m]));
export function getMission(id: string): MissionDef | undefined {
  return MISSION_BY_ID.get(id);
}
