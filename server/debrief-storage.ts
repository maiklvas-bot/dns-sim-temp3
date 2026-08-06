import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { debriefMessages, debriefReviews, debriefs } from "@shared/schema";
import type { Debrief, DebriefMessage, DebriefMode, DebriefReview, DebriefStatus } from "@shared/debrief";
import { averageCompetencyLevel, buildDebriefQuestion } from "@shared/debrief";
import { db } from "./db";
import { sessionStorage } from "./session-storage";

/**
 * Хранилище разбора прохождения.
 *
 * Вопросы к решениям не хранятся заранее: они выводятся из самих решений
 * участника при создании разбора. Иначе список вопросов пришлось бы держать
 * в синхроне с кейсами, а разбор — это всегда разговор о конкретном ходе,
 * а не о кейсе вообще.
 */
export class DebriefStorage {
  /**
   * Разбор для прохождения. Создаётся один раз: повторный вызов возвращает
   * существующий, чтобы участник не терял уже написанные объяснения.
   */
  ensureForSession(input: {
    sessionId: number;
    liveSessionId?: string | null;
    mode: DebriefMode;
  }): Debrief {
    const result = sessionStorage.getSessionResult(input.sessionId);
    if (!result) {
      throw new Error(`Прохождение ${input.sessionId} не найдено — разбирать нечего.`);
    }

    const existing = db.select().from(debriefs).where(eq(debriefs.sessionResultId, result.id)).get();
    if (existing) {
      return this.mapDebrief(existing);
    }

    const id = nanoid();
    db.insert(debriefs).values({
      id,
      sessionResultId: result.id,
      liveSessionId: input.liveSessionId || null,
      mode: input.mode,
      status: "pending",
    }).run();

    this.seedReviews(id, input.sessionId);
    return this.mapDebrief(db.select().from(debriefs).where(eq(debriefs.id, id)).get()!);
  }

  /**
   * Вопрос на каждое решение участника: разбираем ход, а не кейс целиком.
   * Формулировка зависит от того, насколько сильным был выбор.
   */
  private seedReviews(debriefId: string, sessionId: number) {
    const answers = sessionStorage.getSessionAnswers(sessionId);
    for (const answer of answers) {
      let competencyScores: Record<string, number> = {};
      try {
        competencyScores = JSON.parse(answer.competencyScoresJson || "{}");
      } catch {
        competencyScores = {};
      }
      db.insert(debriefReviews).values({
        id: nanoid(),
        debriefId,
        answerId: answer.id,
        question: buildDebriefQuestion({
          caseTitle: answer.caseTitle,
          optionText: answer.optionText,
          competencyLevel: averageCompetencyLevel(competencyScores),
        }),
        explanation: "",
      }).run();
    }
  }

  getById(debriefId: string): Debrief | null {
    const row = db.select().from(debriefs).where(eq(debriefs.id, debriefId)).get();
    return row ? this.mapDebrief(row) : null;
  }

  getBySessionResult(sessionResultId: number): Debrief | null {
    const row = db.select().from(debriefs).where(eq(debriefs.sessionResultId, sessionResultId)).get();
    return row ? this.mapDebrief(row) : null;
  }

  listReviews(debriefId: string): DebriefReview[] {
    return db
      .select()
      .from(debriefReviews)
      .where(eq(debriefReviews.debriefId, debriefId))
      .orderBy(asc(debriefReviews.createdAt))
      .all()
      .map((row) => ({
        id: row.id,
        debriefId: row.debriefId,
        answerId: row.answerId,
        question: row.question,
        explanation: row.explanation,
        assessorNote: row.assessorNote,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  }

  /** Объяснение участника. Разбор при первом ответе переходит в работу. */
  saveExplanation(debriefId: string, reviewId: string, explanation: string) {
    db.update(debriefReviews)
      .set({ explanation, updatedAt: new Date().toISOString() })
      .where(eq(debriefReviews.id, reviewId))
      .run();
    this.touchStatus(debriefId, "in_progress");
  }

  /** Пометка оценщика к конкретному решению — только в совместном разборе. */
  saveAssessorNote(reviewId: string, note: string) {
    db.update(debriefReviews)
      .set({ assessorNote: note, updatedAt: new Date().toISOString() })
      .where(eq(debriefReviews.id, reviewId))
      .run();
  }

  listMessages(debriefId: string): DebriefMessage[] {
    return db
      .select()
      .from(debriefMessages)
      .where(eq(debriefMessages.debriefId, debriefId))
      .orderBy(asc(debriefMessages.createdAt))
      .all()
      .map((row) => ({
        id: row.id,
        debriefId: row.debriefId,
        author: row.author as DebriefMessage["author"],
        authorName: row.authorName,
        text: row.text,
        createdAt: row.createdAt,
      }));
  }

  addMessage(input: { debriefId: string; author: "student" | "assessor"; authorName: string; text: string }) {
    const id = nanoid();
    db.insert(debriefMessages).values({
      id,
      debriefId: input.debriefId,
      author: input.author,
      authorName: input.authorName,
      text: input.text,
    }).run();
    return id;
  }

  /** Итог разбора: что участник понял и что сделает на неделе. */
  complete(debriefId: string, input: { conclusion: string; actionPlan: string }) {
    db.update(debriefs)
      .set({
        conclusion: input.conclusion,
        actionPlan: input.actionPlan,
        status: "completed",
        completedAt: new Date().toISOString(),
      })
      .where(eq(debriefs.id, debriefId))
      .run();
  }

  private touchStatus(debriefId: string, status: DebriefStatus) {
    const current = db.select().from(debriefs).where(eq(debriefs.id, debriefId)).get();
    // Завершённый разбор не откатываем обратно в работу.
    if (!current || current.status === "completed") return;
    db.update(debriefs).set({ status }).where(eq(debriefs.id, debriefId)).run();
  }

  private mapDebrief(row: typeof debriefs.$inferSelect): Debrief {
    return {
      id: row.id,
      sessionResultId: row.sessionResultId,
      liveSessionId: row.liveSessionId,
      mode: row.mode as DebriefMode,
      status: row.status as DebriefStatus,
      conclusion: row.conclusion,
      actionPlan: row.actionPlan,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  }
}

export const debriefStorage = new DebriefStorage();
