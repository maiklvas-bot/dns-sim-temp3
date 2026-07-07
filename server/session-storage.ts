import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  participants,
  sessionAnswers,
  sessionMetrics,
  sessionResults,
  simulationSessions,
  type InsertSessionAnswer,
  type InsertSessionMetrics,
  type InsertSessionResult,
  type InsertSimulationSession,
} from "@shared/schema";
import { db } from "./db";
import { parseJsonArray, parseJsonObject } from "./data-utils";

export interface SessionListFilters {
  status?: string;
  participantName?: string;
}

function escapeLikePattern(value: string): string {
  return value.trim().replace(/[\\%_]/g, (match) => `\\${match}`);
}

export class SessionStorage {
  createOrFindParticipant(fullName: string, externalId?: string | null) {
    const normalized = fullName.trim();
    if (!normalized) {
      return null;
    }

    if (externalId) {
      const byExternal = db.select().from(participants).where(eq(participants.externalId, externalId)).get();
      if (byExternal) {
        return byExternal;
      }
    }

    const byName = db.select().from(participants).where(eq(participants.fullName, normalized)).get();
    if (byName) {
      return byName;
    }

    return db.insert(participants).values({
      fullName: normalized,
      externalId: externalId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning().get();
  }

  createSimulationSession(input: InsertSimulationSession) {
    return db.insert(simulationSessions).values({
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning().get();
  }

  getSimulationSession(id: number) {
    return db.select().from(simulationSessions).where(eq(simulationSessions.id, id)).get();
  }

  updateSimulationSession(id: number, updates: Partial<InsertSimulationSession>) {
    return db.update(simulationSessions).set({
      ...updates,
      updatedAt: new Date().toISOString(),
    }).where(eq(simulationSessions.id, id)).returning().get();
  }

  addSessionAnswer(input: InsertSessionAnswer) {
    return db.insert(sessionAnswers).values(input).returning().get();
  }

  addSessionMetrics(input: InsertSessionMetrics) {
    return db.insert(sessionMetrics).values(input).returning().get();
  }

  upsertSessionResult(input: InsertSessionResult) {
    const existing = db.select().from(sessionResults).where(eq(sessionResults.sessionId, input.sessionId)).get();
    if (existing) {
      return db.update(sessionResults).set(input).where(eq(sessionResults.sessionId, input.sessionId)).returning().get();
    }
    return db.insert(sessionResults).values({
      ...input,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  getSessionAnswers(sessionId: number) {
    return db.select().from(sessionAnswers).where(eq(sessionAnswers.sessionId, sessionId)).all();
  }

  getSessionMetrics(sessionId: number) {
    return db.select().from(sessionMetrics).where(eq(sessionMetrics.sessionId, sessionId)).all();
  }

  getSessionResult(sessionId: number) {
    return db.select().from(sessionResults).where(eq(sessionResults.sessionId, sessionId)).get();
  }

  deleteSessionResult(sessionId: number): void {
    db.delete(simulationSessions).where(eq(simulationSessions.id, sessionId)).run();
  }

  listSessionResults(filters: SessionListFilters = {}) {
    const conditions: SQL[] = [];
    if (filters.status) {
      conditions.push(eq(simulationSessions.technicalStatus, filters.status));
    }
    if (filters.participantName) {
      const participantName = escapeLikePattern(filters.participantName);
      if (participantName) {
        conditions.push(sql`${simulationSessions.participantName} LIKE ${`%${participantName}%`} ESCAPE '\\'`);
      }
    }

    const baseQuery = db
      .select({
        session: simulationSessions,
        result: sessionResults,
      })
      .from(simulationSessions)
      .leftJoin(sessionResults, eq(sessionResults.sessionId, simulationSessions.id))
      .orderBy(desc(simulationSessions.startedAt));

    const rows = conditions.length > 0 ? baseQuery.where(and(...conditions)).all() : baseQuery.all();

    return rows.map(({ session, result }) => ({
      id: session.id,
      participantName: session.participantName,
      participantEmail: session.participantEmail,
      evaluatorName: session.evaluatorName,
      difficulty: session.difficulty,
      technicalStatus: session.technicalStatus,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      totalScore: result?.totalScore || 0,
      averageScore: result?.averageScore || 0,
    }));
  }

  getSessionDetails(sessionId: number) {
    const session = this.getSimulationSession(sessionId);
    if (!session) {
      return null;
    }

    const answers = this.getSessionAnswers(sessionId).map((item) => ({
      ...item,
      rawEffects: parseJsonObject(item.rawEffectsJson, {}),
      competencyScores: parseJsonObject(item.competencyScoresJson, {}),
      details: parseJsonObject(item.detailsJson, {}),
    }));
    const metrics = this.getSessionMetrics(sessionId);
    const result = this.getSessionResult(sessionId);

    return {
      session,
      answers,
      metrics,
      result: result
        ? {
            ...result,
            competencyAverages: parseJsonObject(result.competencyAveragesJson, {}),
            finalMetrics: parseJsonObject(result.finalMetricsJson, {}),
            timers: parseJsonArray(result.timersJson, []),
            pauses: parseJsonArray(result.pausesJson, []),
          }
        : null,
    };
  }
}

export const sessionStorage = new SessionStorage();
