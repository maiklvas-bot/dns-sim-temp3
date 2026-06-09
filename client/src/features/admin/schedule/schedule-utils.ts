import type { EmailCase, MessengerCase, SimCase, VideoCase } from "@shared/simulation-content";

export type ScheduleSourceType = "main_case" | "email" | "messenger" | "video";

export interface ScheduleRow {
  rowId: string;
  sourceType: ScheduleSourceType;
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
  arrivalMinute: number | null;
  minIntervalSeconds: number | null;
  maxIntervalSeconds: number | null;
  decisionDeadlineSeconds: number | null;
  reminderIntervalSeconds: number | null;
}

export function getScheduleSourceLabel(sourceType: ScheduleSourceType) {
  switch (sourceType) {
    case "main_case": return "Кейс";
    case "email": return "Почта";
    case "messenger": return "Мессенджер";
    case "video": return "Видео";
  }
}

export function buildScheduleRows(content: any): ScheduleRow[] {
  const cases = ((content?.cases || []) as SimCase[]).map((item) => ({
    rowId: `main_case:${item.id}`,
    sourceType: "main_case" as const,
    id: item.id,
    title: item.title || item.id,
    subtitle: item.trigger?.source || "Основной кейс",
    sortOrder: item.sortOrder ?? 0,
    arrivalMinute: item.timing?.arrivalMinute ?? null,
    minIntervalSeconds: item.timing?.minIntervalSeconds ?? 45,
    maxIntervalSeconds: item.timing?.maxIntervalSeconds ?? 90,
    decisionDeadlineSeconds: item.timing?.decisionDeadlineSeconds ?? 180,
    reminderIntervalSeconds: item.timing?.reminderIntervalSeconds ?? 180,
  }));
  const emails = ((content?.emailCases || []) as EmailCase[]).map((item) => ({
    rowId: `email:${item.id}`,
    sourceType: "email" as const,
    id: item.id,
    title: item.subject || item.id,
    subtitle: item.from || item.department || "Почта",
    sortOrder: item.sortOrder ?? 0,
    arrivalMinute: item.timing?.arrivalMinute ?? item.arrivalMinute ?? null,
    minIntervalSeconds: null,
    maxIntervalSeconds: null,
    decisionDeadlineSeconds: item.timing?.decisionDeadlineSeconds ?? 300,
    reminderIntervalSeconds: item.timing?.reminderIntervalSeconds ?? 180,
  }));
  const messages = ((content?.messengerCases || []) as MessengerCase[]).map((item) => ({
    rowId: `messenger:${item.id}`,
    sourceType: "messenger" as const,
    id: item.id,
    title: item.senderName || item.id,
    subtitle: item.senderRole || "Мессенджер",
    sortOrder: item.sortOrder ?? 0,
    arrivalMinute: item.timing?.arrivalMinute ?? item.arrivalMinute ?? null,
    minIntervalSeconds: null,
    maxIntervalSeconds: null,
    decisionDeadlineSeconds: item.timing?.decisionDeadlineSeconds ?? 180,
    reminderIntervalSeconds: item.timing?.reminderIntervalSeconds ?? 5,
  }));
  const videos = ((content?.videoCases || []) as VideoCase[]).map((item) => ({
    rowId: `video:${item.id}`,
    sourceType: "video" as const,
    id: item.id,
    title: item.title || item.id,
    subtitle: item.sender || "Видео",
    sortOrder: item.sortOrder ?? 0,
    arrivalMinute: item.timing?.arrivalMinute ?? item.arrivalMinute ?? null,
    minIntervalSeconds: null,
    maxIntervalSeconds: null,
    decisionDeadlineSeconds: item.timing?.decisionDeadlineSeconds ?? 240,
    reminderIntervalSeconds: item.timing?.reminderIntervalSeconds ?? 180,
  }));

  return [...cases, ...emails, ...messages, ...videos].sort((left, right) => {
    const leftArrival = left.arrivalMinute ?? left.sortOrder * 10;
    const rightArrival = right.arrivalMinute ?? right.sortOrder * 10;
    if (leftArrival !== rightArrival) return leftArrival - rightArrival;
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.rowId.localeCompare(right.rowId);
  });
}

export function autoAssignScheduleTimes(rows: ScheduleRow[]) {
  const stepMinutes = Math.max(5, Math.floor(600 / Math.max(1, rows.length + 1)));
  return rows.map((row, index) => ({
    ...row,
    sortOrder: index + 1,
    arrivalMinute: Math.min(650, 10 + index * stepMinutes),
  }));
}
