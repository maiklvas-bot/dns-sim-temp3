/**
 * Дебриф — разбор прохождения после симуляции.
 *
 * Замысел из `docs/simulation-case-master-criteria.md`, раздел 6: дебриф
 * работает не на одном кейсе, а собирает решения со всей сессии и привязывает
 * разбор к слабым местам итогового профиля компетенций.
 *
 * Смысл процедуры — не объявить баллы, а услышать от участника, почему он
 * поступил именно так. Без этого симуляция остаётся тестом: человек уходит с
 * числом, не поняв, что за ним стоит.
 */

/** Как проводится разбор. Выбирает оценщик при настройке сессии. */
export type DebriefMode =
  /** Вместе с оценщиком: нужен диалог и обе подключённые стороны. */
  | "joint"
  /** Участник разбирает решения сам. */
  | "solo";

export type DebriefStatus =
  /** Создан, но участник ещё не начал. */
  | "pending"
  /** Идёт разбор. */
  | "in_progress"
  /** Разбор завершён. */
  | "completed";

/**
 * Разбор одного решения участника.
 *
 * `answerId` ссылается на строку `session_answers` — то есть на конкретный
 * выбор в конкретном цикле кейса. Разбор идёт по всем решениям сессии, а не
 * по кейсам целиком: объяснять человек должен свой ход, а не кейс вообще.
 */
export interface DebriefReview {
  id: string;
  debriefId: string;
  answerId: number;
  /** Вопрос, на который отвечает участник. Формулировка зависит от силы выбора. */
  question: string;
  /** Объяснение участника: почему он поступил так. */
  explanation: string;
  /** Комментарий оценщика — только в совместном режиме. */
  assessorNote?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Реплика в диалоге разбора. Совместный режим. */
export interface DebriefMessage {
  id: string;
  debriefId: string;
  author: "student" | "assessor";
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Debrief {
  id: string;
  /** Прохождение, которое разбирается. */
  sessionResultId: number;
  /** Живая сессия — по ней проверяется присутствие сторон в совместном режиме. */
  liveSessionId: string | null;
  mode: DebriefMode;
  status: DebriefStatus;
  /** Вывод участника о себе по итогам разбора. */
  conclusion?: string | null;
  /** Рабочее действие на ближайшую неделю — задел на контур закрепления. */
  actionPlan?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

/**
 * Можно ли продолжать разбор прямо сейчас.
 *
 * Совместный разбор без второй стороны бессмысленен: участник будет писать
 * объяснения в пустоту, а оценщик потом читать их без возможности переспросить.
 * Поэтому при отсутствии любой из сторон разбор ставится на паузу, а не идёт
 * дальше молча.
 */
export function canContinueDebrief(
  mode: DebriefMode,
  presence: { assessorConnected: boolean; studentConnected: boolean },
): { allowed: boolean; reason?: string } {
  if (mode === "solo") {
    return { allowed: true };
  }
  if (!presence.studentConnected && !presence.assessorConnected) {
    return { allowed: false, reason: "Ни участник, ни оценщик не подключены." };
  }
  if (!presence.assessorConnected) {
    return { allowed: false, reason: "Оценщик не подключён — совместный разбор ждёт его." };
  }
  if (!presence.studentConnected) {
    return { allowed: false, reason: "Участник не подключён — совместный разбор ждёт его." };
  }
  return { allowed: true };
}

/**
 * Вопрос к решению участника.
 *
 * Формулировка зависит от того, насколько сильным был выбор: за сильный ход
 * человека спрашивают, что он увидел в ситуации, за слабый — что он взвешивал.
 * Оба вопроса заставляют объяснить собственный ход, а не угадать ожидаемый
 * ответ: «почему это правильно» участник вывел бы из самой формулировки.
 */
export function buildDebriefQuestion(input: {
  caseTitle: string;
  optionText: string;
  /** Средний уровень проявления компетенций в выбранном варианте: 1 слабо, 3 средне, 5 сильно. */
  competencyLevel: number;
}): string {
  const choice = `«${input.optionText.trim()}»`;
  if (input.competencyLevel >= 4) {
    return `В ситуации «${input.caseTitle}» вы выбрали ${choice}. Что в обстановке подсказало вам этот ход и чем вы за него заплатили?`;
  }
  if (input.competencyLevel >= 2.5) {
    return `В ситуации «${input.caseTitle}» вы выбрали ${choice}. Какие ещё варианты вы взвешивали и почему остановились на этом?`;
  }
  return `В ситуации «${input.caseTitle}» вы выбрали ${choice}. Что вы рассчитывали получить и что произошло вместо этого?`;
}

/** Средний уровень компетенций в решении — по нему подбирается формулировка вопроса. */
export function averageCompetencyLevel(competencyScores: Record<string, number>): number {
  const values = Object.values(competencyScores || {}).map(Number).filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
