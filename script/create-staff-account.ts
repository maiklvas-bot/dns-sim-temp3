import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { admins, evaluatorAccounts } from "@shared/schema";
import { db } from "../server/db";
import { hashPassword } from "../server/auth";

/**
 * Заводит служебную учётку (администратор или оценщик).
 *
 * Пароль в консоль не печатается: он попадает в `storage/staff-credentials.txt`,
 * который лежит под gitignore. Иначе пароль осел бы в истории терминала и в логах CI.
 *
 * Запуск:
 *   npx tsx script/create-staff-account.ts --username tester --name "Тестировщик" --role admin
 *   npx tsx script/create-staff-account.ts --username tester --password "..." (свой пароль)
 *
 * Повторный запуск с тем же логином меняет пароль, а не плодит дубль.
 */

const CREDENTIALS_FILE = path.resolve("storage", "staff-credentials.txt");

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Пароль без похожих друг на друга символов: его придётся диктовать вслух. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function appendCredentials(role: string, username: string, displayName: string, password: string) {
  fs.mkdirSync(path.dirname(CREDENTIALS_FILE), { recursive: true });
  const stamp = new Date().toISOString();
  const record = `[${stamp}] ${displayName} — роль ${role}\n  логин:  ${username}\n  пароль: ${password}\n\n`;
  fs.appendFileSync(CREDENTIALS_FILE, record, { mode: 0o600 });
}

async function main() {
  const username = (readArg("username") || "").trim();
  const displayName = (readArg("name") || "").trim();
  const role = (readArg("role") || "admin").trim();

  if (!username || !displayName) {
    console.error("Нужны --username и --name. Пример: --username tester --name \"Тестировщик\"");
    process.exit(1);
  }

  // Логин проверяется тем же выражением, что и во время входа (staff-storage.ts).
  // Кириллический логин завёлся бы в базу, но войти по нему было бы нельзя.
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    console.error(`Логин «${username}» не пройдёт проверку при входе: разрешены латиница, цифры, точка, дефис, подчёркивание.`);
    process.exit(1);
  }

  if (role !== "admin" && role !== "evaluator") {
    console.error(`Неизвестная роль «${role}». Допустимо: admin, evaluator.`);
    process.exit(1);
  }

  const password = readArg("password") || generatePassword();
  const passwordHash = await hashPassword(password);
  const table = role === "admin" ? admins : evaluatorAccounts;
  const existing = db.select().from(table).where(eq(table.username, username)).get();

  if (existing) {
    db.update(table)
      .set({ passwordHash, displayName, isActive: true, updatedAt: new Date().toISOString() })
      .where(eq(table.id, existing.id))
      .run();
    console.log(`Учётка «${displayName}» (${username}) уже была — обновлены пароль и имя.`);
  } else {
    db.insert(table).values({ username, passwordHash, displayName, isActive: true }).run();
    console.log(`Заведена учётка «${displayName}» (${username}), роль: ${role}.`);
  }

  appendCredentials(role, username, displayName, password);
  console.log(`Логин и пароль записаны в ${CREDENTIALS_FILE} (файл под gitignore).`);
}

main().catch((error) => {
  console.error("Не удалось завести учётку:", error);
  process.exit(1);
});
