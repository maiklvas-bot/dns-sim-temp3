/**
 * ЗРД — презентационная мета для UI (Фаза 4): подписи, цвета, иконки ресурсов/показателей/
 * категорий карт/стратегий + перевод эффектов карт в человекочитаемые «чипы».
 * Источник данных механики — @shared/zrd/*; здесь только визуальный слой.
 */
import {
  Coins, Users, Cpu, Warehouse, Target,
  ShoppingCart, Heart, MapPin,
  Building2, GraduationCap, Megaphone, Database, Compass,
  type LucideIcon,
} from "lucide-react";
import type { ResourceKey, MetricKey, CardCategory, StrategyKey, Effects } from "@shared/zrd/types";

export const RESOURCE_META: Record<ResourceKey, { label: string; short: string; icon: LucideIcon; color: string }> = {
  capital: { label: "Капитал", short: "К", icon: Coins, color: "#FF6B00" },
  staff: { label: "Персонал", short: "П", icon: Users, color: "#2ec4b6" },
  tech: { label: "Технологии", short: "Т", icon: Cpu, color: "#4ea8de" },
  warehouse: { label: "Склады", short: "С", icon: Warehouse, color: "#b48cff" },
  market: { label: "Потенциал рынка", short: "Р", icon: Target, color: "#ffb703" },
};

export const METRIC_META: Record<MetricKey, { label: string; short: string; icon: LucideIcon; color: string; theme: string }> = {
  sales: { label: "Продажи", short: "S", icon: ShoppingCart, color: "#ff7a1a", theme: "Кислород региона" },
  nps: { label: "NPS", short: "N", icon: Heart, color: "#34c3a8", theme: "Температура лояльности" },
  coverage: { label: "Охват", short: "O", icon: MapPin, color: "#5b9bd5", theme: "Океаны присутствия" },
};

export const CATEGORY_META: Record<CardCategory, { label: string; icon: LucideIcon; color: string }> = {
  infra: { label: "Инфраструктура", icon: Building2, color: "#FF6B00" },
  hr: { label: "Персонал", icon: GraduationCap, color: "#2ec4b6" },
  marketing: { label: "Маркетинг", icon: Megaphone, color: "#ffb703" },
  it: { label: "IT", icon: Database, color: "#4ea8de" },
  strategic: { label: "Стратегия", icon: Compass, color: "#b48cff" },
};

export const STRATEGY_META: Record<StrategyKey, { label: string; tagline: string; bonus: string; color: string; icon: LucideIcon }> = {
  service: { label: "Сервис", tagline: "Лояльность клиентов превыше всего", bonus: "+1 ТР за каждый NPS сверх порога", color: "#34c3a8", icon: Heart },
  expansion: { label: "Экспансия", tagline: "Захват территории и присутствие", bonus: "+1 ТР за каждый Охват сверх порога", color: "#FF6B00", icon: MapPin },
  efficiency: { label: "Эффективность", tagline: "Сильный движок и резерв ресурсов", bonus: "+2 ТР за резерв ресурсов ≥ 30", color: "#4ea8de", icon: Cpu },
};

export interface EffectChip { text: string; positive: boolean }

const METRIC_SHORT: Record<MetricKey, string> = { sales: "Продажи", nps: "NPS", coverage: "Охват" };
const RES_SHORT: Record<ResourceKey, string> = { capital: "Капитал", staff: "Персонал", tech: "Технологии", warehouse: "Склады", market: "Рынок" };

/** Переводит эффекты карты/варианта в набор чипов для отображения. */
export function formatEffects(eff: Effects | undefined): EffectChip[] {
  if (!eff) return [];
  const chips: EffectChip[] = [];
  const push = (text: string, v: number) => chips.push({ text, positive: v >= 0 });
  for (const k of Object.keys(eff.metrics ?? {}) as MetricKey[]) {
    const v = eff.metrics![k]!; push(`${METRIC_SHORT[k]} ${v >= 0 ? "+" : ""}${v}`, v);
  }
  for (const k of Object.keys(eff.metricProd ?? {}) as MetricKey[]) {
    const v = eff.metricProd![k]!; push(`${METRIC_SHORT[k]} ${v >= 0 ? "+" : ""}${v}/кв`, v);
  }
  for (const k of Object.keys(eff.resourceProd ?? {}) as ResourceKey[]) {
    const v = eff.resourceProd![k]!;
    const label = k === "capital" ? "Доход" : `${RES_SHORT[k]} +произв.`;
    push(`${label} ${v >= 0 ? "+" : ""}${v}/кв`, v);
  }
  for (const k of Object.keys(eff.resources ?? {}) as ResourceKey[]) {
    const v = eff.resources![k]!; push(`${RES_SHORT[k]} ${v >= 0 ? "+" : ""}${v}`, v);
  }
  return chips;
}

/** Стоимость карты/варианта → строка «12К · 1П». */
export function formatCost(cost: Partial<Record<ResourceKey, number>> | undefined): string {
  if (!cost) return "";
  const parts: string[] = [];
  (Object.keys(cost) as ResourceKey[]).forEach((k) => {
    const v = cost[k]; if (v) parts.push(`${v}${RESOURCE_META[k].short}`);
  });
  return parts.join(" · ");
}
