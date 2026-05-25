/**
 * =============================================================================
 * CSRF (Cross-Site Request Forgery) Protection
 * =============================================================================
 * 
 * ИЗМЕНЕНИЯ БЕЗОПАСНОСТИ:
 * — Двойная cookie-защита (double-submit cookie pattern)
 * — CSRF токен генерируется при логине и хранится в сессии
 * — Токен проверяется для всех mutating-запросов (POST/PUT/PATCH/DELETE)
 * — Защита SameSite=strict на cookie уменьшает риск CSRF
 * 
 * Как работает:
 * 1. При логине сервер генерирует CSRF-токен и возвращает его клиенту
 * 2. Клиент отправляет токен в заголовке X-CSRF-Token при каждом запросе
 * 3. Сервер сравнивает токен из заголовка с токеном в сессии
 * 4. При несовпадении — отклоняет запрос (403 Forbidden)
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 * =============================================================================
 */

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Длина CSRF токена в байтах.
 * 32 байта = 64 hex символов — криптографически стойкий токен.
 */
const CSRF_TOKEN_BYTES = 32;

/**
 * Название заголовка, в котором клиент отправляет CSRF токен.
 * Стандартное соглашение для X-CSRF-Token.
 */
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * HTTP-методы, которые считаются "безопасными" и не требуют CSRF-защиты.
 * GET, HEAD, OPTIONS — не должны изменять состояние сервера.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Пути, которые освобождаются от CSRF-проверки.
 * — /api/staff/login — первоначальная аутентификация (еще нет сессии)
 * — /api/staff/logout — допустимо без CSRF (разрушает сессию)
 * — WebSocket endpoints — используют другой механизм аутентификации
 */
const CSRF_EXEMPT_PATHS = new Set([
  "/api/staff/login",
  "/api/staff/logout",
  "/api/live-sessions/join", // Доступ по коду, не по сессии
  "/api/simulation-content", // Публичный endpoint
]);

/**
 * Генерирует криптографически стойкий CSRF токен.
 * 
 * Алгоритм:
 * 1. Генерирует 32 случайных байта через crypto.randomBytes
 * 2. Конвертирует в hex строку (64 символа)
 * 3. Каждый токен уникален и непредсказуем
 * 
 * @returns Уникальный CSRF токен (64 hex символа)
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_BYTES).toString("hex");
}

/**
 * Middleware для генерации и выдачи CSRF токена.
 * 
 * Устанавливает токен в сессию и возвращает его клиенту.
 * Используется после успешного логина.
 * 
 * Пример использования:
 *   app.post("/api/staff/login", ..., csrfTokenHandler);
 */
export function csrfTokenHandler(req: Request, res: Response): void {
  if (!req.session) {
    res.status(500).json({ message: "Session not initialized" });
    return;
  }

  const token = generateCsrfToken();
  req.session.csrfToken = token;
  
  res.json({
    csrfToken: token,
    message: "CSRF token generated",
  });
}

/**
 * Основной CSRF protection middleware.
 * 
 * Проверяет CSRF токен для всех "опасных" HTTP-методов (POST, PUT, PATCH, DELETE).
 * Пропускает безопасные методы и exempt-пути.
 * 
 * Порядок проверок:
 * 1. Проверка метода (SAFE_METHODS пропускаются)
 * 2. Проверка пути (CSRF_EXEMPT_PATHS пропускаются)
 * 3. Проверка наличия сессии
 * 4. Проверка наличия CSRF токена в сессии
 * 5. Сравнение токена из заголовка с токеном в сессии
 * 
 * @throws 403 Forbidden если токен отсутствует или неверен
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // 1. Безопасные методы не требуют защиты
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // 2. Проверяем exempt-пути
  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  // 3. Проверяем аутентификацию
  if (!req.session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Для неаутентифицированных запросов CSRF не требуется
  // (атака CSRF предполагает, что пользователь уже залогинен)
  if (!req.session.staff) {
    return next();
  }

  // 4. Получаем токен из заголовка
  const submittedToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
  
  if (!submittedToken) {
    return res.status(403).json({
      message: "CSRF token missing",
      code: "CSRF_TOKEN_MISSING",
    });
  }

  // 5. Получаем ожидаемый токен из сессии
  const expectedToken = req.session.csrfToken;
  
  if (!expectedToken) {
    return res.status(403).json({
      message: "CSRF token not generated for this session",
      code: "CSRF_TOKEN_NOT_SET",
    });
  }

  // 6. Timing-safe сравнение токенов
  try {
    const submittedBuffer = Buffer.from(submittedToken, "hex");
    const expectedBuffer = Buffer.from(expectedToken, "hex");
    
    // Проверяем длину перед сравнением
    if (submittedBuffer.length !== expectedBuffer.length) {
      return res.status(403).json({
        message: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
      });
    }

    if (!crypto.timingSafeEqual(submittedBuffer, expectedBuffer)) {
      return res.status(403).json({
        message: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
      });
    }

    // Токен валиден — продолжаем
    next();
  } catch {
    // Ошибка при сравнении (например, невалидный hex)
    res.status(403).json({
      message: "Invalid CSRF token format",
      code: "CSRF_TOKEN_INVALID_FORMAT",
    });
  }
}

/**
 * Middleware для обновления CSRF токена.
 * 
 * Генерирует новый токен для сессии.
 * Используется после логина для защиты от fixation атак.
 */
export function regenerateCsrfToken(req: Request): string {
  const token = generateCsrfToken();
  if (req.session) {
    req.session.csrfToken = token;
  }
  return token;
}

/**
 * Получает текущий CSRF токен из сессии или генерирует новый.
 * Используется для отправки токена клиенту.
 */
export function getCsrfToken(req: Request): string | null {
  if (!req.session) return null;
  
  // Если токена нет — генерируем новый
  if (!req.session.csrfToken) {
    return regenerateCsrfToken(req);
  }
  
  return req.session.csrfToken;
}

// =============================================================================
// Расширение типов express-session
// =============================================================================

declare module "express-session" {
  interface SessionData {
    /**
     * CSRF токен для защиты от Cross-Site Request Forgery.
     * Генерируется при логине и проверяется для всех mutating-запросов.
     */
    csrfToken?: string;
  }
}
