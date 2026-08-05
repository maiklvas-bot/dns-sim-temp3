/**
 * Симуляция ЗРД — скоринг компетенций (Фаза 1, валидность проверяется в Фазе 2).
 * Принцип §8a: компетенция считается по УМЕСТНОСТИ выбора к контексту
 * (option.fitsWhen ∩ ctxTags состояния в момент действия), а не по тексту.
 */
import type { ZrdState, CompetencyScores, CompetencyKey } from "./types";
import { COMPETENCY_KEYS, METRIC_KEYS } from "./types";
import { EVENT_CARDS, getCardById } from "./content";

function zero(): Record<CompetencyKey, number> {
  return COMPETENCY_KEYS.reduce((a, k) => { a[k] = 0; return a; }, {} as Record<CompetencyKey, number>);
}

/** raw → 0..5: raw=0 ≈ 1.0 (слабо, но не ноль), raw=expMax ≈ 5.0; отрицательное → к 0. */
// Откалибровано (Фаза 2, 30 seed, L3): balanced ≈ 3.0, weak низко, planner/strong высоко.
const EXPECTED_MAX: Record<CompetencyKey, number> = {
  planning: 9, goal_setting: 4, decision_making: 14, analytical: 4,
  flexibility: 9, communication: 7, result_orientation: 8, team_motivation: 4,
  critical_thinking: 6, initiative: 5, conflict_management: 5, strategic_vision: 8,
};

function normalize(raw: Record<CompetencyKey, number>): CompetencyScores {
  const out = {} as CompetencyScores;
  for (const k of COMPETENCY_KEYS) {
    const score = 1 + (raw[k] / EXPECTED_MAX[k]) * 4;
    out[k] = Math.round(Math.max(0, Math.min(5, score)) * 10) / 10;
  }
  return out;
}

export function computeCompetencies(state: ZrdState): CompetencyScores {
  return normalize(computeRaw(state));
}

/** «Сырые» сигналы до нормализации — для калибровки шкалы (Фаза 2). */
export function computeRaw(state: ZrdState): Record<CompetencyKey, number> {
  const raw = zero();
  const log = state.log;
  const p = state.player;
  const t = state.diff.earlyWinTargets;

  let cardsPlayed = 0, longTermPlayed = 0, strategicPlayed = 0, hrPlayed = 0, itPlayed = 0, dataViews = 0, stdActions = 0, earlyEngine = 0;
  const categories = new Set<string>();
  let eventGood = 0, eventWeak = 0;
  let lowCapitalQuarters = 0;
  let keepEntries = 0, keepCounts = 0;

  for (const e of log) {
    if (e.type === "play_card") {
      const c = getCardById(e.choiceId || e.detail);
      if (c) {
        cardsPlayed++; categories.add(c.category);
        if (c.longTerm) longTermPlayed++;
        if (c.category === "strategic") strategicPlayed++;
        if (c.category === "hr") hrPlayed++;
        if (c.category === "it") itPlayed++;
        // раннее построение движка (доход/долгосрочные карты в Q1–Q2) — сигнал планирования
        if (e.quarter <= 2 && (c.longTerm || (c.effects.resourceProd?.capital ?? 0) > 0)) earlyEngine++;
      }
    }
    if (e.type === "standard" && e.choiceId === "view_data") dataViews++;
    else if (e.type === "standard") stdActions++;
    if (e.type === "keep") { keepEntries++; keepCounts += Number(e.choiceId || 0); }
    if (e.type === "production" && e.resources && e.resources.capital < 6) lowCapitalQuarters++;
    if (e.type === "event") {
      const [evId, optId] = (e.detail || "").split(":");
      const ev = EVENT_CARDS.find((x) => x.id === evId);
      const opt = ev?.options.find((o) => o.id === optId);
      if (ev && opt) {
        const fit = (opt.fitsWhen || []).some((tag) => (e.ctxTags || []).includes(tag));
        if (fit) eventGood++; else if (opt.weak) eventWeak++;
        for (const comp of ev.competencies) raw[comp] += fit ? 2 : opt.weak ? -0.5 : 0.5;
        raw.decision_making += fit ? 1 : opt.weak ? -0.5 : 0.2;
        if (evId === "turnover") raw.team_motivation += optId === "train" ? 1.5 : optId === "audit" ? 0.5 : -0.5;
        if (evId === "store_conflict") {
          raw.conflict_management += optId === "meeting" ? 1.5 : optId === "decree" ? 0 : -1;
          raw.communication += optId === "meeting" ? 1 : 0;
        }
        if (evId === "competitor") raw.strategic_vision += fit ? 1 : 0;
        if (evId === "logistics_fail" || evId === "market_swing") raw.flexibility += fit ? 1 : 0;
      }
    }
  }

  // Планирование: раннее построение движка + построенный доход + активность + дисциплина добора.
  // НЕ награждаем накопление капитала как таковое (скопидомство ≠ планирование).
  const activity = cardsPlayed + stdActions;
  raw.planning += earlyEngine * 1.2;                              // ранний движок (главный сигнал)
  raw.planning += Math.min(2, p.resourceProd.capital * 0.22);     // построенный доход-движок
  raw.planning += Math.min(1.5, activity * 0.2);                  // активность
  const avgKeep = keepEntries ? keepCounts / keepEntries : 0;
  raw.planning += avgKeep >= 1 && avgKeep <= 2.5 ? 0.8 : 0.2;     // разумный добор

  // Инициативность: проактивность
  raw.initiative += Math.min(3, cardsPlayed * 0.5) + (p.declaredStrategy ? 1 : 0) + strategicPlayed * 0.5;

  // Аналитическое мышление: использование данных + IT
  raw.analytical += Math.min(2.5, dataViews * 0.8) + (itPlayed >= 1 ? 1 : 0);

  // Стратегическое видение: долгосрочность + охват категорий + сбалансированность
  raw.strategic_vision += longTermPlayed * 0.6 + (categories.size >= 3 ? 1.5 : 0.4);
  const spread = Math.max(p.metrics.sales, p.metrics.nps, p.metrics.coverage) - Math.min(p.metrics.sales, p.metrics.nps, p.metrics.coverage);
  raw.strategic_vision += Math.max(0, 5 - spread) * 0.2;

  // Ориентация на результат: прогресс к целям
  const prog = METRIC_KEYS.reduce((a, k) => a + Math.min(1, p.metrics[k] / Math.max(1, t[k])), 0) / 3;
  raw.result_orientation += prog * 4;

  // Постановка цели: декларация + консистентность действий стратегии
  if (p.declaredStrategy) {
    raw.goal_setting += 1;
    let consistent = 0, total = 0;
    for (const e of log) {
      if (e.type !== "play_card") continue;
      const c = getCardById(e.choiceId || e.detail); if (!c) continue;
      total++;
      if (p.declaredStrategy === "service" && (c.category === "hr" || c.effects.metrics?.nps != null || c.effects.metricProd?.nps != null)) consistent++;
      if (p.declaredStrategy === "expansion" && (c.category === "infra" || c.effects.metrics?.coverage != null)) consistent++;
      if (p.declaredStrategy === "efficiency" && (c.effects.resourceProd != null || c.longTerm)) consistent++;
    }
    raw.goal_setting += total ? (consistent / total) * 3 : 0;
  }

  // Мотивация и построение команды: HR-вложения (+ событие turnover выше)
  raw.team_motivation += hrPlayed * 0.8;

  // Критическое мышление: избегание слабых вариантов
  raw.critical_thinking += Math.max(0, 2 - eventWeak) + (eventGood > 0 ? 1 : 0);

  // Коммуникация: базовый уровень (в solo слабо наблюдаема; событие conflict выше)
  raw.communication += 1;

  return raw;
}
