import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { type IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Request, RequestHandler, Response } from "express";
import session from "express-session";
import { sqlite } from "./db";
import type { StaffPrincipal } from "./staff-storage";

const STAFF_SESSION_MAX_AGE_MS = 1000 * 60 * 60;

declare module "express-session" {
  interface SessionData {
    staff?: StaffPrincipal;
  }
}

function cryptoRandomSecret(): string {
  return randomBytes(64).toString("hex");
}

function getPersistedSessionSecret(): string {
  const sqlitePath = path.resolve(process.env.SQLITE_PATH || "data.db");
  const secretPath = process.env.SESSION_SECRET_FILE || path.join(path.dirname(sqlitePath), "session-secret");

  try {
    const existing = fs.existsSync(secretPath) ? fs.readFileSync(secretPath, "utf8").trim() : "";
    if (existing.length >= 32) {
      return existing;
    }

    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    const nextSecret = cryptoRandomSecret();
    fs.writeFileSync(secretPath, nextSecret, { mode: 0o600 });
    return nextSecret;
  } catch (error) {
    console.warn("Could not persist SESSION_SECRET; using a generated runtime secret.", error);
    return cryptoRandomSecret();
  }
}

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }

  if (envSecret) {
    console.warn("SESSION_SECRET is shorter than 32 characters; using a persisted local session secret.");
  }

  return getPersistedSessionSecret();
}

class SqliteSessionStore extends session.Store {
  private cleanupTimer: NodeJS.Timeout;

  constructor(private readonly ttlMs: number) {
    super();
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS app_staff_sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_app_staff_sessions_expires ON app_staff_sessions(expires);
    `);
    this.cleanupTimer = setInterval(() => this.cleanup(), Math.max(1000 * 60 * 5, ttlMs));
    this.cleanupTimer.unref?.();
    this.cleanup();
  }

  get(sid: string, callback: (err: any, value?: session.SessionData | null) => void) {
    try {
      const row = sqlite
        .prepare("SELECT sess, expires FROM app_staff_sessions WHERE sid = ?")
        .get(sid) as { sess: string; expires: number } | undefined;

      if (!row) {
        callback(null, null);
        return;
      }

      if (row.expires <= Date.now()) {
        this.destroy(sid, () => callback(null, null));
        return;
      }

      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid: string, value: session.SessionData, callback?: (err?: any) => void) {
    try {
      sqlite
        .prepare(`
          INSERT INTO app_staff_sessions (sid, sess, expires)
          VALUES (?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires
        `)
        .run(sid, JSON.stringify(value), this.getExpiresAt(value));
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void) {
    try {
      sqlite.prepare("DELETE FROM app_staff_sessions WHERE sid = ?").run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid: string, value: session.SessionData, callback?: (err?: any) => void) {
    this.set(sid, value, callback);
  }

  private getExpiresAt(value: session.SessionData) {
    const cookieMaxAge = typeof value.cookie?.maxAge === "number" ? value.cookie.maxAge : this.ttlMs;
    return Date.now() + Math.max(1000 * 60, cookieMaxAge || this.ttlMs);
  }

  private cleanup() {
    try {
      sqlite.prepare("DELETE FROM app_staff_sessions WHERE expires <= ?").run(Date.now());
    } catch (error) {
      console.warn("Failed to cleanup expired staff sessions", error);
    }
  }
}

const isHttps = process.env.HTTPS === "true";

export const staffSessionMiddleware: RequestHandler = session({
  cookie: {
    httpOnly: true,
    maxAge: STAFF_SESSION_MAX_AGE_MS,
    sameSite: "strict",
    secure: isHttps,
  },
  name: "dns-simcenter.sid",
  resave: false,
  rolling: true,
  saveUninitialized: false,
  secret: getSessionSecret(),
  store: new SqliteSessionStore(STAFF_SESSION_MAX_AGE_MS),
});

export function parseStaffUpgradeSession(request: IncomingMessage): Promise<StaffPrincipal | null> {
  return new Promise((resolve, reject) => {
    const response = new ServerResponse(request);
    staffSessionMiddleware(
      request as Request,
      response as unknown as Response,
      (error?: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        resolve((request as Request).session?.staff || null);
      },
    );
  });
}
