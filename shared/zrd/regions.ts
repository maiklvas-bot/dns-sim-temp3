/**
 * ЗРД — РРС Дивизиона Урал (12). Используется в лобби игрока и кабинете оценщика (Фаза 5).
 *
 * ВНИМАНИЕ: список названий — рабочий, на основе городов Урала из ТЗ
 * (docs/zrd-simulation-plan.md). Подлежит сверке с РЕАЛЬНОЙ структурой Дивизиона Урал,
 * предоставленной заказчиком (точные названия РРС). При уточнении — заменить здесь.
 *
 * difficultyHint — рекомендуемая сложность по логистике/разбросу (подсказка оценщику).
 */
export interface ZrdRrs {
  id: string;
  name: string;
  difficultyHint: 1 | 2 | 3 | 4 | 5;
}

export const ZRD_RRS: ZrdRrs[] = [
  { id: "ekb", name: "РРС Екатеринбург", difficultyHint: 1 },
  { id: "chelyabinsk", name: "РРС Челябинск", difficultyHint: 2 },
  { id: "perm", name: "РРС Пермь", difficultyHint: 2 },
  { id: "tyumen", name: "РРС Тюмень", difficultyHint: 3 },
  { id: "nizhny-tagil", name: "РРС Нижний Тагил", difficultyHint: 2 },
  { id: "magnitogorsk", name: "РРС Магнитогорск", difficultyHint: 3 },
  { id: "kurgan", name: "РРС Курган", difficultyHint: 3 },
  { id: "kamensk-uralsky", name: "РРС Каменск-Уральский", difficultyHint: 2 },
  { id: "surgut", name: "РРС Сургут", difficultyHint: 4 },
  { id: "nizhnevartovsk", name: "РРС Нижневартовск", difficultyHint: 4 },
  { id: "khanty-mansiysk", name: "РРС Ханты-Мансийск", difficultyHint: 4 },
  { id: "novy-urengoy", name: "РРС Новый Уренгой", difficultyHint: 5 },
];

export function getRrsById(id: string): ZrdRrs | undefined {
  return ZRD_RRS.find((r) => r.id === id);
}
