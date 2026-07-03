/**
 * ЗРД v2 — 6 KPI места (0..100), детерминированно выводимых из состояния (спека §10).
 * Три «прямых» KPI = метрики движка ×5 (шкала метрик 0..20); три «производных» —
 * из ресурсов/производства/нагрузки. Никаких заглушек: всё считается из SeatState.
 */
import type { KpiId, SeatState } from "./match-types";

const clamp100 = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

export const KPI_LABEL: Record<KpiId, string> = {
  sales_growth: "Рост продаж",
  market_coverage: "Покрытие рынка",
  efficiency: "Эффективность",
  service_level: "Уровень сервиса",
  logistics: "Логистика",
  staffing: "Персонал",
};

export function computeKpi(seat: SeatState): Record<KpiId, number> {
  const r = seat.resources;
  return {
    sales_growth: clamp100(seat.metrics.sales * 5),
    market_coverage: clamp100(seat.metrics.coverage * 5),
    service_level: clamp100(seat.metrics.nps * 5),
    efficiency: clamp100(40 + r.tech * 8 + seat.incomeMonthly * 4 - seat.activeProjects.length * 2),
    logistics: clamp100(35 + r.warehouse * 9 + seat.resourceProd.warehouse * 6),
    staffing: clamp100(40 + r.staff * 7 + seat.resourceProd.staff * 8),
  };
}
