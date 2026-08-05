import "../server/load-env";
import { inArray, sql } from "drizzle-orm";
import { db } from "../server/db";
import { simulationSessions, sessionResults, sessionAnswers } from "../shared/schema";

// УДАЛЕНИЕ (необратимо). Критерий: ответов < 10% от числа кейсов сессии ИЛИ averageScore = 0.
// Удаляется САМА сессия — результат и ответы убираются каскадом (onDelete: cascade).

const sessions = db.select().from(simulationSessions).all();
const results = db.select().from(sessionResults).all();
const resultBySession = new Map(results.map((r) => [r.sessionId, r]));
const answerCounts = db
  .select({ sessionId: sessionAnswers.sessionId, n: sql<number>`count(*)` })
  .from(sessionAnswers)
  .groupBy(sessionAnswers.sessionId)
  .all();
const answerCountBySession = new Map(answerCounts.map((a) => [a.sessionId, Number(a.n)]));

const toDelete: number[] = [];
for (const s of sessions) {
  let selected: unknown[] = [];
  try { selected = JSON.parse(s.selectedCaseIdsJson || "[]"); } catch { selected = []; }
  const total = Array.isArray(selected) ? selected.length : 0;
  const answers = answerCountBySession.get(s.id) || 0;
  const avg = resultBySession.get(s.id) ? Number(resultBySession.get(s.id)!.averageScore) : 0;
  const lowProgress = total > 0 && (answers / total) * 100 < 10;
  if (lowProgress || avg === 0) toDelete.push(s.id);
}

if (toDelete.length === 0) {
  console.log("Нечего удалять.");
  process.exit(0);
}

console.log("Удаляю сессии (каскадом результат+ответы):", toDelete.join(", "));
const res = db.delete(simulationSessions).where(inArray(simulationSessions.id, toDelete)).run();
console.log(`Готово. Удалено сессий: ${res.changes}.`);
