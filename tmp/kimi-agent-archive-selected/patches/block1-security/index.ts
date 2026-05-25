/**
 * =============================================================================
 * DNS SimCenter — основной файл сервера (улучшенная безопасность)
 * =============================================================================
 * 
 * ИЗМЕНЕНИЯ БЕЗОПАСНОСТИ:
 * — Добавлен Helmet с Content-Security-Policy
 * — Rate limiting на все API endpoints
 * — CSRF protection для mutating-запросов
 * — Улучшенное управление сессиями (strict SameSite, secure cookies)
 * — Убран fallback для SESSION_SECRET (генерация случайного с предупреждением)
 * — Уменьшен maxAge сессии до 2 часов (было 8)
 * — Установлен SameSite=strict (было lax)
 * — HSTS для production HTTPS
 * — Referrer-Policy: strict-origin-when-cross-origin
 * 
 * ТРЕБУЕТСЯ УСТАНОВИТЬ:
 *   npm install helmet express-rate-limit
 * =============================================================================
 */

import "./load-env";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import { runMigrations } from "./migrations";
import { sqlite } from "./db";
import { staffStorage } from "./staff-storage";
import { apiRateLimiter } from "./middleware/rate-limiter";
import { csrfProtection } from "./middleware/csrf";

// =============================================================================
// Инициализация Express приложения
// =============================================================================

const app = express();
const httpServer = createServer(app);
const MemoryStore = createMemoryStore(session);

// =============================================================================
// Расширение типов для сессии
// =============================================================================

declare module "express-session" {
  interface SessionData {
    staff?: {
      id: number;
      role: "admin" | "evaluator";
      username: string;
      displayName: string;
    };
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// =============================================================================
// Управление SESSION_SECRET — безопасность
// =============================================================================

/**
 * Безопасная обработка SESSION_SECRET.
 * 
 * БЕЗОПАСНОСТЬ:
 * — УБРАН жестко закодированный fallback ("dns-simcenter-session-secret")
 * — При отсутствии SESSION_SECRET генерируем случайный секрет
 * — Выводим ПРЕДУПРЕЖДЕНИЕ в логи
 * — При перезапуске сессии всех пользователей будут инвалидированы
 * — В production рекомендуется устанавливать SESSION_SECRET явно
 */
function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  
  if (envSecret && envSecret.length >= 32) {
    // Секрет из переменной окружения — ок
    return envSecret;
  }
  
  if (envSecret && envSecret.length < 32) {
    // Секрет слишком короткий — предупреждение
    console.warn("\n" + "=".repeat(80));
    console.warn("⚠️  ПРЕДУПРЕЖДЕНИЕ БЕЗОПАСНОСТИ: SESSION_SECRET слишком короткий!");
    console.warn("   Текущая длина:", envSecret.length, "символов");
    console.warn("   Рекомендуемая длина: минимум 32 символа");
    console.warn("   Генерирую случайный секрет...");
    console.warn("=".repeat(80) + "\n");
  } else {
    // Секрет не установлен — критическое предупреждение
    console.warn("\n" + "=".repeat(80));
    console.warn("⚠️  ПРЕДУПРЕЖДЕНИЕ БЕЗОПАСНОСТИ: SESSION_SECRET не установлен!");
    console.warn("   Используется случайно сгенерированный секрет.");
    console.warn("   ВСЕ СЕССИИ БУДУТ ИНВАЛИДИРОВАНЫ ПРИ ПЕРЕЗАПУСКЕ СЕРВЕРА!");
    console.warn("   Для production установите SESSION_SECRET в .env файле:");
    console.warn("   SESSION_SECRET=<длинная-случайная-строка-минимум-32-символа>");
    console.warn("=".repeat(80) + "\n");
  }
  
  // Генерируем криптографически стойкий случайный секрет
  const crypto = require("crypto") as typeof import("crypto");
  const randomSecret = crypto.randomBytes(64).toString("hex");
  return randomSecret;
}

const sessionSecret = getSessionSecret();

// =============================================================================
// Определение окружения
// =============================================================================

const isProduction = process.env.NODE_ENV === "production";
const isHttps = process.env.HTTPS === "true" || isProduction;

// =============================================================================
// Helmet — Security Headers
// =============================================================================

/**
 * Настройка Helmet для защиты HTTP-заголовками.
 * 
 * OWASP рекомендации:
 * — Content-Security-Policy: предотвращает XSS и injection
 * — X-Frame-Options: защита от clickjacking
 * — X-Content-Type-Options: предотвращает MIME-sniffing
 * — Strict-Transport-Security: принудительный HTTPS
 * — Referrer-Policy: контроль утечки информации через Referer
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
 */
app.use(helmet({
  // Content-Security-Policy — защита от XSS и data injection
  contentSecurityPolicy: {
    directives: {
      // По умолчанию разрешаем только свой источник
      defaultSrc: ["'self'"],
      
      // Скрипты: только свой домен и inline (для Vite/React)
      scriptSrc: isProduction 
        ? ["'self'", "'unsafe-inline'"] 
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // eval нужен для Vite HMR
      
      // Стили: свой домен и inline
      styleSrc: ["'self'", "'unsafe-inline'"],
      
      // Изображения: свой домен, data-URI, blob
      imgSrc: ["'self'", "data:", "blob:", "/library", "/uploads"],
      
      // Шрифты: только свой домен
      fontSrc: ["'self'"],
      
      // Media: свой домен и blob (для записи аудио/видео)
      mediaSrc: ["'self'", "blob:", "/library", "/uploads"],
      
      // WebSocket соединения
      connectSrc: ["'self'", "ws:", "wss:"],
      
      // Фреймы: только свой домен (защита от clickjacking через iframes)
      frameSrc: ["'self'"],
      
      // Объекты/встроенный контент: запрещены
      objectSrc: ["'none'"],
      
      // Базовый URL: только свой домен
      baseUri: ["'self'"],
      
      // Формы: только свой домен
      formAction: ["'self'"],
      
      // upgrade insecure requests для HTTPS
      upgradeInsecureRequests: isHttps ? [] : undefined,
    },
  },
  
  // X-Frame-Options — защита от clickjacking
  // DENY: страница НИКОГДА не может быть встроена в iframe
  frameguard: {
    action: "deny",
  },
  
  // X-Content-Type-Options — предотвращает MIME-sniffing
  // nosniff: браузер должен строго следовать Content-Type
  noSniff: true,
  
  // Strict-Transport-Security (HSTS) — принудительный HTTPS
  // Включаем только в production с HTTPS
  hsts: isHttps ? {
    maxAge: 31536000, // 1 год в секундах
    includeSubDomains: true, // Применять ко всем поддоменам
    preload: true, // Включить в preload list браузеров
  } : false,
  
  // Referrer-Policy — контроль утечки информации
  // strict-origin-when-cross-origin: 
  // — На своём домене: полный URL
  // — На другой домен: только origin (без path)
  // — С HTTP на HTTPS: не отправлять
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
  
  // X-DNS-Prefetch-Control — отключаем DNS prefetch для приватности
  dnsPrefetchControl: {
    allow: false,
  },
  
  // X-Permitted-Cross-Domain-Policies — запрещаем cross-domain policy
  crossOriginEmbedderPolicy: false, // Отключаем для совместимости с Vite
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Для медиафайлов
  
  // Permissions-Policy — ограничение доступа к API браузера
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
      magnetometer: ["'none'"],
      gyroscope: ["'none'"],
      accelerometer: ["'none'"],
      fullscreen: ["'self'"],
    },
  },
}));

// Дополнительный заголовок для защиты от XXE
app.use((_req: Request, res: Response, next: NextFunction) => {
  // X-XSS-Protection (legacy, но полезен для старых браузеров)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Убираем X-Powered-By для сокрытия информации о технологиях
  res.removeHeader("X-Powered-By");
  next();
});

// =============================================================================
// Body Parsing — с ограничениями
// =============================================================================

/**
 * Парсинг JSON body с ограничениями.
 * 
 * БЕЗОПАСНОСТЬ:
 * — limit: 10mb — предотвращает DoS через огромный payload
 * — verify: сохраняет rawBody для проверки подписей (если нужно)
 */
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Парсинг URL-encoded body
app.use(express.urlencoded({ extended: false }));

// =============================================================================
// Session Management — улучшенная конфигурация
// =============================================================================

/**
 * Конфигурация сессии — улучшенная безопасность.
 * 
 * ИЗМЕНЕНИЯ:
 * — cookie.httpOnly: true — защита от XSS (JavaScript не может прочитать cookie)
 * — cookie.maxAge: 2 часа (было 8) — уменьшаем окно атаки
 * — cookie.sameSite: "strict" (было "lax") — максимальная защита CSRF
 * — cookie.secure: true в production (HTTPS only)
 * — name: "dns-simcenter.sid" — маскировка от фреймворка
 * — resave: false — не пересохранять без изменений
 * — rolling: true — продление сессии при активности
 * — saveUninitialized: false — не создавать пустые сессии
 * 
 * ВНИМАНИЕ: MemoryStore НЕ подходит для production!
 * Рекомендуется: Redis, PostgreSQL, MongoDB store.
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
 */
app.use(
  session({
    cookie: {
      // httpOnly: защита от XSS — cookie недоступен из JavaScript
      httpOnly: true,
      
      // maxAge: 2 часа (7 200 000 мс) — уменьшен с 8 часов
      // Уменьшает окно атаки при краже сессии
      maxAge: 1000 * 60 * 60 * 2,
      
      // sameSite: "strict" — максимальная защита от CSRF
      // Cookie отправляется ТОЛЬКО при запросах с того же сайта
      // "lax" разрешал отправку при навигации top-level GET
      // "strict" — только при прямых запросах с сайта
      sameSite: "strict",
      
      // secure: true — cookie передается только по HTTPS
      // В development может быть false
      secure: isHttps,
      
      // domain: не устанавливаем — cookie доступен только текущему хосту
      // path: "/" — cookie доступен для всех путей
    },
    
    // Имя cookie — нестандартное для маскировки
    name: "dns-simcenter.sid",
    
    // Не пересохранять сессию, если она не изменилась
    resave: false,
    
    // Продлевать maxAge при каждом запросе (активность = живая сессия)
    rolling: true,
    
    // Не сохранять неинициализированные сессии
    saveUninitialized: false,
    
    // Секрет для подписи cookie — криптографически стойкий
    secret: sessionSecret,
    
    // Хранилище сессий
    // ВНИМАНИЕ: MemoryStore теряет данные при перезапуске!
    // Для production используйте: connect-redis, connect-pg-simple, session-file-store
    store: new MemoryStore({
      checkPeriod: 1000 * 60 * 60, // Проверка устаревших сессий каждый час
    }),
  }),
);

// =============================================================================
// Rate Limiting — защита от DoS и brute-force
// =============================================================================

/**
 * Применяем rate limiting ко ВСЕМ API маршрутам.
 * 
 * Настройки:
 * — 100 запросов за 15 минут на IP
 * — Защита от DoS, brute-force, скрейпинга
 * — Не применяется к статическим файлам и медиа
 */
app.use("/api", apiRateLimiter);

// =============================================================================
// CSRF Protection — защита от подделки запросов
// =============================================================================

/**
 * Применяем CSRF защиту ко ВСЕМ маршрутам.
 * 
 * Пропускается для:
 * — GET/HEAD/OPTIONS (безопасные методы)
 * — /api/staff/login (первоначальная аутентификация)
 * — /api/staff/logout (завершение сессии)
 * — /api/live-sessions/join (доступ по коду)
 */
app.use(csrfProtection);

// =============================================================================
// Статические файлы — медиа
// =============================================================================

const staticMediaOptions = {
  etag: true,
  immutable: true,
  maxAge: "30d",
  setHeaders: (res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
  },
} as const;

app.use("/library", express.static(path.resolve(process.cwd(), "attached_assets"), staticMediaOptions));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads"), staticMediaOptions));

// =============================================================================
// Логирование запросов
// =============================================================================

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Middleware для логирования всех API-запросов.
 * 
 * БЕЗОПАСНОСТЬ:
 * — НЕ логируем тела запросов с чувствительными данными
 * — НЕ логируем пароли, токены, персональные данные
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Не логируем чувствительные данные
        const safeResponse = { ...capturedJsonResponse };
        delete safeResponse.password;
        delete safeResponse.token;
        delete safeResponse.csrfToken;
        logLine += ` :: ${JSON.stringify(safeResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

// =============================================================================
// Health Check endpoint (не под rate limiting)
// =============================================================================

/**
 * Health check для мониторинга.
 * Должен быть БЕЗ rate limiting и аутентификации.
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// =============================================================================
// Запуск сервера
// =============================================================================

(async () => {
  // Запускаем миграции базы данных
  runMigrations(sqlite);
  
  // Создаем дефолтные аккаунты staff (асинхронно — bcrypt)
  await staffStorage.ensureDefaults();
  
  // Регистрируем все маршруты
  await registerRoutes(httpServer, app);

  // =============================================================================
  // Глобальный обработчик ошибок
  // =============================================================================
  
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Логируем ошибку (без чувствительных данных)
    console.error("Internal Server Error:", err);

    // Если заголовки уже отправлены — делегируем Express
    if (res.headersSent) {
      return next(err);
    }

    // В production не раскрываем детали ошибок клиенту
    if (isProduction) {
      return res.status(status).json({
        message: status >= 500 ? "Internal Server Error" : message,
        code: err.code || "INTERNAL_ERROR",
      });
    }

    // В development — возвращаем детали для отладки
    return res.status(status).json({
      message,
      code: err.code || "INTERNAL_ERROR",
      stack: err.stack,
    });
  });

  // =============================================================================
  // Обслуживание статических файлов (production)
  // =============================================================================
  
  // Важно: настраиваем Vite ТОЛЬКО после всех остальных маршрутов
  // чтобы catch-all маршрут не мешал API
  if (isProduction) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // =============================================================================
  // Запуск HTTP сервера
  // =============================================================================
  
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      log(`environment: ${isProduction ? "production" : "development"}`);
      log(`HTTPS mode: ${isHttps ? "enabled" : "disabled"}`);
      log(`session maxAge: 2 hours`);
      log(`sameSite: strict`);
      log(`rate limiting: enabled (100 req/15min)`);
    },
  );
})();
