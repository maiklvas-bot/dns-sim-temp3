import type { NextFunction, Request, Response } from "express";
import type { SessionStorage } from "./session-storage";
import { hasSimulationSessionAccess } from "./simulation-session-access";

export function requireExportAccess(sessionStorage: SessionStorage) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.session.staff) {
      next();
      return;
    }

    const sessionId = Number((req.validatedBody as { sessionId?: number } | undefined)?.sessionId);
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
      res.status(401).json({
        message: "Simulation token required",
        code: "SIMULATION_TOKEN_REQUIRED",
      });
      return;
    }

    const simulationSession = sessionStorage.getSimulationSession(sessionId);
    if (!simulationSession) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    req.simulationSession = simulationSession;
    if (hasSimulationSessionAccess(req, res, simulationSession)) {
      next();
    }
  };
}
