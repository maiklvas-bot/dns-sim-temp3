import { BarChart3, CalendarClock, LayoutDashboard, Radio, Settings, Workflow } from "lucide-react";
import type { AdminTabKey, AdminVisualIdentity } from "./admin-types";

const ADMIN_BRAND_ASSETS = {
  workstation: "/brand-admin/admin-device-workstation.png",
  content: "/brand-admin/admin-mascot-content.png",
  supervisor: "/brand-admin/admin-mascot-supervisor.png",
  monitoring: "/brand-admin/admin-mascot-monitoring.png",
  assistant: "/brand-admin/admin-mascot-assistant.png",
  balance: "/brand-admin/admin-mascot-balance.png",
} as const;

export const ADMIN_VISUALS: Record<AdminTabKey, AdminVisualIdentity> = {
  cases: {
    label: "Кейсы",
    title: "Сценарный контент",
    subtitle: "Образ редактора держит фокус на сборке кейсов, развилок и компетенций.",
    primarySrc: ADMIN_BRAND_ASSETS.content,
    primaryAlt: "Фирменный персонаж-администратор для раздела кейсов",
    primaryClassName: "dns-admin-visual-primary--content",
    tone: "orange",
  },
  channels: {
    label: "Каналы",
    title: "Коммуникационные каналы",
    subtitle: "Помощник и приветственный персонаж подчеркивают живой поток сигналов.",
    primarySrc: ADMIN_BRAND_ASSETS.assistant,
    primaryAlt: "Фирменный помощник для коммуникационных каналов",
    primaryClassName: "dns-admin-visual-primary--assistant",
    tone: "teal",
  },
  schedule: {
    label: "Расписание",
    title: "Ритм симуляции",
    subtitle: "Спокойный образ балансирует таймлайн, а устройство управления отвечает за точность.",
    primarySrc: ADMIN_BRAND_ASSETS.balance,
    primaryAlt: "Фирменный персонаж для баланса расписания",
    primaryClassName: "dns-admin-visual-primary--balance",
    tone: "blue",
  },
  results: {
    label: "Результаты",
    title: "Аналитическая панель",
    subtitle: "Рабочая станция показывает, что отчеты и выгрузки остаются в центре внимания.",
    primarySrc: ADMIN_BRAND_ASSETS.workstation,
    primaryAlt: "Фирменная рабочая станция для аналитики результатов",
    primaryClassName: "dns-admin-visual-primary--workstation",
    tone: "purple",
  },
  comparison: {
    label: "Сравнение",
    title: "Сравнение прохождений",
    subtitle: "Мониторинговый образ помогает сопоставлять завершенные симуляции без смешивания с одиночными отчетами.",
    primarySrc: ADMIN_BRAND_ASSETS.monitoring,
    primaryAlt: "Фирменный персонаж для сравнения результатов симуляций",
    primaryClassName: "dns-admin-visual-primary--monitoring",
    tone: "cyan",
  },
  settings: {
    label: "Настройки",
    title: "Системные параметры",
    subtitle: "Сдержанный супервайзер и управляющее устройство визуально отделяют критичные настройки.",
    primarySrc: ADMIN_BRAND_ASSETS.supervisor,
    primaryAlt: "Фирменный супервайзер для системных настроек",
    primaryClassName: "dns-admin-visual-primary--supervisor",
    tone: "amber",
  },
};

export const ADMIN_NAV_ICONS: Record<AdminTabKey, typeof LayoutDashboard> = {
  cases: Workflow,
  channels: Radio,
  schedule: CalendarClock,
  results: BarChart3,
  comparison: LayoutDashboard,
  settings: Settings,
};
