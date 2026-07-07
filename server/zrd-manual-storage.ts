/**
 * ЗРД — правки инструкции (/zrd/manual): дополнения администратора к секциям.
 * Читают все (публично), пишет только админ. Пустой текст = удаление дополнения.
 */
import { eq } from "drizzle-orm";
import { zrdManualNotes, type ZrdManualNoteRow } from "@shared/schema";
import { db } from "./db";

export class ZrdManualStorage {
  listNotes(): ZrdManualNoteRow[] {
    return db.select().from(zrdManualNotes).all();
  }

  upsertNote(sectionId: string, bodyMd: string, updatedBy: string): ZrdManualNoteRow | null {
    const now = new Date().toISOString();
    const existing = db.select().from(zrdManualNotes).where(eq(zrdManualNotes.sectionId, sectionId)).get();
    if (!bodyMd.trim()) {
      if (existing) db.delete(zrdManualNotes).where(eq(zrdManualNotes.id, existing.id)).run();
      return null;
    }
    if (existing) {
      return db.update(zrdManualNotes)
        .set({ bodyMd, updatedBy, updatedAt: now })
        .where(eq(zrdManualNotes.id, existing.id))
        .returning().get();
    }
    return db.insert(zrdManualNotes)
      .values({ sectionId, bodyMd, updatedBy, updatedAt: now, createdAt: now })
      .returning().get();
  }
}

export const zrdManualStorage = new ZrdManualStorage();
