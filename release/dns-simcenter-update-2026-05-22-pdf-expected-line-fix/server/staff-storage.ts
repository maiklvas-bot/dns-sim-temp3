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

type AuthPayload = Pick<StaffLoginPayload, "username" | "password"> & {
  role?: StaffRole;
};

function shouldSyncStaffFromEnv() {
  const raw = (process.env.SYNC_STAFF_FROM_ENV || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function warnDefaultPasswords() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "ChangeMe123!") {
    console.warn("SECURITY: default admin password is in use. Set ADMIN_PASSWORD in .env.");
  }

  if (!process.env.EVALUATOR_PASSWORD || process.env.EVALUATOR_PASSWORD === "ChangeMe123!") {
    console.warn("SECURITY: default evaluator password is in use. Set EVALUATOR_PASSWORD in .env.");
  }
}

export class StaffStorage {
  async ensureDefaults() {
    warnDefaultPasswords();

    const syncFromEnv = shouldSyncStaffFromEnv();
    const adminPayload = {
      username: process.env.ADMIN_USERNAME || "admin",
      passwordHash: await hashPassword(process.env.ADMIN_PASSWORD || "ChangeMe123!"),
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
      passwordHash: await hashPassword(process.env.EVALUATOR_PASSWORD || "ChangeMe123!"),
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

  listStaff() {
    const adminList = db
      .select({
        id: admins.id,
        username: admins.username,
        displayName: admins.displayName,
        isActive: admins.isActive,
      })
      .from(admins)
      .all();

    const evaluatorList = db
      .select({
        id: evaluatorAccounts.id,
        username: evaluatorAccounts.username,
        displayName: evaluatorAccounts.displayName,
        isActive: evaluatorAccounts.isActive,
      })
      .from(evaluatorAccounts)
      .all();

    return {
      admins: adminList.map((item) => ({ ...item, role: "admin" as const })),
      evaluators: evaluatorList.map((item) => ({ ...item, role: "evaluator" as const })),
    };
  }

  async authenticate(payload: AuthPayload): Promise<StaffPrincipal | null> {
    const username = payload.username?.trim();
    if (!username || !/^[a-zA-Z0-9._-]+$/.test(username)) {
      return null;
    }

    const roles: StaffRole[] = payload.role ? [payload.role] : ["admin", "evaluator"];
    for (const role of roles) {
      const principal = role === "admin"
        ? await this.authenticateAdmin(username, payload.password)
        : await this.authenticateEvaluator(username, payload.password);
      if (principal) {
        return principal;
      }
    }

    return null;
  }

  private async authenticateAdmin(username: string, password: string): Promise<StaffPrincipal | null> {
    const account = db.select().from(admins).where(eq(admins.username, username)).get();
    if (!account || !account.isActive || !(await verifyPassword(password, account.passwordHash))) {
      return null;
    }

    return {
      id: account.id,
      role: "admin",
      username: account.username,
      displayName: account.displayName,
    };
  }

  private async authenticateEvaluator(username: string, password: string): Promise<StaffPrincipal | null> {
    const account = db.select().from(evaluatorAccounts).where(eq(evaluatorAccounts.username, username)).get();
    if (!account || !account.isActive || !(await verifyPassword(password, account.passwordHash))) {
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
