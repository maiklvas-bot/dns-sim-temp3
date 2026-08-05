import { desc, eq, sql } from "drizzle-orm";
import {
  zrdSessions,
  zrdTurns,
  zrdResults,
  type InsertZrdSession,
  type InsertZrdTurn,
  type InsertZrdResult,
} from "@shared/schema";
import { db } from "./db";
import { parseJsonObject } from "./data-utils";

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без похожих 0/O/1/I

export function generateZrdAccessCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ACCESS_CODE_ALPHABET[Math.floor(Math.random() * ACCESS_CODE_ALPHABET.length)];
  }
  return out;
}

export class ZrdStorage {
  createSession(input: InsertZrdSession) {
    return db.insert(zrdSessions).values({
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning().get();
  }

  getSession(id: number) {
    return db.select().from(zrdSessions).where(eq(zrdSessions.id, id)).get();
  }

  getSessionByCode(accessCode: string) {
    return db.select().from(zrdSessions).where(eq(zrdSessions.accessCode, accessCode)).get();
  }

  updateSession(id: number, updates: Partial<InsertZrdSession>) {
    return db.update(zrdSessions).set({
      ...updates,
      updatedAt: new Date().toISOString(),
    }).where(eq(zrdSessions.id, id)).returning().get();
  }

  addTurn(input: InsertZrdTurn) {
    return db.insert(zrdTurns).values({
      ...input,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  getTurns(sessionId: number) {
    return db.select().from(zrdTurns).where(eq(zrdTurns.sessionId, sessionId)).orderBy(zrdTurns.seq).all();
  }

  countTurns(sessionId: number): number {
    const row = db.select({ n: sql<number>`count(*)` }).from(zrdTurns).where(eq(zrdTurns.sessionId, sessionId)).get();
    return Number(row?.n ?? 0);
  }

  upsertResult(input: InsertZrdResult) {
    const existing = db.select().from(zrdResults).where(eq(zrdResults.sessionId, input.sessionId)).get();
    if (existing) {
      return db.update(zrdResults).set(input).where(eq(zrdResults.sessionId, input.sessionId)).returning().get();
    }
    return db.insert(zrdResults).values({
      ...input,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  getResult(sessionId: number) {
    return db.select().from(zrdResults).where(eq(zrdResults.sessionId, sessionId)).get();
  }

  listSessions(limit = 100) {
    return db.select().from(zrdSessions).orderBy(desc(zrdSessions.createdAt)).limit(limit).all();
  }

  getSessionDetails(sessionId: number) {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }
    const turns = this.getTurns(sessionId);
    const result = this.getResult(sessionId);
    return {
      session,
      turns,
      result: result
        ? {
            ...result,
            finalMetrics: parseJsonObject(result.finalMetricsJson, {}),
            competencies: parseJsonObject(result.competenciesJson, {}),
            outcome: parseJsonObject(result.outcomeJson, {}),
          }
        : null,
    };
  }
}

export const zrdStorage = new ZrdStorage();
