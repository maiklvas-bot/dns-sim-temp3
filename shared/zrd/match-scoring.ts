/**
 * ЗРД v2 — скоринг 12 компетенций по логу места (принцип §8a соло-вики:
 * оцениваем УМЕСТНОСТЬ выбора к контексту ctxTags, а не текст решения).
 * Сигналы: карты (competencyTags, тиры, длительность), дилеммы, реакции на лебедей,
 * дисциплина данных, прогресс миссий. Нормализация raw → 0..5.
 */
import type { CompetencyKey, CompetencyScores } from "./types";
import { COMPETENCY_KEYS } from "./types";
import { EVENT_CARDS } from "./content";
import type { MatchConfig, SeatState } from "./match-types";
import { getMatchCard } from "./content-decks";
import { getSwan } from "./content-swans";
import { getMission } from "./content-missions";
import { computeKpi } from "./kpi";

function zero(): Record<CompetencyKey, number> {
  return COMPETENCY_KEYS.reduce((a, k) => { a[k] = 0; return a; }, {} as Record<CompetencyKey, number>);
}

/** ожидаемые максимумы raw-сигналов (откалибровано по дампу tmp/zrd-raw-debug: ИИ-5 ≈ 3.2, ИИ-1 ≈ 2.6) */
const EXPECTED_MAX: Record<CompetencyKey, number> = {
  planning: 6, goal_setting: 3, decision_making: 7, analytical: 3,
  flexibility: 4.5, communication: 3.5, result_orientation: 4.5, team_motivation: 3.5,
  critical_thinking: 5.5, initiative: 4, conflict_management: 2.5, strategic_vision: 6,
};

function normalize(raw: Record<CompetencyKey, number>): CompetencyScores {
  const out = {} as CompetencyScores;
  for (const k of COMPETENCY_KEYS) {
    const score = 1 + (raw[k] / EXPECTED_MAX[k]) * 4;
    out[k] = Math.round(Math.max(0, Math.min(5, score)) * 10) / 10;
  }
  return out;
}

export function computeSeatCompetencies(seat: SeatState, config: MatchConfig): CompetencyScores {
  return normalize(computeSeatRaw(seat, config));
}

/** «Сырые» сигналы до нормализации — для калибровки шкалы */
export function computeSeatRaw(seat: SeatState, config: MatchConfig): Record<CompetencyKey, number> {
  const raw = zero();
  let cardsPlayed = 0;
  let dataViews = 0;
  let weakChoices = 0;
  let goodChoices = 0;
  const decksUsed = new Set<string>();

  for (const e of seat.log) {
    if (e.type === "play_card") {
      const c = getMatchCard(e.choiceId ?? e.detail);
      if (!c) continue;
      cardsPlayed++;
      decksUsed.add(c.deck);
      for (const tag of c.competencyTags) raw[tag] += 0.6;
      if (c.tier === 3) raw.strategic_vision += 0.3;
      if (c.durationWeeks >= 4) { raw.planning += 0.35; raw.strategic_vision += 0.2; }
      // ранний движок: длительные/производственные вложения в первой трети года
      if (e.quarter <= 4 && (c.durationWeeks >= 4 || c.effects.resourceProd)) raw.planning += 0.5;
    }
    if (e.type === "standard" && e.choiceId === "view_data") dataViews++;
    if (e.type === "event") {
      const parts = (e.detail || "").split(":");
      if (parts[0] === "swan") {
        // реакция на чёрного лебедя: гибкость + решительность; уместность по fitsWhen
        const def = getSwan(parts[1]);
        const opt = def?.options.find((o) => o.id === parts[2]);
        if (def && opt) {
          raw.initiative += 0.4;
          const fit = (opt.fitsWhen ?? []).some((t) => (e.ctxTags ?? []).includes(t));
          raw.flexibility += fit ? 1.5 : 0.5;
          raw.decision_making += fit ? 1 : 0.2;
          if (opt.weak) { raw.flexibility -= 0.5; weakChoices++; } else if (fit) goodChoices++;
        }
      } else {
        // квартальная дилемма (словарь соло-событий)
        const ev = EVENT_CARDS.find((x) => x.id === parts[0]);
        const opt = ev?.options.find((o) => o.id === parts[1]);
        if (ev && opt) {
          const fit = (opt.fitsWhen ?? []).some((t) => (e.ctxTags ?? []).includes(t));
          if (fit) goodChoices++; else if (opt.weak) weakChoices++;
          for (const comp of ev.competencies) raw[comp] += fit ? 2 : opt.weak ? -0.5 : 0.5;
          raw.decision_making += fit ? 1 : opt.weak ? -0.5 : 0.2;
        }
      }
    }
  }

  // Планирование: активность + дисциплина (не всё в один тип)
  raw.planning += Math.min(1.5, cardsPlayed * 0.15);

  // Аналитика: просмотр данных перед ходами
  raw.analytical += Math.min(2.5, dataViews * 0.8);

  // Стратегическое видение: разнообразие направлений
  raw.strategic_vision += decksUsed.size >= 4 ? 1.5 : decksUsed.size >= 2 ? 0.6 : 0;

  // Ориентация на результат: прогресс KPI к целям миссий
  const kpi = computeKpi(seat);
  let progress = 0;
  let missions = 0;
  for (const mid of config.missionIds) {
    const m = getMission(mid);
    if (!m) continue;
    missions++;
    progress += Math.min(1, kpi[m.kpi] / m.quarterTargets[3]);
  }
  raw.result_orientation += missions ? (progress / missions) * 4 : 0;

  // Постановка цели: закрытые миссии
  const done = Object.values(seat.missionDone).filter(Boolean).length;
  raw.goal_setting += done * 1.2 + (missions && progress / missions > 0.5 ? 1 : 0);

  // Инициативность: проактивность (разыгранные карты)
  raw.initiative += Math.min(2.5, cardsPlayed * 0.3);

  // Критическое мышление: избегание слабых вариантов + доля уместных решений
  raw.critical_thinking += Math.max(0, 2 - weakChoices) + Math.min(2, goodChoices * 0.5);

  // Коммуникация: в текущем наблюдении слабо измерима — базовый уровень
  // (усиление — мультиплеерные сигналы, шаг 2)
  raw.communication += 1;

  return raw;
}
