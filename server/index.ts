import "./load-env";
import { randomUUID } from "node:crypto";
import express from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from "./migrations";
import { sqlite } from "./db";
import { staffStorage } from "./staff-storage";
import { apiRateLimiter } from "./middleware/rate-limiter";
import { csrfProtection } from "./middleware/csrf";
import { apiErrorHandler } from "./middleware/error-handler";
import { serveMediaStatic } from "./media-static";
import { staffSessionMiddleware } from "./staff-session";
import { buildContentSecurityPolicyDirectives } from "./security-headers";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const isHttps = process.env.HTTPS === "true";

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: buildContentSecurityPolicyDirectives(),
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
app.use(staffSessionMiddleware);
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

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
serveMediaStatic(app);

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

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms requestId=${req.requestId}`);
    }
  });

  next();
});

(async () => {
  runMigrations(sqlite);
  await staffStorage.ensureDefaults();
  await registerRoutes(httpServer, app);

  app.use(apiErrorHandler);

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
  const host = process.env.HOST || "0.0.0.0";
  const listenOptions = {
    port,
    host,
    ...(process.platform === "win32" ? {} : { reusePort: true }),
  };

  httpServer.listen(
    listenOptions,
    () => {
      log(`serving on ${host}:${port}`);
    },
  );
})();
