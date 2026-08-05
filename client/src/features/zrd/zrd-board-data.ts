/**
 * ЗРД — данные board-view (Фаза 4: визуальный шелл по макету пользователя).
 * Часть значений выводится из движка (ресурсы/показатели), часть — витринные (showcase)
 * до углубления механики: 6 KPI, миссия, активные проекты, действия-глаголы, 4 РРС.
 */
import { BRAND_ASSETS } from "@/lib/brand-assets";
import type { PublicZrdState } from "@shared/zrd/engine";
import type { CardCategory } from "@shared/zrd/types";
import { Boxes, Lightbulb, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── 4 РРС Дивизиона Урал (структура из макета) ─────────────────────────────
export interface ZrdRrsRegion {
  id: string;
  name: string;
  cities: string[];
  accent: string;
  mascot: string;
}

export const ZRD_DIVISION_RRS: ZrdRrsRegion[] = [
  { id: "ekb", name: "РРС Екатеринбург", accent: "#FF6B00", mascot: BRAND_ASSETS.heroes.alienPoint,
    cities: ["Екатеринбург", "Каменск-Уральский", "Нижний Тагил", "Первоуральск"] },
  { id: "perm", name: "РРС Пермь", accent: "#4ea8de", mascot: BRAND_ASSETS.heroes.alienObserve,
    cities: ["Пермь", "Березники", "Соликамск", "Чайковский"] },
  { id: "chel", name: "РРС Челябинск", accent: "#b48cff", mascot: BRAND_ASSETS.heroes.alienIdea,
    cities: ["Челябинск", "Магнитогорск", "Златоуст", "Копейск"] },
  { id: "tmn", name: "РРС Тюмень", accent: "#34c3a8", mascot: BRAND_ASSETS.heroes.alienWorkPc,
    cities: ["Тюмень", "Тобольск", "Ирбит", "Туринск", "Тавда"] },
];

// ── 6 KPI региона (сводно по 4 РРС) ────────────────────────────────────────
export interface ZrdKpi { id: string; label: string; value: number; delta: number; color: string; derived: boolean }

const pct = (v: number, max = 20) => Math.round((v / max) * 100);

export function buildKpis(state: PublicZrdState): ZrdKpi[] {
  const m = state.player.metrics;
  const r = state.player.resources;
  return [
    { id: "sales", label: "Рост продаж", value: pct(m.sales), delta: +3, color: "#2ec4b6", derived: true },
    { id: "market", label: "Покрытие рынка", value: pct(m.coverage), delta: +1, color: "#34c3a8", derived: true },
    { id: "efficiency", label: "Эффективность", value: Math.min(99, 60 + r.tech * 6), delta: -1, color: "#FF6B00", derived: false },
    { id: "service", label: "Уровень сервиса", value: pct(m.nps), delta: +2, color: "#4ea8de", derived: true },
    { id: "logistics", label: "Логистика", value: Math.min(99, 55 + r.warehouse * 8), delta: -2, color: "#FF6B00", derived: false },
    { id: "staff", label: "Персонал", value: Math.min(99, 60 + r.staff * 5), delta: +1, color: "#2ec4b6", derived: false },
  ];
}

// ── Колоды карт по категориям (3 стопки из 5 категорий движка) ─────────────
export interface ZrdDeck { id: string; label: string; color: string; icon: LucideIcon; categories: CardCategory[] }
export const ZRD_DECKS: ZrdDeck[] = [
  { id: "logistics", label: "Логистика", color: "#FF6B00", icon: Boxes, categories: ["infra", "it"] },
  { id: "projects", label: "Проекты", color: "#b48cff", icon: Lightbulb, categories: ["marketing", "strategic"] },
  { id: "staff", label: "Сотрудники", color: "#34c3a8", icon: Users, categories: ["hr"] },
];
export function deckForCategory(cat: CardCategory): ZrdDeck {
  return ZRD_DECKS.find((d) => d.categories.includes(cat)) ?? ZRD_DECKS[0];
}

// ── Миссия (мульти-цели, showcase) ─────────────────────────────────────────
export interface ZrdMissionGoal { label: string; value: number; done: boolean }
export function buildMission(state: PublicZrdState): { title: string; goals: ZrdMissionGoal[] } {
  const m = state.player.metrics;
  const t = state.diff.earlyWinTargets;
  return {
    title: "Развить сеть, усилить сервис и удержать лидерство DNS",
    goals: [
      { label: "Рост продаж", value: pct(m.sales), done: m.sales >= t.sales },
      { label: "Покрытие рынка", value: pct(m.coverage), done: m.coverage >= t.coverage },
      { label: "Уровень сервиса", value: pct(m.nps), done: m.nps >= t.nps },
      { label: "Логистика", value: 78, done: false },
    ],
  };
}

// ── Активные проекты (showcase до механики проектов-с-длительностью) ────────
export interface ZrdActiveProject { name: string; status: "В РАБОТЕ" | "ЗАДЕРЖКА" | "ПЛАН" }
export const ZRD_ACTIVE_PROJECTS: ZrdActiveProject[] = [
  { name: "Открытие 2 магазинов в Тюмени", status: "В РАБОТЕ" },
  { name: "Расширение склада Екатеринбург", status: "В РАБОТЕ" },
  { name: "IT-платформа для логистики", status: "ЗАДЕРЖКА" },
  { name: "Обучение управленцев", status: "В РАБОТЕ" },
  { name: "Сервисный центр Пермь", status: "ПЛАН" },
];

// ── Меню действий-глаголов (как на макете) ─────────────────────────────────
export const ZRD_ACTION_VERBS = ["Планировать", "Строить", "Развивать", "Управлять", "Анализировать"];

// ── Показатели региона (нижний-правый блок, derived + showcase) ────────────
export function buildRegionStats(state: PublicZrdState): { label: string; value: string }[] {
  const m = state.player.metrics;
  return [
    { label: "Сеть магазинов", value: String(40 + m.coverage * 2) },
    { label: "Уровень сервиса", value: `${pct(m.nps)}%` },
    { label: "Доля онлайн", value: "48%" },
    { label: "Укомплектованность", value: `${Math.min(99, 60 + state.player.resources.staff * 5)}%` },
    { label: "Доля рынка (сводно)", value: `${pct(m.coverage)}%` },
  ];
}
