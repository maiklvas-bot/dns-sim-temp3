import { Flame, Shield, Zap } from "lucide-react";
import type { RealisticMetrics } from "@/context/SimulationContext";
import type { AssessorDifficulty, AssessorSimulationRoleId } from "./assessor-types";

export const HR_TOOLTIPS: Record<AssessorDifficulty, string> = {
  easy: "Для первого прохождения. Очевидные ситуации с понятными решениями. Только звонки.",
  medium: "Стандартная оценка. Баланс сложности для типового кандидата. Звонки, почта, чат.",
  hard: "Для опытных кандидатов. Сложные ситуации с неочевидными решениями. Все каналы.",
};

export const DIFFICULTY_INFO = {
  easy: {
    icon: Shield,
    label: "Лёгкий",
    color: "#00C853",
    description: "Простые ситуации. Подходит для первого раза.",
    duration: "~20 минут",
    channels: { audio: true, email: false, messenger: false, video: false },
  },
  medium: {
    icon: Zap,
    label: "Средний",
    color: "#FFB300",
    description: "Стандартная оценка. Баланс сложности.",
    duration: "~40 минут",
    channels: { audio: true, email: true, messenger: true, video: false },
  },
  hard: {
    icon: Flame,
    label: "Сложный",
    color: "#FF1744",
    description: "Для опытных. Неочевидные решения.",
    duration: "~60 минут",
    channels: { audio: true, email: true, messenger: true, video: true },
  },
} as const;

export const DEFAULT_METRICS: RealisticMetrics = {
  customersInStore: 8,
  avgCheck: 3200,
  conversion: 22,
  nps: 3.25,
  pickupSpeed: 12,
  warehouseLoad: 35,
  teamMorale: 7,
  dailyRevenue: 125000,
};

export const SIMULATION_ROLE_CARDS: ReadonlyArray<{
  id: AssessorSimulationRoleId;
  title: string;
  description: string;
  participantRole: string;
  available: boolean;
}> = [
  {
    id: "participant",
    title: "Космонавт",
    description: "Стандартный режим для оценки компетенций",
    participantRole: "Участник",
    available: true,
  },
  {
    id: "deputy-manager",
    title: "Заместитель управляющего",
    description: "Отдельный набор сценариев — в разработке",
    participantRole: "Заместитель управляющего",
    available: false,
  },
  {
    id: "manager",
    title: "Управляющий",
    description: "Отдельный набор сценариев — в разработке",
    participantRole: "Управляющий",
    available: false,
  },
  {
    id: "regional-deputy",
    title: "ЗРД",
    description: "Заместитель регионального директора — в разработке",
    participantRole: "Заместитель регионального директора",
    available: false,
  },
];

export const TIME_PROFILE_RATIO: Record<AssessorDifficulty, number> = {
  easy: 1.1,
  medium: 1,
  hard: 0.8,
};
