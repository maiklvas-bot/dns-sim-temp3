import nodemailer, { type Transporter } from "nodemailer";

/**
 * Отправка письма обратной связи разработчикам.
 * Конфигурируется через .env (generic SMTP). Если SMTP не задан — мягкий отказ
 * (NOT_CONFIGURED), без падения сервера. Адреса получателей берутся из env,
 * с запасным значением на известных разработчиков.
 */

const DEFAULT_RECIPIENTS = ["vasilcov.m@dns-shop.ru", "Lyubimov.AI@dns-shop.ru"];

function getRecipients(): string[] {
  const raw = process.env.FEEDBACK_RECIPIENTS;
  if (raw && raw.trim()) {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return DEFAULT_RECIPIENTS;
}

export function isFeedbackMailConfigured(): boolean {
  return Boolean(process.env.FEEDBACK_SMTP_HOST && process.env.FEEDBACK_FROM);
}

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (cachedTransport) {
    return cachedTransport;
  }
  const host = process.env.FEEDBACK_SMTP_HOST;
  const from = process.env.FEEDBACK_FROM;
  if (!host || !from) {
    return null;
  }
  const port = Number(process.env.FEEDBACK_SMTP_PORT || 587);
  const secure = String(process.env.FEEDBACK_SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = process.env.FEEDBACK_SMTP_USER;
  const pass = process.env.FEEDBACK_SMTP_PASS;
  // On-prem Exchange часто имеет внутренний (self-signed/корпоративный CA) TLS-сертификат —
  // тогда нужно отключить строгую проверку: FEEDBACK_SMTP_TLS_REJECT_UNAUTHORIZED=false.
  const rejectUnauthorized = String(process.env.FEEDBACK_SMTP_TLS_REJECT_UNAUTHORIZED ?? "true").toLowerCase() !== "false";
  // Принудительный STARTTLS на 587 (Exchange submission), если сервер не отдаёт TLS сам.
  const requireTLS = String(process.env.FEEDBACK_SMTP_REQUIRE_TLS ?? "").toLowerCase() === "true";

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: requireTLS || undefined,
    auth: user && pass ? { user, pass } : undefined,
    tls: { rejectUnauthorized },
  });
  return cachedTransport;
}

/** Проверка соединения с почтовым сервером (для диагностики Exchange/SMTP без отправки письма). */
export async function verifyFeedbackTransport(): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransport();
  if (!transport) {
    return { ok: false, error: "NOT_CONFIGURED" };
  }
  try {
    await transport.verify();
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }
}

export interface FeedbackPayload {
  category: string;
  message: string;
  contact?: string | null;
  meta?: {
    role?: string | null;
    url?: string | null;
    userAgent?: string | null;
  };
}

export class FeedbackMailNotConfiguredError extends Error {
  code = "NOT_CONFIGURED" as const;
  constructor() {
    super("Механизм отправки почты не настроен (нет SMTP-конфигурации).");
    this.name = "FeedbackMailNotConfiguredError";
  }
}

export async function sendFeedbackMail(payload: FeedbackPayload): Promise<{ recipients: string[] }> {
  const transport = getTransport();
  if (!transport) {
    throw new FeedbackMailNotConfiguredError();
  }
  const recipients = getRecipients();
  const from = process.env.FEEDBACK_FROM as string;

  const lines = [
    `Категория: ${payload.category}`,
    `Контакт для ответа: ${payload.contact?.trim() ? payload.contact.trim() : "не указан"}`,
    payload.meta?.role ? `Роль отправителя: ${payload.meta.role}` : null,
    payload.meta?.url ? `Экран: ${payload.meta.url}` : null,
    payload.meta?.userAgent ? `User-Agent: ${payload.meta.userAgent}` : null,
    "",
    "Сообщение:",
    payload.message,
  ].filter((line): line is string => line !== null);

  const replyTo = payload.contact && payload.contact.includes("@") ? payload.contact.trim() : undefined;

  await transport.sendMail({
    from,
    to: recipients,
    subject: `[DNS SimCenter] Обратная связь · ${payload.category}`,
    text: lines.join("\n"),
    replyTo,
  });

  return { recipients };
}
