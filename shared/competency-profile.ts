/**
 * Два уровня компетенций: чем меряем и что показываем.
 *
 * Симуляция меряет поведение дробно — отдельно планирование, отдельно контроль,
 * отдельно делегирование. Так устроены кейсы, и так дебрифинг может сказать
 * «вот три ваших решения по делегированию», а не «у вас просела организация
 * и контроль» — второе слишком широко, чтобы с этим что-то делать.
 *
 * Комиссия же работает с профилем выпускника: четырнадцать компетенций в трёх
 * блоках. Поэтому измерения сворачиваются в профиль здесь, а не переразметкой
 * кейсов: 225 вариантов ответа остаются как есть.
 */

/** Компетенция профиля выпускника «Космонавтики». */
export interface ProfileCompetency {
  id: string;
  number: number;
  name: string;
  block: "knowledge" | "skills" | "personal";
  /** Чем меряется в симуляции. Пусто — значит симуляцией не меряется. */
  measuredBy: string[];
  /** Если симуляцией не меряется — где оценивается на самом деле. */
  assessedElsewhere?: "debrief" | "commission" | "no_cases_yet";
}

export const PROFILE_COMPETENCIES: ProfileCompetency[] = [
  // ── Знания ──
  {
    id: "mgmt_basics",
    number: 1,
    name: "Основы менеджмента",
    block: "knowledge",
    measuredBy: ["management_basics"],
  },
  {
    id: "business_processes_profile",
    number: 2,
    name: "Бизнес-процессы",
    block: "knowledge",
    measuredBy: ["business_processes"],
  },
  {
    id: "finance_metrics",
    number: 3,
    name: "Финансовые показатели филиала",
    block: "knowledge",
    // Меряется кейсом, где показатели надо прочитать и принять по ним решение.
    // Таких кейсов пока нет.
    measuredBy: [],
    assessedElsewhere: "no_cases_yet",
  },
  {
    id: "staff_roles",
    number: 4,
    name: "Задачи сотрудников магазина",
    block: "knowledge",
    // Видно по тому, кому человек поручает работу: кассиру задачу кладовщика
    // ставит только тот, кто не знает обязанностей. Кейсов пока нет.
    measuredBy: [],
    assessedElsewhere: "no_cases_yet",
  },
  {
    id: "company_ideology",
    number: 5,
    name: "Идеология Компании",
    block: "knowledge",
    // Проверяется тем, что человек говорит на комиссии, а не выбором варианта.
    measuredBy: [],
    assessedElsewhere: "commission",
  },

  // ── Умения ──
  {
    id: "org_control",
    number: 6,
    name: "Организация и контроль работы",
    block: "skills",
    measuredBy: ["planning", "control", "delegation"],
  },
  {
    id: "systems_thinking",
    number: 7,
    name: "Системность мышления",
    block: "skills",
    measuredBy: ["systems_thinking"],
  },
  {
    id: "communication_profile",
    number: 8,
    name: "Коммуникабельность",
    block: "skills",
    measuredBy: ["communication", "stress_resistance"],
  },
  {
    id: "staff_motivation",
    number: 9,
    name: "Мотивация сотрудников",
    block: "skills",
    measuredBy: ["staff_motivation"],
    assessedElsewhere: "no_cases_yet",
  },
  {
    id: "staff_training",
    number: 10,
    name: "Обучение сотрудников",
    block: "skills",
    measuredBy: ["staff_training"],
    assessedElsewhere: "no_cases_yet",
  },

  // ── Личностные качества ──
  {
    id: "self_awareness",
    number: 11,
    name: "Объективная самооценка",
    block: "personal",
    // Симуляция этого не видит: человек в ней действует, а не оценивает себя.
    // Зато видно на дебрифинге — по разнице между самооценкой и профилем.
    measuredBy: [],
    assessedElsewhere: "debrief",
  },
  {
    id: "flexibility_profile",
    number: 12,
    name: "Гибкость поведения",
    block: "personal",
    measuredBy: ["flexibility"],
  },
  {
    id: "learning_motivation",
    number: 13,
    name: "Личная мотивация к обучению и новым обязанностям",
    block: "personal",
    // «Зачем вам эта должность» кейсом не спросишь.
    measuredBy: [],
    assessedElsewhere: "commission",
  },
  {
    id: "result_focus",
    number: 14,
    name: "Направленность на результат",
    block: "personal",
    measuredBy: ["result_orientation", "responsibility"],
  },
];

/**
 * Компетенции, провал по которым не закрывается суммой остальных.
 *
 * Порог 2.0 из 5. При 2.5 доля людей с флагом та же, но флагов на одного
 * человека больше, и подробный разбор перестаёт помещаться в 15–20 минут.
 */
export const CRITICAL_COMPETENCIES = [
  "planning",
  "control",
  "responsibility",
  "communication",
  "result_orientation",
] as const;

export const CRITICAL_THRESHOLD = 2.0;

/** Компетенции симуляции, которые в профиль не входят: нужны кейсам для правдоподобия. */
export const OUT_OF_PROFILE_COMPETENCIES = ["legal_basics", "it_tools", "product_knowledge"] as const;

/** Свернуть измерения симуляции в профиль выпускника. */
export function buildProfileScores(
  measured: Record<string, number>,
): Array<{ competency: ProfileCompetency; score: number | null; parts: Array<{ id: string; score: number }> }> {
  return PROFILE_COMPETENCIES.map((competency) => {
    const parts = competency.measuredBy
      .filter((id) => typeof measured[id] === "number")
      .map((id) => ({ id, score: Number(measured[id]) }));
    // Пустой профильный балл честнее нуля: ноль читается как «провалил»,
    // хотя на деле это «не измеряли».
    const score = parts.length > 0
      ? parts.reduce((sum, part) => sum + part.score, 0) / parts.length
      : null;
    return { competency, score, parts };
  });
}

/** Сработавшие красные флаги: критичные компетенции ниже порога. */
export function findRedFlags(measured: Record<string, number>): Array<{ id: string; score: number }> {
  return CRITICAL_COMPETENCIES
    .filter((id) => typeof measured[id] === "number" && Number(measured[id]) < CRITICAL_THRESHOLD)
    .map((id) => ({ id, score: Number(measured[id]) }));
}
