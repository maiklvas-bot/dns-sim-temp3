import type { Request } from "express";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { auditLogs } from "@shared/schema";
import { db } from "./db";
import { sanitizeSensitiveData } from "./sensitive-data";

export type AuditArea = "security" | "admin" | "evaluator" | "simulation" | "system";
export type AuditOutcome = "success" | "failure";

export interface AuditActor {
  id?: number | null;
  username?: string | null;
  displayName?: string | null;
  role?: "admin" | "evaluator" | "participant" | "system" | null;
}

export interface AuditRecordInput {
  area: AuditArea;
  action: string;
  summary: string;
  outcome?: AuditOutcome;
  entityType?: string | null;
  entityId?: string | number | null;
  actor?: AuditActor | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

export interface AuditListFilters {
  area?: AuditArea;
  actor?: string;
  action?: string;
  outcome?: AuditOutcome;
  search?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

const VOLATILE_KEYS = new Set(["updatedAt", "createdAt", "publicUrl", "imageUrl", "audioUrl", "videoUrl"]);

function stripVolatile(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripVolatile);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !VOLATILE_KEYS.has(key))
      .map(([key, entryValue]) => [key, stripVolatile(entryValue)]),
  );
}

function collectChangedFields(before: unknown, after: unknown, prefix = ""): string[] {
  if (Object.is(before, after)) {
    return [];
  }
  if (
    before == null ||
    after == null ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    return prefix ? [prefix] : ["record"];
  }

  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  const changed: string[] = [];
  for (const key of Array.from(keys)) {
    const path = prefix ? `${prefix}.${key}` : key;
    changed.push(...collectChangedFields(beforeRecord[key], afterRecord[key], path));
    if (changed.length >= 250) {
      return changed.slice(0, 250);
    }
  }
  return changed;
}

function getRequestIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
  const realIp = req.headers["x-real-ip"];
  return forwardedIp || (Array.isArray(realIp) ? realIp[0] : realIp) || req.ip || req.socket.remoteAddress || "unknown";
}

function serialize(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export class AuditStorage {
  record(req: Request, input: AuditRecordInput) {
    const sessionActor = req.session?.staff;
    const actor = input.actor || sessionActor || null;
    const before = stripVolatile(sanitizeSensitiveData(input.before));
    const after = stripVolatile(sanitizeSensitiveData(input.after));
    const metadata = sanitizeSensitiveData(input.metadata ?? {});
    const changedFields = collectChangedFields(before, after);

    return db.insert(auditLogs).values({
      createdAt: new Date().toISOString(),
      area: input.area,
      action: input.action,
      outcome: input.outcome || "success",
      actorId: actor?.id ?? null,
      actorUsername: actor?.username ?? null,
      actorDisplayName: actor?.displayName ?? null,
      actorRole: actor?.role ?? null,
      ipAddress: getRequestIp(req),
      userAgent: req.get("user-agent") || null,
      entityType: input.entityType || null,
      entityId: input.entityId == null ? null : String(input.entityId),
      summary: input.summary,
      changedFieldsJson: JSON.stringify(changedFields),
      beforeJson: serialize(before),
      afterJson: serialize(after),
      metadataJson: JSON.stringify(metadata),
    }).returning().get();
  }

  list(filters: AuditListFilters) {
    const clauses = [];
    if (filters.area) clauses.push(eq(auditLogs.area, filters.area));
    if (filters.actor) clauses.push(eq(auditLogs.actorUsername, filters.actor));
    if (filters.action) clauses.push(eq(auditLogs.action, filters.action));
    if (filters.outcome) clauses.push(eq(auditLogs.outcome, filters.outcome));
    if (filters.from) clauses.push(sql`${auditLogs.createdAt} >= ${filters.from}`);
    if (filters.to) clauses.push(sql`${auditLogs.createdAt} <= ${filters.to}`);
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      clauses.push(or(
        like(auditLogs.summary, pattern),
        like(auditLogs.entityType, pattern),
        like(auditLogs.entityId, pattern),
        like(auditLogs.actorDisplayName, pattern),
        like(auditLogs.actorUsername, pattern),
        like(auditLogs.ipAddress, pattern),
      )!);
    }

    const where = clauses.length > 0 ? and(...clauses) : undefined;
    const items = db.select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.id))
      .limit(filters.limit)
      .offset(filters.offset)
      .all()
      .map((row) => ({
        ...row,
        changedFields: parseJson<string[]>(row.changedFieldsJson, []),
        before: parseJson<unknown>(row.beforeJson, null),
        after: parseJson<unknown>(row.afterJson, null),
        metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
      }));

    const total = db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(where)
      .get()?.count ?? 0;

    const actors = db.selectDistinct({
      username: auditLogs.actorUsername,
      displayName: auditLogs.actorDisplayName,
      role: auditLogs.actorRole,
    }).from(auditLogs).where(sql`${auditLogs.actorUsername} is not null`).orderBy(auditLogs.actorUsername).all();
    const actions = db.selectDistinct({ value: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action).all();
    const areas = db.selectDistinct({ value: auditLogs.area }).from(auditLogs).orderBy(auditLogs.area).all();

    return {
      items,
      total: Number(total),
      limit: filters.limit,
      offset: filters.offset,
      facets: {
        actors,
        actions: actions.map((item) => item.value),
        areas: areas.map((item) => item.value),
      },
    };
  }
}

export const auditStorage = new AuditStorage();
