import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { SimulationSession } from "@shared/schema";
import type { SessionStorage } from "./session-storage";

export const SIMULATION_TOKEN_HEADER = "x-simulation-token";

export function createSimulationSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSimulationSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifySimulationSessionToken(
  token: string,
  expectedHash: string | null | undefined,
): boolean {
  if (!token || !expectedHash) {
    return false;
  }

  try {
    const actual = Buffer.from(hashSimulationSessionToken(token), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function toPublicSimulationSession(session: SimulationSession) {
  const { participantTokenHash: _participantTokenHash, ...publicSession } = session;
  return publicSession;
}

export function requireSimulationAccess(sessionStorage: SessionStorage) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const params = req.validatedParams as { id?: string } | undefined;
    const sessionId = Number(params?.id);
    const simulationSession = Number.isSafeInteger(sessionId)
      ? sessionStorage.getSimulationSession(sessionId)
      : null;

    if (!simulationSession) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    req.simulationSession = simulationSession;
    if (req.session.staff) {
      next();
      return;
    }

    const submittedToken = req.get(SIMULATION_TOKEN_HEADER) || "";
    if (!simulationSession.participantTokenHash || !submittedToken) {
      res.status(401).json({
        message: "Simulation token required",
        code: "SIMULATION_TOKEN_REQUIRED",
      });
      return;
    }

    if (!verifySimulationSessionToken(submittedToken, simulationSession.participantTokenHash)) {
      res.status(403).json({
        message: "Invalid simulation token",
        code: "SIMULATION_TOKEN_INVALID",
      });
      return;
    }

    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      simulationSession?: SimulationSession;
    }
  }
}
