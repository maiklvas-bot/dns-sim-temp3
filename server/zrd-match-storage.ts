/**
 * ЗРД v2 — persistence матчей (по образцу zrd-storage.ts).
 * Матч: состояние в state_json, версия state_version растёт при каждом изменении
 * (лёгкий поллинг клиентов). Места: коды входа и токены на human-места.
 */
import { desc, eq, sql } from "drizzle-orm";
import {
  zrdMatches,
  zrdMatchSeats,
  zrdMatchTurns,
  zrdMatchResults,
  type InsertZrdMatch,
  type InsertZrdMatchSeat,
  type InsertZrdMatchTurn,
  type InsertZrdMatchResult,
} from "@shared/schema";
import { db } from "./db";

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без похожих 0/O/1/I

export function generateZrdMatchAccessCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ACCESS_CODE_ALPHABET[Math.floor(Math.random() * ACCESS_CODE_ALPHABET.length)];
  }
  return out;
}

export class ZrdMatchStorage {
  createMatch(input: InsertZrdMatch) {
    const now = new Date().toISOString();
    return db.insert(zrdMatches).values({ ...input, createdAt: now, updatedAt: now }).returning().get();
  }

  getMatch(id: number) {
    return db.select().from(zrdMatches).where(eq(zrdMatches.id, id)).get();
  }

  updateMatch(id: number, updates: Partial<InsertZrdMatch> & { stateVersion?: number }) {
    return db.update(zrdMatches).set({
      ...updates,
      updatedAt: new Date().toISOString(),
    }).where(eq(zrdMatches.id, id)).returning().get();
  }

  /** атомарный инкремент версии состояния (сигнал поллинга) */
  bumpVersion(id: number) {
    return db.update(zrdMatches).set({
      stateVersion: sql`${zrdMatches.stateVersion} + 1`,
      updatedAt: new Date().toISOString(),
    }).where(eq(zrdMatches.id, id)).returning().get();
  }

  createSeat(input: InsertZrdMatchSeat) {
    return db.insert(zrdMatchSeats).values(input).returning().get();
  }

  getSeats(matchId: number) {
    return db.select().from(zrdMatchSeats).where(eq(zrdMatchSeats.matchId, matchId)).orderBy(zrdMatchSeats.seatIdx).all();
  }

  getSeatByCode(accessCode: string) {
    return db.select().from(zrdMatchSeats).where(eq(zrdMatchSeats.accessCode, accessCode)).get();
  }

  updateSeatTokenHash(seatId: number, tokenHash: string) {
    return db.update(zrdMatchSeats).set({ tokenHash }).where(eq(zrdMatchSeats.id, seatId)).returning().get();
  }

  /** конверсия места (подключение игрока к запущенному матчу): контроллер + имя + код входа */
  updateSeatController(seatId: number, patch: { controllerKind: string; participantName: string | null; aiLevel: number | null; accessCode: string | null }) {
    return db.update(zrdMatchSeats).set(patch).where(eq(zrdMatchSeats.id, seatId)).returning().get();
  }

  addTurn(input: InsertZrdMatchTurn) {
    return db.insert(zrdMatchTurns).values({ ...input, createdAt: new Date().toISOString() }).returning().get();
  }

  countTurns(matchId: number): number {
    const row = db.select({ n: sql<number>`count(*)` }).from(zrdMatchTurns).where(eq(zrdMatchTurns.matchId, matchId)).get();
    return Number(row?.n ?? 0);
  }

  upsertSeatResult(input: InsertZrdMatchResult) {
    const existing = db.select().from(zrdMatchResults)
      .where(sql`${zrdMatchResults.matchId} = ${input.matchId} AND ${zrdMatchResults.seatIdx} = ${input.seatIdx}`)
      .get();
    if (existing) {
      return db.update(zrdMatchResults).set(input).where(eq(zrdMatchResults.id, existing.id)).returning().get();
    }
    return db.insert(zrdMatchResults).values({ ...input, createdAt: new Date().toISOString() }).returning().get();
  }

  getResults(matchId: number) {
    return db.select().from(zrdMatchResults).where(eq(zrdMatchResults.matchId, matchId)).orderBy(zrdMatchResults.seatIdx).all();
  }

  listMatches(limit = 100) {
    return db.select().from(zrdMatches).orderBy(desc(zrdMatches.createdAt)).limit(limit).all();
  }
}

export const zrdMatchStorage = new ZrdMatchStorage();
