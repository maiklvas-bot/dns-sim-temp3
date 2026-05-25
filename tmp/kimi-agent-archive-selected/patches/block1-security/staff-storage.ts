/**
 * =============================================================================
 * Staff Storage — управление аккаунтами сотрудников
 * =============================================================================
 * 
 * ИЗМЕНЕНИЯ БЕЗОПАСНОСТИ:
 * — Переход на bcrypt для хеширования паролей
 * — Асинхронная аутентификация (не блокирует event loop)
 * — Валидация username перед запросом в БД
 * — Обработка ошибок аутентификации без утечки информации
 * — Предупреждение при использовании дефолтных паролей
 * 
 * ТРЕБУЕТСЯ УСТАНОВИТЬ:
 *   npm install bcrypt @types/bcrypt
 * =============================================================================
 */

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

/**
 * Проверяет, нужно ли синхронизировать staff из переменных окружения.
 */
function shouldSyncStaffFromEnv() {
  const raw = (process.env.SYNC_STAFF_FROM_ENV || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Проверяет, используются ли дефолтные (небезопасные) пароли.
 * Выводит предупреждение в production.
 */
function checkDefaultPasswords() {
  const isProduction = process.env.NODE_ENV === "production";
  const adminPass = process.env.ADMIN_PASSWORD;
  const evaluatorPass = process.env.EVALUATOR_PASSWORD;
  
  if (isProduction && (!adminPass || adminPass === "ChangeMe123!")) {
    console.warn("\n" + "⚠️  БЕЗОПАСНОСТЬ: Используется дефолтный пароль для admin! Смените ADMIN_PASSWORD в .env!\n");
  }
  if (isProduction && (!evaluatorPass || evaluatorPass === "ChangeMe123!")) {
    console.warn("\n" + "⚠️  БЕЗОПАСНОСТЬ: Используется дефолтный пароль для evaluator! Смените EVALUATOR_PASSWORD в .env!\n");
  }
}

export class StaffStorage {
  /**
   * Создает дефолтные аккаунты при первом запуске.
   * Использует bcrypt для хеширования паролей.
   */
  async ensureDefaults() {
    checkDefaultPasswords();
    
    const syncFromEnv = shouldSyncStaffFromEnv();
    
    // Хешируем пароли через bcrypt (асинхронно)
    const adminPasswordHash = await hashPassword(process.env.ADMIN_PASSWORD || "ChangeMe123!");
    const adminPayload = {
      username: process.env.ADMIN_USERNAME || "admin",
      passwordHash: adminPasswordHash,
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

    // Хешируем пароль evaluator через bcrypt
    const evaluatorPasswordHash = await hashPassword(process.env.EVALUATOR_PASSWORD || "ChangeMe123!");
    const evaluatorPayload = {
      username: process.env.EVALUATOR_USERNAME || "evaluator",
      passwordHash: evaluatorPasswordHash,
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

  /**
   * Возвращает объединённый список администраторов и оценщиков.
   */
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
      admins: adminList.map((a) => ({ ...a, role: "admin" as const })),
      evaluators: evaluatorList.map((e) => ({ ...e, role: "evaluator" as const })),
    };
  }

  /**
   * Аутентификация сотрудника с использованием bcrypt.
   * 
   * БЕЗОПАСНОСТЬ:
   * — Асинхронная проверка (не блокирует event loop)
   * — Валидация username (только разрешенные символы)
   * — Проверка isActive перед верификацией пароля
   * — Timing-safe сравнение (внутри bcrypt.compare)
   * — Не раскрываем какое поле неверное
   * — Поддержка старых scrypt-хешей через обратную совместимость
   * 
   * @param payload — username, password и опциональная role
   * @returns StaffPrincipal при успехе, null при неудаче
   */
  async authenticate(payload: StaffLoginPayload): Promise<StaffPrincipal | null> {
    // Валидация username — только разрешенные символы
    const usernameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!payload.username || !usernameRegex.test(payload.username)) {
      return null;
    }

    // Сначала ищем среди администраторов
    const adminAccount = db
      .select()
      .from(admins)
      .where(eq(admins.username, payload.username))
      .get();

    if (adminAccount && adminAccount.isActive) {
      // Асинхронная проверка пароля через bcrypt
      const isValid = await verifyPassword(payload.password, adminAccount.passwordHash);
      if (isValid) {
        return {
          id: adminAccount.id,
          role: "admin",
          username: adminAccount.username,
          displayName: adminAccount.displayName,
        };
      }
    }

    // Затем ищем среди оценщиков
    const evaluatorAccount = db
      .select()
      .from(evaluatorAccounts)
      .where(eq(evaluatorAccounts.username, payload.username))
      .get();

    if (evaluatorAccount && evaluatorAccount.isActive) {
      // Асинхронная проверка пароля через bcrypt
      const isValid = await verifyPassword(payload.password, evaluatorAccount.passwordHash);
      if (isValid) {
        return {
          id: evaluatorAccount.id,
          role: "evaluator",
          username: evaluatorAccount.username,
          displayName: evaluatorAccount.displayName,
        };
      }
    }

    // Аккаунт не найден или пароль неверный
    // НЕ раскрываем какое поле неверное — защита от user enumeration
    return null;
  }
}

export const staffStorage = new StaffStorage();
