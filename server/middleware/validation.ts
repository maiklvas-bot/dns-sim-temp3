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
  .regex(/^[A-Za-zА-Яа-яЁё0-9\s._-]+$/, "Имя содержит недопустимые символы");

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
  role: z.enum(["admin", "evaluator"]).optional(),
  username: usernameSchema,
  password: passwordSchema,
});

export const staffElevationBodySchema = z.object({
  password: passwordSchema,
}).strict();

/** Форма обратной связи (категория, сообщение, опц. контакт + контекст экрана). */
export const feedbackBodySchema = z.object({
  category: z.string().trim().min(1).max(80),
  message: z.string().trim().min(5, "Сообщение слишком короткое").max(4000),
  contact: z.string().trim().max(200).optional(),
  url: z.string().trim().max(300).optional(),
}).strict();

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
  selectedChannelItemIds: z.object({
    email: z.array(idStringSchema).optional().default([]),
    messenger: z.array(idStringSchema).optional().default([]),
    video: z.array(idStringSchema).optional().default([]),
  }).optional(),
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
  sourceType: z.enum(["main_case", "email", "messenger", "video"]),
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
  assessorName: z.string().max(100).optional().default(""),
  participantName: nameSchema.optional().default("Участник"),
  participantRole: z.string().max(100).optional().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  selectedCaseIds: z.array(idStringSchema).optional().default([]),
  selectedChannelItemIds: z.object({
    email: z.array(idStringSchema).optional().default([]),
    messenger: z.array(idStringSchema).optional().default([]),
    video: z.array(idStringSchema).optional().default([]),
  }).optional(),
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
const emptyOrIdStringSchema = z.union([idStringSchema, z.literal("")]);
const nullableIdStringSchema = z.union([idStringSchema, z.literal(""), z.null()]);
const safeLooseTextSchema = (maxLength: number) => z.string()
  .max(maxLength)
  .refine((value) => !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value), "Text contains control characters");
const boundedIntSchema = (min: number, max: number) => z.number().int().min(min).max(max);
const boundedNumberSchema = (min: number, max: number) => z.number().finite().min(min).max(max);

const timingConfigSchema = z.object({
  arrivalMinute: boundedIntSchema(0, 10_000).nullable().optional(),
  minIntervalSeconds: boundedIntSchema(1, 86_400).nullable().optional(),
  maxIntervalSeconds: boundedIntSchema(1, 86_400).nullable().optional(),
  decisionDeadlineSeconds: boundedIntSchema(1, 86_400).nullable().optional(),
  reminderIntervalSeconds: boundedIntSchema(1, 86_400).nullable().optional(),
}).nullable().optional();

const metricEffectsSchema = z.object({
  queue: boundedNumberSchema(-1_000_000, 1_000_000).default(0),
  conversion: boundedNumberSchema(-1_000_000, 1_000_000).default(0),
  morale: boundedNumberSchema(-1_000_000, 1_000_000).default(0),
  revenue_impact: boundedNumberSchema(-1_000_000, 1_000_000).default(0),
  delivery_status: boundedNumberSchema(-1_000_000, 1_000_000).default(0),
});

const editableOptionSchema = z.object({
  id: emptyOrIdStringSchema.optional().default(""),
  level: boundedIntSchema(0, 1_000),
  text: safeLooseTextSchema(5_000),
  score: boundedIntSchema(-100, 100),
  comment: safeLooseTextSchema(2_000).nullable().optional().default(null),
  nextCycleId: z.union([idStringSchema, z.literal(""), z.literal("__complete"), z.null()]).optional().default(null),
  nextDelaySeconds: boundedIntSchema(0, 86_400).nullable().optional().default(null),
  nextChannel: z.enum(["main_case", "email", "messenger", "video"]).nullable().optional().default(null),
  status: z.enum(["active", "hidden", "draft"]).optional().default("active"),
  effects: metricEffectsSchema,
  competency_scores: z.record(idStringSchema, boundedNumberSchema(-100, 100)).optional().default({}),
});

const signalTypeSchema = z.enum(["message", "zone_signal", "email", "call", "visitor"]);
const zoneTypeSchema = z.enum(["торговый_зал", "склад", "выдача", "начальство"]);

const caseCycleSchema = z.object({
  id: emptyOrIdStringSchema.optional().default(""),
  cycle: boundedIntSchema(1, 100),
  title: safeLooseTextSchema(300).nullable().optional().default(null),
  description: safeLooseTextSchema(10_000).nullable().optional().default(null),
  source: safeLooseTextSchema(300).nullable().optional().default(null),
  situation: safeLooseTextSchema(10_000),
  zonesAffected: z.array(zoneTypeSchema).max(10).optional().default([]),
  timing: timingConfigSchema,
  status: z.enum(["active", "draft", "hidden"]).optional().default("active"),
  isFinal: z.boolean().optional().default(false),
  priority: z.enum(["normal", "high", "critical"]).optional().default("normal"),
  criticality: z.enum(["normal", "attention", "risk"]).optional().default("normal"),
  imageAssetId: nullableIdStringSchema.optional().default(null),
  audioAssetId: nullableIdStringSchema.optional().default(null),
  signal: z.object({
    type: signalTypeSchema,
    content: safeLooseTextSchema(5_000),
  }),
  options: z.array(editableOptionSchema).max(50).default([]),
});

export const editableSimCaseSchema = z.object({
  id: emptyOrIdStringSchema.optional().default(""),
  title: safeLooseTextSchema(300),
  description: safeLooseTextSchema(10_000),
  primaryCompetencies: z.array(idStringSchema).max(50).default([]),
  secondaryCompetencies: z.array(idStringSchema).max(50).default([]),
  trigger: z.object({
    type: signalTypeSchema,
    source: safeLooseTextSchema(300),
    text: safeLooseTextSchema(5_000),
  }),
  zones_affected: z.array(zoneTypeSchema).max(10).default([]),
  cycles: z.array(caseCycleSchema).min(1).max(50),
  imageAssetId: nullableIdStringSchema.optional().default(null),
  audioAssetId: nullableIdStringSchema.optional().default(null),
  timing: timingConfigSchema,
  sortOrder: boundedIntSchema(0, 100_000).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const editableChannelBaseSchema = z.object({
  id: emptyOrIdStringSchema.optional().default(""),
  arrivalMinute: boundedIntSchema(0, 10_000),
  options: z.array(editableOptionSchema).max(50).default([]),
  primaryCompetency: z.union([idStringSchema, z.literal("")]).optional().default(""),
  imageAssetId: nullableIdStringSchema.optional().default(null),
  audioAssetId: nullableIdStringSchema.optional().default(null),
  timing: timingConfigSchema,
  sortOrder: boundedIntSchema(0, 100_000).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const editableEmailCaseSchema = editableChannelBaseSchema.extend({
  subject: safeLooseTextSchema(300),
  from: safeLooseTextSchema(200),
  department: safeLooseTextSchema(200),
  departmentColor: safeLooseTextSchema(50),
  preview: safeLooseTextSchema(1_000),
  body: safeLooseTextSchema(20_000),
});

export const editableMessengerCaseSchema = editableChannelBaseSchema.extend({
  chatId: emptyOrIdStringSchema.optional().default(""),
  isGroup: z.boolean().optional().default(false),
  senderName: safeLooseTextSchema(200),
  senderRole: safeLooseTextSchema(200),
  senderAvatar: safeLooseTextSchema(200),
  message: safeLooseTextSchema(20_000),
});

export const editableVideoCaseSchema = editableChannelBaseSchema.extend({
  title: safeLooseTextSchema(300),
  sender: safeLooseTextSchema(200),
  role: safeLooseTextSchema(200),
  senderAvatar: safeLooseTextSchema(200),
  duration: safeLooseTextSchema(50),
  situation: safeLooseTextSchema(20_000),
  videoAssetId: nullableIdStringSchema.optional().default(null),
});

export const editableChatSchema = z.object({
  id: emptyOrIdStringSchema.optional().default(""),
  name: safeLooseTextSchema(300),
  isGroup: z.boolean().optional().default(false),
  avatar: safeLooseTextSchema(200),
  role: safeLooseTextSchema(200).optional().default(""),
  icon: safeLooseTextSchema(100).optional().default(""),
  members: z.array(safeLooseTextSchema(200)).max(100).optional().default([]),
  sortOrder: boundedIntSchema(0, 100_000).optional().default(0),
});

export const adminCaseReorderSchema = z.object({
  ids: z.array(idStringSchema).max(1_000),
});

const nullableAssetSettingSchema = nullableIdStringSchema.optional().default(null);

export const adminSettingsSchema = z.object({
  firstSignalMinSeconds: boundedIntSchema(0, 86_400).optional(),
  firstSignalMaxSeconds: boundedIntSchema(0, 86_400).optional(),
  signalIntervalMinSeconds: boundedIntSchema(0, 86_400).optional(),
  signalIntervalMaxSeconds: boundedIntSchema(0, 86_400).optional(),
  reminderIntervalSeconds: boundedIntSchema(1, 86_400).optional(),
  easyAutoCaseCount: boundedIntSchema(0, 100).optional(),
  mediumAutoCaseCount: boundedIntSchema(0, 100).optional(),
  hardAutoCaseCount: boundedIntSchema(0, 100).optional(),
  defaultTimePerCaseMinutes: boundedIntSchema(1, 600).optional(),
  minSimulationMinutes: boundedIntSchema(1, 600).optional(),
  waitingImageAssetId: nullableAssetSettingSchema,
  callSoundAssetId: nullableAssetSettingSchema,
  emailSoundAssetId: nullableAssetSettingSchema,
  messengerSoundAssetId: nullableAssetSettingSchema,
  videoSoundAssetId: nullableAssetSettingSchema,
  preSimulationInstructionHtml: safeLooseTextSchema(50_000).nullable().optional(),
  preSimulationInstructionVideoAssetId: nullableAssetSettingSchema,
  caseWeights: z.record(idStringSchema, boundedNumberSchema(0, 100)).optional().default({}),
  timeInfluenceEnabled: z.boolean().optional(),
});

export const stringIdParamSchema = z.object({
  id: idStringSchema,
});

export const liveSessionIdParamSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[A-Za-z0-9._:-]+$/),
});

export const liveRecoverSessionParamSchema = z.object({
  sessionId: z.string().regex(/^\d+$/, "sessionId must be numeric"),
});

export const liveSessionAccessQuerySchema = z.object({
  accessCode: z.string().max(20).optional(),
});

const pdfSafeText = (maxLength: number) => z.string()
  .max(maxLength)
  .refine((value) => !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value), "Text contains control characters");

const pdfNumberSchema = z.number().finite().min(-1_000_000_000).max(1_000_000_000);
const pdfScoreSchema = z.number().finite().min(0).max(100);
const pdfCompetencyScoreSchema = z.number().finite().min(0).max(5);
const pdfRecordKeySchema = z.string().min(1).max(80).regex(/^[A-Za-z0-9._:-]+$/);
const pdfPrimitiveSchema = z.union([
  pdfNumberSchema,
  pdfSafeText(500),
  z.boolean(),
  z.null(),
]);

function limitedPdfRecord<T extends z.ZodTypeAny>(valueSchema: T, maxKeys: number) {
  return z.record(pdfRecordKeySchema, valueSchema)
    .refine((value) => Object.keys(value).length <= maxKeys, `Record has too many keys; maximum is ${maxKeys}`);
}

const pdfDecisionSchema = z.object({
  caseTitle: pdfSafeText(300).optional().default(""),
  cycle: z.number().int().min(0).max(1000).optional(),
  optionText: pdfSafeText(3000).optional().default(""),
  score: pdfScoreSchema.optional().default(0),
  simTime: pdfSafeText(80).optional().default(""),
  competencyScores: limitedPdfRecord(pdfCompetencyScoreSchema, 60).optional().default({}),
  rawEffects: limitedPdfRecord(pdfPrimitiveSchema, 80).optional().default({}),
  taskType: pdfSafeText(120).optional().default(""),
}).strict();

const pdfPatternSchema = z.object({
  label: pdfSafeText(160),
  value: pdfSafeText(1000),
}).strict();

const pdfPauseSchema = z.object({
  startedAtUnixMs: z.number().int().min(0).max(4_102_444_800_000).optional(),
  endedAtUnixMs: z.number().int().min(0).max(4_102_444_800_000).optional(),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60),
}).strict();

const pdfVerdictSchema = z.object({
  level: pdfSafeText(120).optional().default(""),
  description: pdfSafeText(1000).optional().default(""),
}).strict();

const pdfImpactfulDecisionSchema = z.object({
  caseTitle: pdfSafeText(300).optional().default(""),
  score: pdfScoreSchema.optional().default(0),
  simTime: pdfSafeText(80).optional().default(""),
  optionText: pdfSafeText(3000).optional().default(""),
  taskType: pdfSafeText(120).optional().default(""),
  impactMagnitude: pdfNumberSchema.optional().default(0),
}).strict();

export const pdfExportSchema = z.object({
  sessionId: z.number().int().positive().optional(),
  participantName: pdfSafeText(100).optional().default(""),
  assessorName: pdfSafeText(100).optional().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  decisions: z.array(pdfDecisionSchema).max(500).optional().default([]),
  competencyScores: limitedPdfRecord(pdfCompetencyScoreSchema, 60).optional().default({}),
  expectedCompetencyScores: limitedPdfRecord(pdfCompetencyScoreSchema, 60).optional().default({}),
  finalMetrics: limitedPdfRecord(pdfPrimitiveSchema, 80).optional().default({}),
  patterns: z.array(pdfPatternSchema).max(50).optional().default([]),
  avgScore: pdfScoreSchema.optional().default(0),
  totalTimeMinutes: z.number().int().min(0).max(10_000).optional().default(0),
  pauses: z.array(pdfPauseSchema).max(50).optional().default([]),
  verdict: pdfVerdictSchema.optional().default({}),
  retestDate: pdfSafeText(120).optional().default(""),
  impactfulDecisions: z.array(pdfImpactfulDecisionSchema).max(100).optional().default([]),
}).strict();

/**
 * Схема для экспорта Excel.
 */
export const excelExportSchema = z.object({
  sessionId: z.number().int().positive().optional(),
  sheets: z.array(z.object({
    name: z.string().max(100).optional(),
    rows: z.array(
      z.array(z.union([
        z.string().max(10_000),
        z.number().finite(),
        z.boolean(),
        z.null(),
      ])).max(250),
    ).max(10_000).optional().default([]),
  }).strict()).min(1, "Необходим хотя бы один лист").max(20),
}).strict();

/**
 * Схема для получения списка результатов (query params).
 */
export const listResultsQuerySchema = z.object({
  status: z.enum(["in_progress", "completed", "cancelled"]).optional(),
  participantName: z.string().max(100).optional(),
});

export const auditLogsQuerySchema = z.object({
  area: z.enum(["security", "admin", "evaluator", "simulation", "system"]).optional(),
  actor: z.string().trim().min(1).max(100).optional(),
  action: z.string().trim().min(1).max(100).optional(),
  outcome: z.enum(["success", "failure"]).optional(),
  search: z.string().trim().max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(100_000).optional().default(0),
});

/**
 * Схема для ID параметра URL.
 */
export const sessionIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID должен быть числом"),
});

// =============================================================================
// Симуляция ЗРД (Фаза 3)
// =============================================================================

export const createZrdSessionSchema = z.object({
  participantName: nameSchema.optional().default("Участник"),
  assessorName: z.string().max(100).optional().default(""),
  difficulty: z.number().int().min(1).max(5).optional().default(3),
  region: z.string().max(60).nullable().optional().default(null),
  seed: z.number().int().min(0).max(2147483647).optional(),
  quarters: z.number().int().min(1).max(8).optional().default(4),
});

const zrdStrategySchema = z.enum(["service", "expansion", "efficiency"]);
const zrdStandardActionSchema = z.enum(["open_basic", "hire", "promo", "improve_service", "improve_logistics"]);
const zrdOptionIdSchema = z.string().regex(/^[a-z_]+$/, "Некорректный id варианта").max(40);

/** Намерение хода (TurnIntent) — дискриминированное объединение по полю kind. */
export const zrdIntentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("declareStrategy"), strategy: zrdStrategySchema }),
  z.object({ kind: z.literal("keepCards"), cardIds: z.array(idStringSchema).max(4) }),
  z.object({ kind: z.literal("playCard"), cardId: idStringSchema }),
  z.object({ kind: z.literal("standard"), action: zrdStandardActionSchema }),
  z.object({ kind: z.literal("viewData") }),
  z.object({ kind: z.literal("eventChoice"), optionId: zrdOptionIdSchema }),
  z.object({ kind: z.literal("pass") }),
]);

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
