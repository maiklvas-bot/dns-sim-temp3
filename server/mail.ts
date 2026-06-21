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

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  return cachedTransport;
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
