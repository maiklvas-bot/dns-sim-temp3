import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  usernameIdx: uniqueIndex("admins_username_idx").on(table.username),
}));

export const evaluatorAccounts = sqliteTable("evaluator_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  usernameIdx: uniqueIndex("evaluator_accounts_username_idx").on(table.username),
}));

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  area: text("area").notNull(),
  action: text("action").notNull(),
  outcome: text("outcome").notNull().default("success"),
  actorId: integer("actor_id"),
  actorUsername: text("actor_username"),
  actorDisplayName: text("actor_display_name"),
  actorRole: text("actor_role"),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  changedFieldsJson: text("changed_fields_json").notNull().default("[]"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  metadataJson: text("metadata_json").notNull().default("{}"),
}, (table) => ({
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  areaIdx: index("audit_logs_area_idx").on(table.area),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  actorUsernameIdx: index("audit_logs_actor_username_idx").on(table.actorUsername),
  ipAddressIdx: index("audit_logs_ip_address_idx").on(table.ipAddress),
}));

export const participants = sqliteTable("participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id"),
  fullName: text("full_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  externalIdIdx: uniqueIndex("participants_external_id_idx").on(table.externalId),
}));

export const competencies = sqliteTable("competencies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("image"),
  mimeType: text("mime_type").notNull(),
  storagePath: text("storage_path").notNull(),
  originalFilename: text("original_filename"),
  sizeBytes: integer("size_bytes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const simulationCases = sqliteTable("simulation_cases", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  primaryCompetenciesJson: text("primary_competencies_json").notNull().default("[]"),
  secondaryCompetenciesJson: text("secondary_competencies_json").notNull().default("[]"),
  zonesAffectedJson: text("zones_affected_json").notNull().default("[]"),
  imageAssetId: text("image_asset_id"),
  audioAssetId: text("audio_asset_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  orderIdx: index("simulation_cases_order_idx").on(table.sortOrder),
}));

export const caseSignals = sqliteTable("case_signals", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull(),
  cycleId: text("cycle_id"),
  signalRole: text("signal_role").notNull(), // trigger | cycle
  signalType: text("signal_type").notNull(),
  source: text("source"),
  text: text("text"),
  content: text("content"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const caseCycles = sqliteTable("case_cycles", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull(),
  cycleNumber: integer("cycle_number").notNull(),
  title: text("title"),
  description: text("description"),
  source: text("source"),
  situation: text("situation").notNull(),
  zonesAffectedJson: text("zones_affected_json").notNull().default("[]"),
  timingJson: text("timing_json").notNull().default("{}"),
  status: text("status").notNull().default("active"),
  isFinal: integer("is_final", { mode: "boolean" }).notNull().default(false),
  priority: text("priority").notNull().default("normal"),
  criticality: text("criticality").notNull().default("normal"),
  imageAssetId: text("image_asset_id"),
  audioAssetId: text("audio_asset_id"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  caseCycleIdx: uniqueIndex("case_cycles_case_cycle_idx").on(table.caseId, table.cycleNumber),
}));

export const caseTimings = sqliteTable("case_timings", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(), // main_case | email | messenger | video
  sourceId: text("source_id").notNull(),
  arrivalMinute: integer("arrival_minute"),
  minIntervalSeconds: integer("min_interval_seconds"),
  maxIntervalSeconds: integer("max_interval_seconds"),
  decisionDeadlineSeconds: integer("decision_deadline_seconds"),
  reminderIntervalSeconds: integer("reminder_interval_seconds").notNull().default(5),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
}, (table) => ({
  sourceIdx: uniqueIndex("case_timings_source_idx").on(table.sourceType, table.sourceId),
}));

export const caseImages = sqliteTable("case_images", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(), // main_case | email | messenger | video
  sourceId: text("source_id").notNull(),
  assetId: text("asset_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(true),
}, (table) => ({
  sourceIdx: uniqueIndex("case_images_source_idx").on(table.sourceType, table.sourceId, table.sortOrder),
}));

export const caseOptions = sqliteTable("case_options", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull(),
  level: integer("level").notNull(),
  text: text("text").notNull(),
  score: integer("score").notNull(),
  comment: text("comment"),
  nextCycleId: text("next_cycle_id"),
  nextDelaySeconds: integer("next_delay_seconds"),
  nextChannel: text("next_channel"),
  status: text("status").notNull().default("active"),
  effectQueue: integer("effect_queue").notNull().default(0),
  effectConversion: integer("effect_conversion").notNull().default(0),
  effectMorale: integer("effect_morale").notNull().default(0),
  effectRevenueImpact: integer("effect_revenue_impact").notNull().default(0),
  effectDeliveryStatus: integer("effect_delivery_status").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  cycleLevelIdx: uniqueIndex("case_options_cycle_level_idx").on(table.cycleId, table.level),
}));

export const messengerChats = sqliteTable("messenger_chats", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isGroup: integer("is_group", { mode: "boolean" }).notNull().default(false),
  avatar: text("avatar").notNull(),
  role: text("role"),
  icon: text("icon"),
  membersJson: text("members_json").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const channelItems = sqliteTable("channel_items", {
  id: text("id").primaryKey(),
  channelType: text("channel_type").notNull(), // email | messenger | video
  chatId: text("chat_id"),
  isGroup: integer("is_group", { mode: "boolean" }),
  title: text("title").notNull(),
  subject: text("subject"),
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role"),
  senderAvatar: text("sender_avatar"),
  department: text("department"),
  departmentColor: text("department_color"),
  preview: text("preview"),
  body: text("body"),
  duration: text("duration"),
  arrivalMinute: integer("arrival_minute").notNull().default(0),
  primaryCompetency: text("primary_competency").notNull(),
  imageAssetId: text("image_asset_id"),
  audioAssetId: text("audio_asset_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  channelOrderIdx: index("channel_items_channel_order_idx").on(table.channelType, table.sortOrder),
}));

export const channelOptions = sqliteTable("channel_options", {
  id: text("id").primaryKey(),
  channelItemId: text("channel_item_id").notNull(),
  level: integer("level").notNull(),
  text: text("text").notNull(),
  score: integer("score").notNull(),
  effectQueue: integer("effect_queue").notNull().default(0),
  effectConversion: integer("effect_conversion").notNull().default(0),
  effectMorale: integer("effect_morale").notNull().default(0),
  effectRevenueImpact: integer("effect_revenue_impact").notNull().default(0),
  effectDeliveryStatus: integer("effect_delivery_status").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  itemLevelIdx: uniqueIndex("channel_options_item_level_idx").on(table.channelItemId, table.level),
}));

export const scoringRules = sqliteTable("scoring_rules", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(), // case_option | channel_option
  sourceOptionId: text("source_option_id").notNull(),
  competencyId: text("competency_id").notNull(),
  score: integer("score").notNull(),
}, (table) => ({
  sourceCompetencyIdx: uniqueIndex("scoring_rules_source_competency_idx").on(table.sourceType, table.sourceOptionId, table.competencyId),
}));

export const simulationSettings = sqliteTable("simulation_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstSignalMinSeconds: integer("first_signal_min_seconds").notNull().default(15),
  firstSignalMaxSeconds: integer("first_signal_max_seconds").notNull().default(30),
  signalIntervalMinSeconds: integer("signal_interval_min_seconds").notNull().default(120),
  signalIntervalMaxSeconds: integer("signal_interval_max_seconds").notNull().default(180),
  reminderIntervalSeconds: integer("reminder_interval_seconds").notNull().default(5),
  easyAutoCaseCount: integer("easy_auto_case_count").notNull().default(6),
  mediumAutoCaseCount: integer("medium_auto_case_count").notNull().default(10),
  hardAutoCaseCount: integer("hard_auto_case_count").notNull().default(14),
  defaultTimePerCaseMinutes: integer("default_time_per_case_minutes").notNull().default(4),
  minSimulationMinutes: integer("min_simulation_minutes").notNull().default(20),
  waitingImageAssetId: text("waiting_image_asset_id"),
  callSoundAssetId: text("call_sound_asset_id"),
  emailSoundAssetId: text("email_sound_asset_id"),
  messengerSoundAssetId: text("messenger_sound_asset_id"),
  videoSoundAssetId: text("video_sound_asset_id"),
  preSimulationInstructionHtml: text("pre_simulation_instruction_html"),
  preSimulationInstructionVideoAssetId: text("pre_simulation_instruction_video_asset_id"),
  caseWeightsJson: text("case_weights_json").notNull().default("{}"),
  timeInfluenceEnabled: integer("time_influence_enabled", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const simulationSessions = sqliteTable("simulation_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  participantId: integer("participant_id"),
  participantTokenHash: text("participant_token_hash"),
  participantName: text("participant_name").notNull(),
  evaluatorAccountId: integer("evaluator_account_id"),
  evaluatorName: text("evaluator_name").notNull().default(""),
  difficulty: text("difficulty").notNull().default("medium"),
  selectedCaseIdsJson: text("selected_case_ids_json").notNull().default("[]"),
  enabledChannelsJson: text("enabled_channels_json").notNull().default("{}"),
  manualSelection: integer("manual_selection", { mode: "boolean" }).notNull().default(false),
  timeLimit: integer("time_limit").notNull().default(240),
  isTestMode: integer("is_test_mode", { mode: "boolean" }).notNull().default(false),
  speedMultiplier: integer("speed_multiplier").notNull().default(1),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  technicalStatus: text("technical_status").notNull().default("in_progress"), // in_progress | completed | interrupted
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  statusIdx: index("simulation_sessions_status_idx").on(table.technicalStatus),
  startedIdx: index("simulation_sessions_started_idx").on(table.startedAt),
}));

export const sessionAnswers = sqliteTable("session_answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => simulationSessions.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // main_case | email | messenger | video
  contentId: text("content_id").notNull(),
  caseTitle: text("case_title").notNull(),
  cycle: integer("cycle").notNull().default(1),
  optionLevel: integer("option_level").notNull(),
  optionText: text("option_text").notNull(),
  score: integer("score").notNull(),
  rawEffectsJson: text("raw_effects_json").notNull().default("{}"),
  competencyScoresJson: text("competency_scores_json").notNull().default("{}"),
  detailsJson: text("details_json").notNull().default("{}"),
  timestamp: text("timestamp").notNull(),
  simTime: text("sim_time").notNull(),
}, (table) => ({
  sessionIdx: index("session_answers_session_idx").on(table.sessionId),
}));

export const sessionResults = sqliteTable("session_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => simulationSessions.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").notNull().default(0),
  averageScore: integer("average_score").notNull().default(0),
  competencyAveragesJson: text("competency_averages_json").notNull().default("{}"),
  finalMetricsJson: text("final_metrics_json").notNull().default("{}"),
  timersJson: text("timers_json").notNull().default("[]"),
  pausesJson: text("pauses_json").notNull().default("[]"),
  exportedAt: text("exported_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  sessionIdx: uniqueIndex("session_results_session_idx").on(table.sessionId),
}));

export const sessionMetrics = sqliteTable("session_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => simulationSessions.id, { onDelete: "cascade" }),
  timestamp: text("timestamp").notNull(),
  queue: integer("queue").notNull().default(20),
  conversion: integer("conversion").notNull().default(50),
  morale: integer("morale").notNull().default(60),
  revenueImpact: integer("revenue_impact").notNull().default(0),
  deliveryStatus: integer("delivery_status").notNull().default(0),
}, (table) => ({
  sessionIdx: index("session_metrics_session_idx").on(table.sessionId),
}));

export const insertSimulationSessionSchema = createInsertSchema(simulationSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionAnswerSchema = createInsertSchema(sessionAnswers).omit({
  id: true,
});

export const insertSessionMetricsSchema = createInsertSchema(sessionMetrics).omit({
  id: true,
});

export const insertSessionResultSchema = createInsertSchema(sessionResults).omit({
  id: true,
  createdAt: true,
});

export const staffLoginSchema = z.object({
  role: z.enum(["admin", "evaluator"]),
  username: z.string().min(1),
  password: z.string().min(1),
});

export type AdminAccount = typeof admins.$inferSelect;
export type EvaluatorAccount = typeof evaluatorAccounts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Competency = typeof competencies.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type SimulationCaseRecord = typeof simulationCases.$inferSelect;
export type CaseSignalRecord = typeof caseSignals.$inferSelect;
export type CaseCycleRecord = typeof caseCycles.$inferSelect;
export type CaseOptionRecord = typeof caseOptions.$inferSelect;
export type CaseTimingRecord = typeof caseTimings.$inferSelect;
export type CaseImageRecord = typeof caseImages.$inferSelect;
export type MessengerChatRecord = typeof messengerChats.$inferSelect;
export type ChannelItemRecord = typeof channelItems.$inferSelect;
export type ChannelOptionRecord = typeof channelOptions.$inferSelect;
export type ScoringRuleRecord = typeof scoringRules.$inferSelect;
export type SimulationSettingsRecord = typeof simulationSettings.$inferSelect;
export type SimulationSession = typeof simulationSessions.$inferSelect;
export type SessionAnswer = typeof sessionAnswers.$inferSelect;
export type SessionResult = typeof sessionResults.$inferSelect;
export type SessionMetrics = typeof sessionMetrics.$inferSelect;

export type InsertSimulationSession = z.infer<typeof insertSimulationSessionSchema>;
export type InsertSessionAnswer = z.infer<typeof insertSessionAnswerSchema>;
export type InsertSessionMetrics = z.infer<typeof insertSessionMetricsSchema>;
export type InsertSessionResult = z.infer<typeof insertSessionResultSchema>;
export type StaffLoginPayload = z.infer<typeof staffLoginSchema>;
