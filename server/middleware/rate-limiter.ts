/**
 * =============================================================================
 * Rate Limiting — защита от brute-force и DoS атак
 * =============================================================================
 * 
 * ИЗМЕНЕНИЯ БЕЗОПАСНОСТИ:
 * — Rate limiting на login endpoint (5 попыток / 15 минут)
 * — Rate limiting на API endpoints (100 запросов / 15 минут)
 * — Rate limiting на жестокие endpoints (PDF/Excel экспорт)
 * — Индивидуальная блокировка по IP + username для логина
 * — Информативные заголовки X-RateLimit-*
 * 
 * ТРЕБУЕТСЯ УСТАНОВИТЬ:
 *   npm install express-rate-limit
 * =============================================================================
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";

/**
 * Хранилище для отслеживания неудачных попыток логина по IP+username.
 * Используется для ужесточения лимитов при повторных попытках.
 * В продакшене рекомендуется использовать Redis Store.
 */
const LOGIN_FAILED_ATTEMPT_LIMIT = 5;
const LOGIN_FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();

/**
 * Очищает устаревшие записи о неудачных попытках каждые 15 минут.
 * Предотвращает утечку памяти в долгосрочной перспективе.
 */
const failedAttemptsCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, data] of Array.from(failedAttempts.entries())) {
    if (now - data.firstAttempt > LOGIN_FAILED_ATTEMPT_WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}, LOGIN_FAILED_ATTEMPT_WINDOW_MS);
failedAttemptsCleanupTimer.unref?.();

/**
 * Генерирует ключ для отслеживания по IP + username.
 * Это позволяет блокировать конкретного пользователя с конкретного IP,
 * не затрагивая других пользователей с того же IP (NAT).
 */
function getLoginKey(req: Request): string {
  const ip = ipKeyGenerator(req.ip || req.socket.remoteAddress || "0.0.0.0");
  const username = (req.body?.username || "unknown").toLowerCase().trim();
  return `${ip}:${username}`;
}

function getActiveFailedAttempt(key: string, now = Date.now()) {
  const existing = failedAttempts.get(key);
  if (!existing) {
    return null;
  }

  if (now - existing.firstAttempt > LOGIN_FAILED_ATTEMPT_WINDOW_MS) {
    failedAttempts.delete(key);
    return null;
  }

  return existing;
}

function getRetryAfterSeconds(firstAttempt: number, now = Date.now()) {
  return Math.max(1, Math.ceil((firstAttempt + LOGIN_FAILED_ATTEMPT_WINDOW_MS - now) / 1000));
}

export function getFailedLoginAttemptState(req: Request) {
  const now = Date.now();
  const existing = getActiveFailedAttempt(getLoginKey(req), now);
  if (!existing) {
    return null;
  }

  return {
    count: existing.count,
    limited: existing.count >= LOGIN_FAILED_ATTEMPT_LIMIT,
    retryAfterSeconds: getRetryAfterSeconds(existing.firstAttempt, now),
  };
}

/**
 * Увеличивает счетчик неудачных попыток для IP+username.
 * Вызывается после неудачного логина.
 */
export function recordFailedLogin(req: Request): void {
  const key = getLoginKey(req);
  const now = Date.now();
  const existing = getActiveFailedAttempt(key, now);
  
  if (!existing) {
    failedAttempts.set(key, { count: 1, firstAttempt: now });
  } else {
    existing.count++;
  }
}

/**
 * Очищает счетчик неудачных попыток после успешного логина.
 */
export function clearFailedAttempts(req: Request): void {
  const key = getLoginKey(req);
  failedAttempts.delete(key);
}

/**
 * Проверяет, не превышен ли лимит неудачных попыток до обработки запроса.
 * Используется как skip-функция в rate limiter.
 */
function isUnderFailedLimit(req: Request): boolean {
  const key = getLoginKey(req);
  const data = failedAttempts.get(key);
  if (!data) return true;
  // После 3 неудачных — ужесточаем проверку
  return data.count < 3;
}

// =============================================================================
// Стандартные HTTP-ответы для превышения лимита
// =============================================================================

/**
 * Стандартный обработчик превышения лимита.
 * Возвращает 429 Too Many Requests с Retry-After заголовком.
 */
function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    message: "Слишком много запросов. Пожалуйста, подождите и попробуйте снова.",
    code: "RATE_LIMIT_EXCEEDED",
  });
}

/**
 * Обработчик превышения лимита логина.
 * Возвращает 429 с увеличенным временем ожидания.
 */
function loginRateLimitHandler(_req: Request, res: Response, retryAfter: number): void {
  res.status(429).json({
    message: "Слишком много попыток входа. Пожалуйста, попробуйте позже.",
    code: "LOGIN_RATE_LIMIT_EXCEEDED",
    retryAfterSeconds: Math.ceil(retryAfter),
  });
}

export function loginFailedAttemptLimiter(req: Request, res: Response, next: NextFunction): void {
  const failedAttemptState = getFailedLoginAttemptState(req);
  if (failedAttemptState?.limited) {
    loginRateLimitHandler(req, res, failedAttemptState.retryAfterSeconds);
    return;
  }

  next();
}

// =============================================================================
// Rate Limiters
// =============================================================================

/**
 * Rate limiter для endpoint логина (/api/staff/login).
 * 
 * Настройки безопасности:
 * — 5 попыток за 15 минут — достаточно для легитимных пользователей
 * — Идентификация по IP+username — не затрагивает других пользователей
 * — Увеличенное время блокировки после 3 неудачных
 * 
 * OWASP рекомендации:
 * — Использовать progressive delays (увеличивающиеся задержки)
 * — Блокировать аккаунт после N неудачных попыток
 * — Отправлять уведомление при подозрительной активности
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток
  standardHeaders: true, // Возвращает RateLimit-* заголовки
  legacyHeaders: false, // Не возвращает X-RateLimit-* (устаревшие)
  
  // Ключ: IP + username для более точной блокировки
  keyGenerator: (req: Request) => getLoginKey(req),
  
  // Ужесточаем лимит после 3 неудачных попыток
  skip: (req: Request) => isUnderFailedLimit(req),
  
  // Обработчик при превышении
  handler: (req, res) => {
    const retryAfter = 15 * 60; // 15 минут в секундах
    loginRateLimitHandler(req, res, retryAfter);
  },
  
  // Не блокируем успешные запросы в счетчике
  skipSuccessfulRequests: false,
  // Не считаем неуспешные (считаем отдельно в recordFailedLogin)
  skipFailedRequests: false,
});

/**
 * Rate limiter для API endpoints.
 * 
 * Настройки:
 * — 3000 запросов за 15 минут на IP
 * — Достаточно для live-симуляции, частого polling и админских экранов
 * — Защищает от DoS и brute-force атак на API
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 3000, // live-сессии и админка делают много легитимных запросов
  standardHeaders: true,
  legacyHeaders: false,
  
  // Ключ по IP-адресу
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip || req.socket.remoteAddress || "0.0.0.0"),
  
  handler: rateLimitHandler,
  
  // Не применяем к статическим файлам и health-check
  skip: (req: Request) => {
    const path = req.path;
    return (
      path.startsWith("/library") || // Статические медиафайлы
      path.startsWith("/uploads") || // Статические загрузки
      path === "/health" || // Health check endpoint
      path === "/api/health" ||
      path === "/api/simulation-content"
    );
  },
});

/**
 * Усиленный rate limiter для ресурсоёмких операций.
 * 
 * Применяется к:
 * — PDF экспорт (/api/export-pdf)
 * — Excel экспорт (/api/export-xlsx)
 * — Загрузка медиафайлов (/api/admin/assets)
 * 
 * 10 запросов за 15 минут — предотвращает исчерпание ресурсов CPU/памяти.
 */
export const heavyOperationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // 10 запросов
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip || req.socket.remoteAddress || "0.0.0.0"),
  
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      message: "Слишком много запросов на экспорт. Пожалуйста, подождите.",
      code: "HEAVY_OP_RATE_LIMIT_EXCEEDED",
    });
  },
});

/**
 * Rate limiter для аутентифицированных админ-операций.
 * Более мягкий, т.к. пользователь уже аутентифицирован.
 */
export const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Больше лимит для админов
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: Request) => {
    // Используем ID сессии вместо IP для аутентифицированных пользователей
    return req.session?.staff?.id?.toString() ||
           ipKeyGenerator(req.ip || req.socket.remoteAddress || "0.0.0.0");
  },
  
  handler: rateLimitHandler,
});
