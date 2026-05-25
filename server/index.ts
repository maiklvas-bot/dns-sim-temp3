import "./load-env";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { runMigrations } from "./migrations";
import { sqlite } from "./db";
import { staffStorage } from "./staff-storage";
import { apiRateLimiter } from "./middleware/rate-limiter";
import { csrfProtection } from "./middleware/csrf";

const app = express();
const httpServer = createServer(app);
const STAFF_SESSION_MAX_AGE_MS = 1000 * 60 * 60;

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

  get(sid: string, callback: (err: any, session?: session.SessionData | null) => void) {
    try {
      const row = sqlite
        .prepare("SELECT sess, expires FROM app_staff_sessions WHERE sid = ?")
        .get(sid) as { sess: string; expires: number } | undefined;

      if (!row) {
        return callback(null, null);
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

  set(sid: string, sess: session.SessionData, callback?: (err?: any) => void) {
    try {
      const expires = this.getExpiresAt(sess);
      sqlite
        .prepare(`
          INSERT INTO app_staff_sessions (sid, sess, expires)
          VALUES (?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires
        `)
        .run(sid, JSON.stringify(sess), expires);
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

  touch(sid: string, sess: session.SessionData, callback?: (err?: any) => void) {
    this.set(sid, sess, callback);
  }

  private getExpiresAt(sess: session.SessionData) {
    const cookieMaxAge = typeof sess.cookie?.maxAge === "number" ? sess.cookie.maxAge : this.ttlMs;
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
const sessionSecret = getSessionSecret();

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: isHttps,
  }),
);
app.use((_req, res, next) => {
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(
  session({
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
    secret: sessionSecret,
    store: new SqliteSessionStore(STAFF_SESSION_MAX_AGE_MS),
  }),
);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "dns-simcenter",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || "development",
  });
});

app.use("/api", apiRateLimiter);
app.use(csrfProtection);
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

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  runMigrations(sqlite);
  await staffStorage.ensureDefaults();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
