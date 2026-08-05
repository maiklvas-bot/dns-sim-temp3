/** ЗРД — клиентский слой сети (Фаза 4). Сырой fetch для полного контроля статусов
 * (apiRequest бросает на любой не-2xx, что ломает мягкую обработку отклонённого хода 400). */
import { API_BASE, getCsrfToken } from "@/lib/queryClient";
import type { PublicZrdState } from "@shared/zrd/engine";
import type { TurnIntent, Difficulty } from "@shared/zrd/types";

const TOKEN_HEADER = "x-zrd-token";
const isMutating = (m: string) => !["GET", "HEAD", "OPTIONS"].includes(m.toUpperCase());

interface RawResult { ok: boolean; status: number; data: any }

async function zrdFetch(method: string, url: string, body?: unknown, token?: string | null): Promise<RawResult> {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers[TOKEN_HEADER] = token;
  const csrf = getCsrfToken();
  if (csrf && isMutating(method)) headers["X-CSRF-Token"] = csrf;

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    credentials: "same-origin",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  return { ok: res.ok, status: res.status, data };
}

function friendlyError(status: number, data: any): string {
  if (status === 401) return "Чтобы создать партию, войдите как сотрудник (кнопка «Выход» → вход).";
  if (status === 403) return "Нет доступа к этой партии — нужна ссылка с токеном от оценщика.";
  if (status === 404) return "Партия не найдена.";
  return (data && (data.message || data.error)) || `Ошибка запроса (${status})`;
}

export class ZrdRequestError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export class ZrdIntentError extends Error {
  code: string;
  constructor(code: string) { super(`Ход отклонён: ${code}`); this.code = code; }
}

export interface ZrdResultView {
  tr: number;
  aiTr: number;
  winner: "player" | "ai" | "draw";
  finalMetrics: { sales: number; nps: number; coverage: number };
  competencies: Record<string, number>;
  outcome: { earlyWin: boolean; quartersPlayed: number };
}

export interface ZrdSessionView {
  id: number;
  participantName: string;
  difficulty: number;
  region: string | null;
  quarters: number;
  status: "in_progress" | "completed";
  accessCode?: string;
  state: PublicZrdState;
  result: ZrdResultView | null;
}

export interface CreateZrdResponse {
  id: number;
  difficulty: number;
  region: string | null;
  quarters: number;
  status: string;
  accessCode: string;
  sessionToken: string;
  state: PublicZrdState;
}

export interface IntentResponse {
  state: PublicZrdState;
  finalized: boolean;
  result: ZrdResultView | null;
}

export interface CreateZrdInput {
  participantName?: string;
  assessorName?: string;
  difficulty: Difficulty;
  region?: string | null;
  seed?: number;
  quarters?: number;
}

export async function createZrdSession(input: CreateZrdInput): Promise<CreateZrdResponse> {
  const r = await zrdFetch("POST", "/api/zrd/sessions", input);
  if (!r.ok) throw new ZrdRequestError(r.status, friendlyError(r.status, r.data));
  return r.data as CreateZrdResponse;
}

export async function fetchZrdSession(id: number, token?: string | null): Promise<ZrdSessionView> {
  const r = await zrdFetch("GET", `/api/zrd/sessions/${id}`, undefined, token);
  if (!r.ok) throw new ZrdRequestError(r.status, friendlyError(r.status, r.data));
  return r.data as ZrdSessionView;
}

export async function sendZrdIntent(id: number, intent: TurnIntent, token?: string | null): Promise<IntentResponse> {
  const r = await zrdFetch("POST", `/api/zrd/sessions/${id}/intent`, intent, token);
  if (r.status === 400) throw new ZrdIntentError(r.data?.error || "REJECTED");
  if (!r.ok) throw new ZrdRequestError(r.status, friendlyError(r.status, r.data));
  return r.data as IntentResponse;
}
