import "../server/load-env";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { simulationSessions, sessionResults, sessionAnswers } from "../shared/schema";

// DRY-RUN: ничего не удаляет. Показывает результаты-кандидаты на удаление по критерию:
//   ответов участника < 10% от числа кейсов сессии  ИЛИ  averageScore = 0 (нулевой результат).

const sessions = db.select().from(simulationSessions).all();
const results = db.select().from(sessionResults).all();
const resultBySession = new Map(results.map((r) => [r.sessionId, r]));

const answerCounts = db
  .select({ sessionId: sessionAnswers.sessionId, n: sql<number>`count(*)` })
  .from(sessionAnswers)
  .groupBy(sessionAnswers.sessionId)
  .all();
const answerCountBySession = new Map(answerCounts.map((a) => [a.sessionId, Number(a.n)]));

const candidates: any[] = [];
for (const s of sessions) {
  let selected: unknown[] = [];
  try { selected = JSON.parse(s.selectedCaseIdsJson || "[]"); } catch { selected = []; }
  const total = Array.isArray(selected) ? selected.length : 0;
  const answers = answerCountBySession.get(s.id) || 0;
  const result = resultBySession.get(s.id);
  const avg = result ? Number(result.averageScore) : 0;
  const ratio = total > 0 ? (answers / total) * 100 : 0;
  const lowProgress = total > 0 && ratio < 10;
  const zeroScore = avg === 0;
  if (lowProgress || zeroScore) {
    candidates.push({
      session: s.id,
      участник: (s.participantName || "").slice(0, 24),
      статус: s.technicalStatus,
      кейсов: total,
      ответов: answers,
      "%": total > 0 ? Math.round(ratio) : "—",
      avg,
      причина: [lowProgress ? "<10%" : "", zeroScore ? "0баллов" : ""].filter(Boolean).join("+"),
      hasResult: result ? "да" : "нет",
    });
  }
}

console.log(`Всего сессий: ${sessions.length} | результатов: ${results.length}`);
console.log(`КАНДИДАТОВ НА УДАЛЕНИЕ: ${candidates.length}`);
console.table(candidates);
console.log("\n(DRY-RUN — ничего не удалено. Для удаления запусти cleanup-results-apply.ts после подтверждения.)");
