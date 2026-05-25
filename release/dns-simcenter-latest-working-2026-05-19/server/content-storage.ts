import { and, asc, eq, inArray, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  caseCycles,
  caseImages,
  caseOptions,
  caseSignals,
  caseTimings,
  channelItems,
  channelOptions,
  competencies,
  mediaAssets,
  messengerChats,
  scoringRules,
  simulationCases,
  simulationSettings,
} from "@shared/schema";
import type {
  ChatInfo,
  EmailCase,
  MessengerCase,
  PublicMediaAsset,
  PublicSimulationContent,
  SimCase,
  SimulationRuntimeSettings,
  VideoCase,
} from "@shared/simulation-content";
import { db } from "./db";
import { buildPublicAssetUrl, parseJsonArray } from "./data-utils";

interface EditableTiming {
  arrivalMinute?: number | null;
  minIntervalSeconds?: number | null;
  maxIntervalSeconds?: number | null;
  reminderIntervalSeconds?: number | null;
}

type TimingSourceType = "main_case" | "email" | "messenger" | "video";

export interface EditableSimCase extends SimCase {
  timing?: EditableTiming | null;
}

export interface EditableEmailCase extends EmailCase {
  timing?: EditableTiming | null;
}

export interface EditableMessengerCase extends MessengerCase {
  timing?: EditableTiming | null;
}

export interface EditableVideoCase extends VideoCase {
  timing?: EditableTiming | null;
}

export interface StoredAssetInput {
  id?: string;
  name: string;
  kind: "image" | "audio" | "video";
  mimeType: string;
  storagePath: string;
  originalFilename?: string | null;
  sizeBytes?: number | null;
}

function getDefaultReminderInterval(sourceType: TimingSourceType) {
  return sourceType === "messenger" ? 5 : 180;
}

function normalizeTiming(sourceType: TimingSourceType, timing?: EditableTiming | null) {
  return {
    arrivalMinute: timing?.arrivalMinute ?? null,
    minIntervalSeconds: timing?.minIntervalSeconds ?? null,
    maxIntervalSeconds: timing?.maxIntervalSeconds ?? null,
    reminderIntervalSeconds: timing?.reminderIntervalSeconds ?? getDefaultReminderInterval(sourceType),
  };
}

function parseJsonObject<T extends Record<string, any>>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

export class ContentStorage {
  private mapSettingsRow(row: typeof simulationSettings.$inferSelect | undefined) {
    if (!row) {
      return row;
    }

    return {
      ...row,
      caseWeights: parseJsonObject<Record<string, number>>(row.caseWeightsJson, {}),
      timeInfluenceEnabled: Boolean(row.timeInfluenceEnabled),
    };
  }

  getSettings() {
    const row = db.select().from(simulationSettings).limit(1).get();
    return this.mapSettingsRow(row);
  }

  updateSettings(payload: Partial<SimulationRuntimeSettings>) {
    const normalizedPayload: Record<string, unknown> = {
      ...(payload as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    };

    if ("caseWeights" in normalizedPayload) {
      normalizedPayload.caseWeightsJson = JSON.stringify(normalizedPayload.caseWeights || {});
      delete normalizedPayload.caseWeights;
    }

    const current = this.getSettings();
    if (!current) {
      const inserted = db.insert(simulationSettings).values({
        ...normalizedPayload,
      }).returning().get();
      return this.mapSettingsRow(inserted);
    }

    const updated = db.update(simulationSettings).set({
      ...normalizedPayload,
    }).where(eq(simulationSettings.id, current.id)).returning().get();
    return this.mapSettingsRow(updated);
  }

  listAssets(): PublicMediaAsset[] {
    return db.select().from(mediaAssets).orderBy(asc(mediaAssets.name)).all().map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind as "image" | "audio" | "video",
      mimeType: asset.mimeType,
      storagePath: asset.storagePath,
      publicUrl: buildPublicAssetUrl(asset.storagePath),
    }));
  }

  createAsset(input: StoredAssetInput) {
    return db.insert(mediaAssets).values({
      id: input.id || nanoid(),
      name: input.name,
      kind: input.kind,
      mimeType: input.mimeType,
      storagePath: input.storagePath,
      originalFilename: input.originalFilename ?? null,
      sizeBytes: input.sizeBytes ?? null,
    }).returning().get();
  }

  getPublicContent(includeInactive = false): PublicSimulationContent & { settings: ReturnType<ContentStorage["getSettings"]> | undefined } {
    const competencyQuery = db.select().from(competencies).orderBy(asc(competencies.sortOrder));
    const caseQuery = db.select().from(simulationCases).orderBy(asc(simulationCases.sortOrder));
    const cycleRows = db.select().from(caseCycles).orderBy(asc(caseCycles.sortOrder)).all();
    const signalRows = db.select().from(caseSignals).orderBy(asc(caseSignals.sortOrder)).all();
    const optionRows = db.select().from(caseOptions).orderBy(asc(caseOptions.sortOrder)).all();
    const chatQuery = db.select().from(messengerChats).orderBy(asc(messengerChats.sortOrder));
    const channelQuery = db.select().from(channelItems).orderBy(asc(channelItems.sortOrder));
    const channelOptionRows = db.select().from(channelOptions).orderBy(asc(channelOptions.sortOrder)).all();
    const scoringRows = db.select().from(scoringRules).all();
    const timingQuery = db.select().from(caseTimings);
    const assets = this.listAssets();

    const competencyRows = includeInactive ? competencyQuery.all() : competencyQuery.where(eq(competencies.isActive, true)).all();
    const caseRows = includeInactive ? caseQuery.all() : caseQuery.where(eq(simulationCases.isActive, true)).all();
    const chatRows = includeInactive ? chatQuery.all() : chatQuery.where(eq(messengerChats.isActive, true)).all();
    const channelRows = includeInactive ? channelQuery.all() : channelQuery.where(eq(channelItems.isActive, true)).all();
    const timingRows = includeInactive ? timingQuery.all() : timingQuery.where(eq(caseTimings.isActive, true)).all();

    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
    const rulesByOption = new Map<string, Record<string, number>>();
    for (const row of scoringRows) {
      const key = `${row.sourceType}:${row.sourceOptionId}`;
      const current = rulesByOption.get(key) || {};
      current[row.competencyId] = row.score;
      rulesByOption.set(key, current);
    }

    const cyclesByCase = new Map<string, typeof cycleRows>();
    cycleRows.forEach((row) => {
      const current = cyclesByCase.get(row.caseId) || [];
      current.push(row);
      cyclesByCase.set(row.caseId, current);
    });

    const signalsByCase = new Map<string, typeof signalRows>();
    signalRows.forEach((row) => {
      const current = signalsByCase.get(row.caseId) || [];
      current.push(row);
      signalsByCase.set(row.caseId, current);
    });

    const optionsByCycle = new Map<string, typeof optionRows>();
    optionRows.forEach((row) => {
      const current = optionsByCycle.get(row.cycleId) || [];
      current.push(row);
      optionsByCycle.set(row.cycleId, current);
    });

    const optionsByChannelItem = new Map<string, typeof channelOptionRows>();
    channelOptionRows.forEach((row) => {
      const current = optionsByChannelItem.get(row.channelItemId) || [];
      current.push(row);
      optionsByChannelItem.set(row.channelItemId, current);
    });

    const timingsBySource = new Map<string, typeof timingRows[number]>();
    timingRows.forEach((row) => {
      timingsBySource.set(`${row.sourceType}:${row.sourceId}`, row);
    });

    const cases = caseRows.map((row) => {
      const caseSignalsRows = signalsByCase.get(row.id) || [];
      const trigger = caseSignalsRows.find((signal) => signal.signalRole === "trigger");
      const image = row.imageAssetId ? assetMap.get(row.imageAssetId) || null : null;
      const audio = row.audioAssetId ? assetMap.get(row.audioAssetId) || null : null;
      const timing = timingsBySource.get(`main_case:${row.id}`);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        primaryCompetencies: parseJsonArray<string>(row.primaryCompetenciesJson, []),
        secondaryCompetencies: parseJsonArray<string>(row.secondaryCompetenciesJson, []),
        trigger: {
          type: (trigger?.signalType || "message") as SimCase["trigger"]["type"],
          source: trigger?.source || "",
          text: trigger?.text || "",
        },
        zones_affected: parseJsonArray<SimCase["zones_affected"][number]>(row.zonesAffectedJson, []),
        cycles: (cyclesByCase.get(row.id) || [])
          .sort((a, b) => a.cycleNumber - b.cycleNumber)
          .map((cycle) => {
            const signal = caseSignalsRows.find((item) => item.signalRole === "cycle" && item.cycleId === cycle.id);
            return {
              id: cycle.id,
              cycle: cycle.cycleNumber,
              situation: cycle.situation,
              signal: {
                type: (signal?.signalType || "message") as SimCase["cycles"][number]["signal"]["type"],
                content: signal?.content || "",
              },
              options: (optionsByCycle.get(cycle.id) || [])
                .sort((a, b) => a.level - b.level)
                .map((option) => ({
                  id: option.id,
                  level: option.level,
                  text: option.text,
                  score: option.score,
                  effects: {
                    queue: option.effectQueue,
                    conversion: option.effectConversion,
                    morale: option.effectMorale,
                    revenue_impact: option.effectRevenueImpact,
                    delivery_status: option.effectDeliveryStatus,
                  },
                  competency_scores: rulesByOption.get(`case_option:${option.id}`) || {},
                })),
            };
        }),
        imageAssetId: row.imageAssetId,
        imageUrl: image?.publicUrl || null,
        audioAssetId: row.audioAssetId,
        audioUrl: audio?.publicUrl || null,
        timing: timing ? {
          arrivalMinute: timing.arrivalMinute,
          minIntervalSeconds: timing.minIntervalSeconds,
          maxIntervalSeconds: timing.maxIntervalSeconds,
          reminderIntervalSeconds: timing.reminderIntervalSeconds,
        } : null,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      };
    });

    const emailCases = channelRows
      .filter((row) => row.channelType === "email")
      .map((row) => this.mapEmailCase(row, optionsByChannelItem, rulesByOption, assetMap, timingsBySource));
    const messengerCases = channelRows
      .filter((row) => row.channelType === "messenger")
      .map((row) => this.mapMessengerCase(row, optionsByChannelItem, rulesByOption, assetMap, timingsBySource));
    const videoCases = channelRows
      .filter((row) => row.channelType === "video")
      .map((row) => this.mapVideoCase(row, optionsByChannelItem, rulesByOption, assetMap, timingsBySource));

    return {
      competencies: competencyRows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category as "basic" | "advanced" | "leadership",
      })),
      cases,
      emailCases,
      messengerCases,
      messengerChats: chatRows.map((row) => ({
        id: row.id,
        name: row.name,
        isGroup: row.isGroup,
        avatar: row.avatar,
        role: row.role || undefined,
        icon: row.icon || undefined,
        members: parseJsonArray<string>(row.membersJson, []),
        sortOrder: row.sortOrder,
      })),
      videoCases,
      assets,
      settings: this.getSettings(),
    };
  }

  private mapEmailCase(
    row: typeof channelItems.$inferSelect,
    optionsByChannelItem: Map<string, typeof channelOptions.$inferSelect[]>,
    rulesByOption: Map<string, Record<string, number>>,
    assetMap: Map<string, PublicMediaAsset>,
    timingsBySource: Map<string, typeof caseTimings.$inferSelect>,
  ): EmailCase {
    const image = row.imageAssetId ? assetMap.get(row.imageAssetId) || null : null;
    const audio = row.audioAssetId ? assetMap.get(row.audioAssetId) || null : null;
    const timing = timingsBySource.get(`email:${row.id}`);
    return {
      id: row.id,
      subject: row.subject || row.title,
      from: row.senderName,
      department: row.department || "",
      departmentColor: row.departmentColor || "#4a9eff",
      preview: row.preview || "",
      body: row.body || "",
      arrivalMinute: row.arrivalMinute,
      options: (optionsByChannelItem.get(row.id) || []).sort((a, b) => a.level - b.level).map((option) => ({
        id: option.id,
        level: option.level,
        text: option.text,
        score: option.score,
        effects: {
          queue: option.effectQueue,
          conversion: option.effectConversion,
          morale: option.effectMorale,
          revenue_impact: option.effectRevenueImpact,
          delivery_status: option.effectDeliveryStatus,
        },
        competency_scores: rulesByOption.get(`channel_option:${option.id}`) || {},
      })),
      primaryCompetency: row.primaryCompetency,
      imageAssetId: row.imageAssetId,
      imageUrl: image?.publicUrl || null,
      audioAssetId: row.audioAssetId,
      audioUrl: audio?.publicUrl || null,
      timing: timing ? {
        arrivalMinute: timing.arrivalMinute,
        minIntervalSeconds: timing.minIntervalSeconds,
        maxIntervalSeconds: timing.maxIntervalSeconds,
        reminderIntervalSeconds: timing.reminderIntervalSeconds,
      } : null,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  }

  private mapMessengerCase(
    row: typeof channelItems.$inferSelect,
    optionsByChannelItem: Map<string, typeof channelOptions.$inferSelect[]>,
    rulesByOption: Map<string, Record<string, number>>,
    assetMap: Map<string, PublicMediaAsset>,
    timingsBySource: Map<string, typeof caseTimings.$inferSelect>,
  ): MessengerCase {
    const image = row.imageAssetId ? assetMap.get(row.imageAssetId) || null : null;
    const audio = row.audioAssetId ? assetMap.get(row.audioAssetId) || null : null;
    const timing = timingsBySource.get(`messenger:${row.id}`);
    return {
      id: row.id,
      chatId: row.chatId || "",
      isGroup: Boolean(row.isGroup),
      senderName: row.senderName,
      senderRole: row.senderRole || "",
      senderAvatar: row.senderAvatar || "",
      message: row.body || "",
      arrivalMinute: row.arrivalMinute,
      options: (optionsByChannelItem.get(row.id) || []).sort((a, b) => a.level - b.level).map((option) => ({
        id: option.id,
        level: option.level,
        text: option.text,
        score: option.score,
        effects: {
          queue: option.effectQueue,
          conversion: option.effectConversion,
          morale: option.effectMorale,
          revenue_impact: option.effectRevenueImpact,
          delivery_status: option.effectDeliveryStatus,
        },
        competency_scores: rulesByOption.get(`channel_option:${option.id}`) || {},
      })),
      primaryCompetency: row.primaryCompetency,
      imageAssetId: row.imageAssetId,
      imageUrl: image?.publicUrl || null,
      audioAssetId: row.audioAssetId,
      audioUrl: audio?.publicUrl || null,
      timing: timing ? {
        arrivalMinute: timing.arrivalMinute,
        minIntervalSeconds: timing.minIntervalSeconds,
        maxIntervalSeconds: timing.maxIntervalSeconds,
        reminderIntervalSeconds: timing.reminderIntervalSeconds,
      } : null,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  }

  private mapVideoCase(
    row: typeof channelItems.$inferSelect,
    optionsByChannelItem: Map<string, typeof channelOptions.$inferSelect[]>,
    rulesByOption: Map<string, Record<string, number>>,
    assetMap: Map<string, PublicMediaAsset>,
    timingsBySource: Map<string, typeof caseTimings.$inferSelect>,
  ): VideoCase {
    const media = row.imageAssetId ? assetMap.get(row.imageAssetId) || null : null;
    const image = media?.kind === "image" ? media : null;
    const video = media?.kind === "video" ? media : null;
    const audio = row.audioAssetId ? assetMap.get(row.audioAssetId) || null : null;
    const timing = timingsBySource.get(`video:${row.id}`);
    return {
      id: row.id,
      title: row.title,
      sender: row.senderName,
      role: row.senderRole || "",
      senderAvatar: row.senderAvatar || "",
      duration: row.duration || "",
      situation: row.body || "",
      arrivalMinute: row.arrivalMinute,
      options: (optionsByChannelItem.get(row.id) || []).sort((a, b) => a.level - b.level).map((option) => ({
        id: option.id,
        level: option.level,
        text: option.text,
        score: option.score,
        effects: {
          queue: option.effectQueue,
          conversion: option.effectConversion,
          morale: option.effectMorale,
          revenue_impact: option.effectRevenueImpact,
          delivery_status: option.effectDeliveryStatus,
        },
        competency_scores: rulesByOption.get(`channel_option:${option.id}`) || {},
      })),
      primaryCompetency: row.primaryCompetency,
      imageAssetId: image?.id || null,
      imageUrl: image?.publicUrl || null,
      videoAssetId: video?.id || null,
      videoUrl: video?.publicUrl || null,
      audioAssetId: row.audioAssetId,
      audioUrl: audio?.publicUrl || null,
      timing: timing ? {
        arrivalMinute: timing.arrivalMinute,
        minIntervalSeconds: timing.minIntervalSeconds,
        maxIntervalSeconds: timing.maxIntervalSeconds,
        reminderIntervalSeconds: timing.reminderIntervalSeconds,
      } : null,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  }

  private upsertTiming(sourceType: TimingSourceType, sourceId: string, timing?: EditableTiming | null) {
    const normalized = normalizeTiming(sourceType, timing);
    const existing = db.select().from(caseTimings).where(and(eq(caseTimings.sourceType, sourceType), eq(caseTimings.sourceId, sourceId))).get();
    if (existing) {
      db.update(caseTimings).set({
        ...normalized,
        isActive: true,
      }).where(eq(caseTimings.id, existing.id)).run();
      return;
    }

    db.insert(caseTimings).values({
      id: nanoid(),
      sourceType,
      sourceId,
      ...normalized,
      isActive: true,
    }).run();
  }

  private syncImageBinding(sourceType: "main_case" | "email" | "messenger" | "video", sourceId: string, assetId: string | null) {
    db.delete(caseImages).where(and(eq(caseImages.sourceType, sourceType), eq(caseImages.sourceId, sourceId))).run();
    if (!assetId) {
      return;
    }
    db.insert(caseImages).values({
      id: nanoid(),
      sourceType,
      sourceId,
      assetId,
      sortOrder: 0,
      isPrimary: true,
    }).run();
  }

  saveCase(input: EditableSimCase) {
    const caseId = input.id || nanoid();
    db.transaction(() => {
      const existing = db.select().from(simulationCases).where(eq(simulationCases.id, caseId)).get();
      const record = {
        id: caseId,
        title: input.title,
        description: input.description,
        primaryCompetenciesJson: JSON.stringify(input.primaryCompetencies),
        secondaryCompetenciesJson: JSON.stringify(input.secondaryCompetencies),
        zonesAffectedJson: JSON.stringify(input.zones_affected),
        imageAssetId: input.imageAssetId,
        audioAssetId: input.audioAssetId,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        updatedAt: new Date().toISOString(),
      };

      if (existing) {
        db.update(simulationCases).set(record).where(eq(simulationCases.id, caseId)).run();
      } else {
        db.insert(simulationCases).values({
          ...record,
          createdAt: new Date().toISOString(),
        }).run();
      }

      const cycleRows = db.select().from(caseCycles).where(eq(caseCycles.caseId, caseId)).all();
      const cycleIds = cycleRows.map((item) => item.id);
      if (cycleIds.length > 0) {
        const optionRows = db.select().from(caseOptions).where(inArray(caseOptions.cycleId, cycleIds)).all();
        const optionIds = optionRows.map((item) => item.id);
        if (optionIds.length > 0) {
          db.delete(scoringRules).where(and(eq(scoringRules.sourceType, "case_option"), inArray(scoringRules.sourceOptionId, optionIds))).run();
        }
        db.delete(caseOptions).where(inArray(caseOptions.cycleId, cycleIds)).run();
      }

      db.delete(caseSignals).where(eq(caseSignals.caseId, caseId)).run();
      db.delete(caseCycles).where(eq(caseCycles.caseId, caseId)).run();

      db.insert(caseSignals).values({
        id: `${caseId}__trigger`,
        caseId,
        cycleId: null,
        signalRole: "trigger",
        signalType: input.trigger.type,
        source: input.trigger.source,
        text: input.trigger.text,
        content: null,
        sortOrder: 0,
      }).run();

      for (const cycle of input.cycles.sort((a, b) => a.cycle - b.cycle)) {
        const cycleId = cycle.id || `${caseId}__cycle_${cycle.cycle}`;
        db.insert(caseCycles).values({
          id: cycleId,
          caseId,
          cycleNumber: cycle.cycle,
          situation: cycle.situation,
          sortOrder: cycle.cycle,
        }).run();

        db.insert(caseSignals).values({
          id: `${cycleId}__signal`,
          caseId,
          cycleId,
          signalRole: "cycle",
          signalType: cycle.signal.type,
          source: null,
          text: null,
          content: cycle.signal.content,
          sortOrder: cycle.cycle,
        }).run();

        for (const option of cycle.options.sort((a, b) => a.level - b.level)) {
          const optionId = option.id || `${cycleId}__option_${option.level}`;
          db.insert(caseOptions).values({
            id: optionId,
            cycleId,
            level: option.level,
            text: option.text,
            score: option.score,
            effectQueue: option.effects.queue,
            effectConversion: option.effects.conversion,
            effectMorale: option.effects.morale,
            effectRevenueImpact: option.effects.revenue_impact,
            effectDeliveryStatus: option.effects.delivery_status,
            sortOrder: option.level,
          }).run();

          const scoringEntries = Object.entries(option.competency_scores || {});
          if (scoringEntries.length > 0) {
            db.insert(scoringRules).values(scoringEntries.map(([competencyId, score]) => ({
              id: nanoid(),
              sourceType: "case_option",
              sourceOptionId: optionId,
              competencyId,
              score,
            }))).run();
          }
        }
      }

      this.upsertTiming("main_case", caseId, input.timing);
      this.syncImageBinding("main_case", caseId, input.imageAssetId);
    });
    return caseId;
  }

  deleteCase(caseId: string) {
    db.transaction(() => {
      const cycleRows = db.select().from(caseCycles).where(eq(caseCycles.caseId, caseId)).all();
      const cycleIds = cycleRows.map((item) => item.id);
      if (cycleIds.length > 0) {
        const optionRows = db.select().from(caseOptions).where(inArray(caseOptions.cycleId, cycleIds)).all();
        const optionIds = optionRows.map((item) => item.id);
        if (optionIds.length > 0) {
          db.delete(scoringRules).where(and(eq(scoringRules.sourceType, "case_option"), inArray(scoringRules.sourceOptionId, optionIds))).run();
        }
        db.delete(caseOptions).where(inArray(caseOptions.cycleId, cycleIds)).run();
      }
      db.delete(caseSignals).where(eq(caseSignals.caseId, caseId)).run();
      db.delete(caseCycles).where(eq(caseCycles.caseId, caseId)).run();
      db.delete(caseImages).where(and(eq(caseImages.sourceType, "main_case"), eq(caseImages.sourceId, caseId))).run();
      db.delete(caseTimings).where(and(eq(caseTimings.sourceType, "main_case"), eq(caseTimings.sourceId, caseId))).run();
      db.delete(simulationCases).where(eq(simulationCases.id, caseId)).run();
    });
  }

  reorderCases(ids: string[]) {
    db.transaction(() => {
      ids.forEach((id, index) => {
        db.update(simulationCases).set({
          sortOrder: index + 1,
          updatedAt: new Date().toISOString(),
        }).where(eq(simulationCases.id, id)).run();
      });
    });
  }

  saveMessengerChat(chat: ChatInfo) {
    const chatId = chat.id || nanoid();
    const existing = db.select().from(messengerChats).where(eq(messengerChats.id, chatId)).get();
    const record = {
      id: chatId,
      name: chat.name,
      isGroup: chat.isGroup,
      avatar: chat.avatar,
      role: chat.role || null,
      icon: chat.icon || null,
      membersJson: JSON.stringify(chat.members || []),
      sortOrder: chat.sortOrder ?? 0,
      isActive: true,
    };

    if (existing) {
      db.update(messengerChats).set(record).where(eq(messengerChats.id, chatId)).run();
    } else {
      db.insert(messengerChats).values(record).run();
    }

    return chatId;
  }

  deleteMessengerChat(chatId: string) {
    db.delete(messengerChats).where(eq(messengerChats.id, chatId)).run();
  }

  private saveChannelOptions(channelItemId: string, options: Array<EmailCase["options"][number] | MessengerCase["options"][number] | VideoCase["options"][number]>) {
    const existingRows = db.select().from(channelOptions).where(eq(channelOptions.channelItemId, channelItemId)).all();
    const existingIds = existingRows.map((item) => item.id);
    if (existingIds.length > 0) {
      db.delete(scoringRules).where(and(eq(scoringRules.sourceType, "channel_option"), inArray(scoringRules.sourceOptionId, existingIds))).run();
    }
    db.delete(channelOptions).where(eq(channelOptions.channelItemId, channelItemId)).run();

    for (const option of options.sort((a, b) => a.level - b.level)) {
      const optionId = option.id || `${channelItemId}__option_${option.level}`;
      db.insert(channelOptions).values({
        id: optionId,
        channelItemId,
        level: option.level,
        text: option.text,
        score: option.score,
        effectQueue: option.effects.queue,
        effectConversion: option.effects.conversion,
        effectMorale: option.effects.morale,
        effectRevenueImpact: option.effects.revenue_impact,
        effectDeliveryStatus: option.effects.delivery_status,
        sortOrder: option.level,
      }).run();

      const scoringEntries = Object.entries(option.competency_scores || {});
      if (scoringEntries.length > 0) {
        db.insert(scoringRules).values(scoringEntries.map(([competencyId, score]) => ({
          id: nanoid(),
          sourceType: "channel_option",
          sourceOptionId: optionId,
          competencyId,
          score,
        }))).run();
      }
    }
  }

  saveEmailCase(input: EditableEmailCase) {
    const itemId = input.id || nanoid();
    const existing = db.select().from(channelItems).where(eq(channelItems.id, itemId)).get();
    const record = {
      id: itemId,
      channelType: "email",
      chatId: null,
      isGroup: false,
      title: input.subject,
      subject: input.subject,
      senderName: input.from,
      senderRole: null,
      senderAvatar: null,
      department: input.department,
      departmentColor: input.departmentColor,
      preview: input.preview,
      body: input.body,
      duration: null,
      arrivalMinute: input.arrivalMinute,
      primaryCompetency: input.primaryCompetency,
      imageAssetId: input.imageAssetId,
      audioAssetId: input.audioAssetId,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      db.update(channelItems).set(record).where(eq(channelItems.id, itemId)).run();
    } else {
      db.insert(channelItems).values({
        ...record,
        createdAt: new Date().toISOString(),
      }).run();
    }

    this.saveChannelOptions(itemId, input.options);
    this.upsertTiming("email", itemId, input.timing);
    this.syncImageBinding("email", itemId, input.imageAssetId);
    return itemId;
  }

  saveMessengerCase(input: EditableMessengerCase) {
    const itemId = input.id || nanoid();
    const existing = db.select().from(channelItems).where(eq(channelItems.id, itemId)).get();
    const record = {
      id: itemId,
      channelType: "messenger",
      chatId: input.chatId,
      isGroup: input.isGroup,
      title: input.senderName,
      subject: null,
      senderName: input.senderName,
      senderRole: input.senderRole,
      senderAvatar: input.senderAvatar,
      department: null,
      departmentColor: null,
      preview: input.message.slice(0, 120),
      body: input.message,
      duration: null,
      arrivalMinute: input.arrivalMinute,
      primaryCompetency: input.primaryCompetency,
      imageAssetId: input.imageAssetId,
      audioAssetId: input.audioAssetId,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      db.update(channelItems).set(record).where(eq(channelItems.id, itemId)).run();
    } else {
      db.insert(channelItems).values({
        ...record,
        createdAt: new Date().toISOString(),
      }).run();
    }

    this.saveChannelOptions(itemId, input.options);
    this.upsertTiming("messenger", itemId, input.timing);
    this.syncImageBinding("messenger", itemId, input.imageAssetId);
    return itemId;
  }

  saveVideoCase(input: EditableVideoCase) {
    const itemId = input.id || nanoid();
    const existing = db.select().from(channelItems).where(eq(channelItems.id, itemId)).get();
    const videoMediaAssetId = input.videoAssetId || input.imageAssetId || null;
    const record = {
      id: itemId,
      channelType: "video",
      chatId: null,
      isGroup: false,
      title: input.title,
      subject: null,
      senderName: input.sender,
      senderRole: input.role,
      senderAvatar: input.senderAvatar,
      department: null,
      departmentColor: null,
      preview: input.situation.slice(0, 120),
      body: input.situation,
      duration: input.duration,
      arrivalMinute: input.arrivalMinute,
      primaryCompetency: input.primaryCompetency,
      imageAssetId: videoMediaAssetId,
      audioAssetId: input.audioAssetId,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      db.update(channelItems).set(record).where(eq(channelItems.id, itemId)).run();
    } else {
      db.insert(channelItems).values({
        ...record,
        createdAt: new Date().toISOString(),
      }).run();
    }

    this.saveChannelOptions(itemId, input.options);
    this.upsertTiming("video", itemId, input.timing);
    this.syncImageBinding("video", itemId, videoMediaAssetId);
    return itemId;
  }

  deleteChannelItem(itemId: string) {
    const optionRows = db.select().from(channelOptions).where(eq(channelOptions.channelItemId, itemId)).all();
    const optionIds = optionRows.map((item) => item.id);
    if (optionIds.length > 0) {
      db.delete(scoringRules).where(and(eq(scoringRules.sourceType, "channel_option"), inArray(scoringRules.sourceOptionId, optionIds))).run();
    }
    db.delete(channelOptions).where(eq(channelOptions.channelItemId, itemId)).run();
    db.delete(caseImages).where(or(
      and(eq(caseImages.sourceType, "email"), eq(caseImages.sourceId, itemId)),
      and(eq(caseImages.sourceType, "messenger"), eq(caseImages.sourceId, itemId)),
      and(eq(caseImages.sourceType, "video"), eq(caseImages.sourceId, itemId)),
    )).run();
    db.delete(caseTimings).where(or(
      and(eq(caseTimings.sourceType, "email"), eq(caseTimings.sourceId, itemId)),
      and(eq(caseTimings.sourceType, "messenger"), eq(caseTimings.sourceId, itemId)),
      and(eq(caseTimings.sourceType, "video"), eq(caseTimings.sourceId, itemId)),
    )).run();
    db.delete(channelItems).where(eq(channelItems.id, itemId)).run();
  }
}

export const contentStorage = new ContentStorage();
