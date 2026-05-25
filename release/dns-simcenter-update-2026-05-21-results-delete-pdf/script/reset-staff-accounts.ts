import "../server/load-env";
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { hashPassword } from "../server/auth";
import { admins, evaluatorAccounts } from "../shared/schema";

function resetAdminAccount() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "Главный администратор";
  const existing = db.select().from(admins).orderBy(admins.id).limit(1).get();

  if (existing) {
    db.update(admins).set({
      username,
      passwordHash: hashPassword(password),
      displayName,
      isActive: true,
      updatedAt: new Date().toISOString(),
    }).where(eq(admins.id, existing.id)).run();
    return "updated";
  }

  db.insert(admins).values({
    username,
    passwordHash: hashPassword(password),
    displayName,
    isActive: true,
  }).run();
  return "created";
}

function resetEvaluatorAccount() {
  const username = process.env.EVALUATOR_USERNAME || "evaluator";
  const password = process.env.EVALUATOR_PASSWORD || "ChangeMe123!";
  const displayName = process.env.EVALUATOR_DISPLAY_NAME || "Оценщик";
  const existing = db.select().from(evaluatorAccounts).orderBy(evaluatorAccounts.id).limit(1).get();

  if (existing) {
    db.update(evaluatorAccounts).set({
      username,
      passwordHash: hashPassword(password),
      displayName,
      isActive: true,
      updatedAt: new Date().toISOString(),
    }).where(eq(evaluatorAccounts.id, existing.id)).run();
    return "updated";
  }

  db.insert(evaluatorAccounts).values({
    username,
    passwordHash: hashPassword(password),
    displayName,
    isActive: true,
  }).run();
  return "created";
}

const adminResult = resetAdminAccount();
const evaluatorResult = resetEvaluatorAccount();

console.log(`Admin account ${adminResult}.`);
console.log(`Evaluator account ${evaluatorResult}.`);
