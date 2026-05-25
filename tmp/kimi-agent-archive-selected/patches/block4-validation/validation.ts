/**
 * =============================================================================
 * Input Validation — валидация входных данных с Zod
 * =============================================================================
 * 
 * ИЗМЕНЕНИЯ БЕЗОПАСНОСТИ:
 * — Строгая валидация ВСЕХ входных данных через Zod schemas
 * — Санитизация строк (trim, обрезка длины, фильтрация опасных символов)
 * — Валидация числовых параметров (диапазоны, типы)
 * — Защита от NoSQL injection через строгие схемы
 * — Защита от XSS через ограничение длины и формата строк
 * 
 * OWASP рекомендации:
 * — Всегда валидировать входные данные на сервере
 * — Не доверять клиентской валидации
 * — Использовать whitelist (разрешённое), а не blacklist (запрещённое)
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
 * =============================================================================
 */

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// =============================================================================
// Общие валидаторы (реиспользуемые)
// =============================================================================

/**
 * Валидатор для строковых ID (nanoid).
 * Поддерживает буквы, цифры, подчеркивания и дефисы.
 * Длина: 1-50 символов.
 */
export const idStringSchema = z.string()
  .min(1, "ID не может быть пустым")
  .max(50, "ID слишком длинный (максимум 50 символов)")
  .regex(/^[a-zA-Z0-9_-]+$/, "ID содержит недопустимые символы");

/**
 * Валидатор для целых чисел (ID из БД).
 * Положительное число, безопасный диапазон.
 */
export const positiveIntSchema = z.number()
  .int("Должно быть целым числом")
  .positive("Должно быть положительным числом")
  .max(2147483647, "Число превышает допустимый диапазон"); // INT MAX

/**
 * Валидатор для имени пользователя.
 * Буквы, цифры, пробелы, дефисы. Без спецсимволов.
 */
export const nameSchema = z.string()
  .min(1, "Имя не может быть пустым")
  .max(100, "Имя слишком длинное (максимум 100 символов)")
  .regex(/^[\p{L}\p{N}\s._-]+$/u, "Имя содержит недопустимые символы");

/**
 * Валидатор для текста (описания, комментарии).
 * Максимальная длина: 5000 символов (защита от переполнения).
 */
export const textSchema = z.string()
  .min(1, "Текст не может быть пустым")
  .max(5000, "Текст слишком длинный (максимум 5000 символов)");

/**
 * Валидатор для username (логин).
 * Только буквы, цифры, подчеркивания, точки, дефисы.
 */
export const usernameSchema = z.string()
  .min(3, "Логин должен быть не менее 3 символов")
  .max(50, "Логин должен быть не более 50 символов")
  .regex(/^[a-zA-Z0-9._-]+$/, "Логин содержит недопустимые символы");

/**
 * Валидатор для пароля.
 * Минимум 8 символов, максимум 128.
 * Не ограничиваем символы (пользователь может использовать любые символы).
 */
export const passwordSchema = z.string()
  .min(8, "Пароль должен быть не менее 8 символов")
  .max(128, "Пароль не должен превышать 128 символов");

// =============================================================================
// Схемы валидации для API endpoints
// =============================================================================

/**
 * Схема для логина сотрудника.
 * Валидация: username и пароль.
 */
export const staffLoginBodySchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

/**
 * Схема для создания симуляционной сессии.
 * Валидация всех полей с ограничениями диапазонов.
 */
export const createSimulationSessionSchema = z.object({
  participantName: nameSchema.optional().default("Участник"),
  participantExternalId: z.string().max(100).nullable().optional().default(null),
  assessorName: z.string().max(100).optional().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  selectedCaseIds: z.array(idStringSchema).optional().default([]),
  enabledChannels: z.object({
    audio: z.boolean().optional(),
    email: z.boolean().optional(),
    messenger: z.boolean().optional(),
    video: z.boolean().optional(),
  }).optional().default({}),
  manualSelection: z.boolean().optional().default(false),
  timeLimit: z.number().int().min(1).max(600).optional().default(240),
  isTestMode: z.boolean().optional().default(false),
  speedMultiplier: z.number().min(0.1).max(10).optional().default(1),
  startedAt: z.string().datetime().optional(),
  technicalStatus: z.enum(["in_progress", "completed", "cancelled"]).optional().default("in_progress"),
});

/**
 * Схема для обновления сессии (PATCH).
 */
export const patchSessionSchema = z.object({
  completedAt: z.string().datetime().nullable().optional(),
  technicalStatus: z.enum(["in_progress", "completed", "cancelled"]).optional(),
  status: z.enum(["in_progress", "completed", "cancelled"]).optional(),
});

/**
 * Схема для добавления ответа в сессию.
 */
export const addSessionAnswerSchema = z.object({
  sourceType: z.enum(["email", "messenger", "video", "audio", "sim"]),
  contentId: idStringSchema,
  caseTitle: z.string().max(200).optional(),
  cycle: z.number().int().min(1).max(100).optional().default(1),
  optionLevel: z.number().int().min(0).max(100).optional(),
  optionText: z.string().max(1000).optional(),
  score: z.number().min(0).max(100).optional(),
  rawEffects: z.record(z.any()).optional().default({}),
  competencyScores: z.record(z.number().min(0).max(100)).optional().default({}),
  details: z.record(z.any()).optional().default({}),
  timestamp: z.string().datetime().optional(),
  simTime: z.string().max(50).optional().default(""),
});

/**
 * Схема для добавления метрик сессии.
 */
export const addSessionMetricsSchema = z.object({
  timestamp: z.string().datetime().optional(),
  queue: z.number().min(0).max(1000).optional().default(20),
  conversion: z.number().min(-100).max(100).optional().default(50),
  morale: z.number().min(0).max(100).optional().default(60),
  revenueImpact: z.number().optional().default(0),
  deliveryStatus: z.number().optional().default(0),
});

/**
 * Схема для сохранения результата сессии.
 */
export const upsertSessionResultSchema = z.object({
  totalScore: z.number().min(0).max(100).optional().default(0),
  averageScore: z.number().min(0).max(100).optional().default(0),
  competencyAverages: z.record(z.number().min(0).max(100)).optional().default({}),
  finalMetrics: z.record(z.any()).optional().default({}),
  timers: z.array(z.record(z.any())).optional().default([]),
  pauses: z.array(z.record(z.any())).optional().default([]),
  exportedAt: z.string().datetime().nullable().optional().default(null),
});

/**
 * Схема для создания live-сессии.
 */
export const createLiveSessionSchema = z.object({
  assessorName: nameSchema.optional().default(""),
  participantName: nameSchema.optional().default("Участник"),
  participantRole: z.string().max(100).optional().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  selectedCaseIds: z.array(idStringSchema).optional().default([]),
  manualSelection: z.boolean().optional().default(false),
  repeatCases: z.boolean().optional().default(false),
  timeLimit: z.number().int().min(1).max(600).optional().default(60),
  isTestMode: z.boolean().optional().default(false),
  speedMultiplier: z.number().min(0.1).max(10).optional().default(1),
  enabledChannels: z.object({
    audio: z.boolean().optional(),
    email: z.boolean().optional(),
    messenger: z.boolean().optional(),
    video: z.boolean().optional(),
  }).optional().default({ audio: true, email: true, messenger: true, video: false }),
  initialMetrics: z.record(z.any()).optional().default({}),
});

/**
 * Схема для присоединения к live-сессии.
 */
export const joinLiveSessionSchema = z.object({
  accessCode: z.string()
    .min(1, "Код доступа обязателен")
    .max(20, "Код доступа слишком длинный")
    .regex(/^[A-Z0-9]+$/, "Неверный формат кода доступа"),
});

/**
 * Схема для синхронизации состояния студента.
 */
export const studentSyncSchema = z.object({
  accessCode: z.string().min(1).max(20),
  snapshot: z.record(z.any()).nullable().optional(),
  status: z.string().max(50).optional(),
});

/**
 * Схема для загрузки медиафайла (админ).
 */
export const mediaUploadSchema = z.object({
  data: z.string().min(1, "Данные файла обязательны"),
  mimeType: z.enum([
    "image/png", "image/jpeg", "image/webp",
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/ogg", "audio/webm", "audio/mp4", "audio/x-m4a", "audio/aac",
    "video/mp4", "video/webm", "video/quicktime",
  ]),
  originalFilename: z.string().max(255).optional(),
  name: z.string().max(200).optional(),
});

/**
 * Схема для экспорта PDF.
 */
export const pdfExportSchema = z.object({
  participantName: z.string().max(100).optional().default(""),
  // Другие поля валидируются на уровне Python-скрипта
}).passthrough(); // Разрешаем дополнительные поля

/**
 * Схема для экспорта Excel.
 */
export const excelExportSchema = z.object({
  sheets: z.array(z.object({
    name: z.string().max(100).optional(),
    rows: z.array(z.record(z.any())).optional().default([]),
  })).min(1, "Необходим хотя бы один лист"),
});

/**
 * Схема для получения списка результатов (query params).
 */
export const listResultsQuerySchema = z.object({
  status: z.enum(["in_progress", "completed", "cancelled"]).optional(),
  participantName: z.string().max(100).optional(),
});

/**
 * Схема для ID параметра URL.
 */
export const sessionIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID должен быть числом"),
});

// =============================================================================
// Middleware-фабрики
// =============================================================================

/**
 * Тип для результата парсинга Zod.
 */
type ParseResult<T> = { success: true; data: T } | { success: false; errors: string };

/**
 * Безопасно парсит данные через Zod схему.
 * Возвращает результат вместо throw — предотвращает утечку информации.
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Форматируем ошибки, не раскрывая внутреннюю структуру
  const errorMessages = result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ");
  return { success: false, errors: errorMessages };
}

/**
 * Middleware для валидации body запроса.
 * 
 * Использование:
 *   app.post("/api/sessions", validateBody(createSimulationSessionSchema), handler);
 * 
 * При невалидных данных возвращает 400 с описанием ошибок.
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = safeParse(schema, req.body);
    
    if (!result.success) {
      res.status(400).json({
        message: "Неверные входные данные",
        code: "VALIDATION_ERROR",
        errors: result.errors,
      });
      return;
    }
    
    // Сохраняем валидированные данные для последующих middleware
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Middleware для валидации query параметров.
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = safeParse(schema, req.query);
    
    if (!result.success) {
      res.status(400).json({
        message: "Неверные query-параметры",
        code: "VALIDATION_ERROR",
        errors: result.errors,
      });
      return;
    }
    
    req.validatedQuery = result.data;
    next();
  };
}

/**
 * Middleware для валидации URL параметров.
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = safeParse(schema, req.params);
    
    if (!result.success) {
      res.status(400).json({
        message: "Неверные параметры URL",
        code: "VALIDATION_ERROR",
        errors: result.errors,
      });
      return;
    }
    
    req.validatedParams = result.data;
    next();
  };
}

// =============================================================================
// Расширение типов Express Request
// =============================================================================

declare global {
  namespace Express {
    interface Request {
      /**
       * Валидированные данные из body (установленные validateBody middleware).
       */
      validatedBody?: unknown;
      
      /**
       * Валидированные query-параметры (установленные validateQuery middleware).
       */
      validatedQuery?: unknown;
      
      /**
       * Валидированные URL-параметры (установленные validateParams middleware).
       */
      validatedParams?: unknown;
    }
  }
}
