import { eq } from "drizzle-orm";
import { admins, evaluatorAccounts, simulationSettings, type StaffLoginPayload } from "@shared/schema";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./auth";

export type StaffRole = "admin" | "evaluator";

export interface StaffPrincipal {
  id: number;
  role: StaffRole;
  username: string;
  displayName: string;
}

function shouldSyncStaffFromEnv() {
  const raw = (process.env.SYNC_STAFF_FROM_ENV || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export class StaffStorage {
  ensureDefaults() {
    const syncFromEnv = shouldSyncStaffFromEnv();
    const adminPayload = {
      username: process.env.ADMIN_USERNAME || "admin",
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD || "ChangeMe123!"),
      displayName: process.env.ADMIN_DISPLAY_NAME || "Главный администратор",
      isActive: true,
    };
    const adminExists = db.select().from(admins).limit(1).get();
    if (!adminExists) {
      db.insert(admins).values(adminPayload).run();
    } else if (syncFromEnv) {
      db.update(admins).set({
        ...adminPayload,
        updatedAt: new Date().toISOString(),
      }).where(eq(admins.id, adminExists.id)).run();
    }

    const evaluatorPayload = {
      username: process.env.EVALUATOR_USERNAME || "evaluator",
      passwordHash: hashPassword(process.env.EVALUATOR_PASSWORD || "ChangeMe123!"),
      displayName: process.env.EVALUATOR_DISPLAY_NAME || "Оценщик",
      isActive: true,
    };
    const evaluatorExists = db.select().from(evaluatorAccounts).limit(1).get();
    if (!evaluatorExists) {
      db.insert(evaluatorAccounts).values(evaluatorPayload).run();
    } else if (syncFromEnv) {
      db.update(evaluatorAccounts).set({
        ...evaluatorPayload,
        updatedAt: new Date().toISOString(),
      }).where(eq(evaluatorAccounts.id, evaluatorExists.id)).run();
    }

    const settingsExists = db.select().from(simulationSettings).limit(1).get();
    if (!settingsExists) {
      db.insert(simulationSettings).values({}).run();
    }
  }

  authenticate(payload: StaffLoginPayload): StaffPrincipal | null {
    if (payload.role === "admin") {
      const account = db.select().from(admins).where(eq(admins.username, payload.username)).get();
      if (!account || !account.isActive || !verifyPassword(payload.password, account.passwordHash)) {
        return null;
      }
      return {
        id: account.id,
        role: "admin",
        username: account.username,
        displayName: account.displayName,
      };
    }

    const account = db.select().from(evaluatorAccounts).where(eq(evaluatorAccounts.username, payload.username)).get();
    if (!account || !account.isActive || !verifyPassword(payload.password, account.passwordHash)) {
      return null;
    }

    return {
      id: account.id,
      role: "evaluator",
      username: account.username,
      displayName: account.displayName,
    };
  }
}

export const staffStorage = new StaffStorage();
