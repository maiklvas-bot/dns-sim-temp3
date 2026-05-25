import "./load-env";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import { randomBytes } from "crypto";
import { runMigrations } from "./migrations";
import { sqlite } from "./db";
import { staffStorage } from "./staff-storage";
import { apiRateLimiter } from "./middleware/rate-limiter";
import { csrfProtection } from "./middleware/csrf";

const app = express();
const httpServer = createServer(app);
const MemoryStore = createMemoryStore(session);

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
    console.warn("SESSION_SECRET is shorter than 32 characters; using a generated runtime secret.");
  } else {
    console.warn("SESSION_SECRET is not set; using a generated runtime secret. Sessions will reset on restart.");
  }

  return cryptoRandomSecret();
}

function cryptoRandomSecret(): string {
  return randomBytes(64).toString("hex");
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
      maxAge: 1000 * 60 * 60 * 2,
      sameSite: "strict",
      secure: isHttps,
    },
    name: "dns-simcenter.sid",
    resave: false,
    rolling: true,
    saveUninitialized: false,
    secret: sessionSecret,
    store: new MemoryStore({
      checkPeriod: 1000 * 60 * 60,
    }),
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
