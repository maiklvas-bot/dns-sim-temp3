import { useState } from "react";
import type { WikiNote } from "@shared/simulation-content";
import { WIKI_NOTE_REQUIRED_FIELDS } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Добавление своего материала в раздел справочника.
 *
 * Все четыре поля обязательны: заметка без заголовка, короткого описания,
 * содержания или скриншота не объясняет ничего и только засоряет справочник.
 * Незаполненные поля подсвечиваются, а кнопка сохранения остаётся недоступной —
 * то же требование продублировано на сервере, форму можно обойти запросом.
 */

type Draft = {
  title: string;
  summary: string;
  body: string;
  imageAssetId: string;
};

const EMPTY: Draft = { title: "", summary: "", body: "", imageAssetId: "" };

const FIELD_TITLES: Record<(typeof WIKI_NOTE_REQUIRED_FIELDS)[number], string> = {
  title: "Заголовок",
  summary: "Краткое описание",
  body: "Содержание",
  imageAssetId: "Скриншот",
};

export function WikiNoteEditor({
  sectionId,
  sectionTitle,
  assets,
  onUploadAsset,
  onSave,
  onCancel,
}: {
  sectionId: string;
  sectionTitle: string;
  assets: { id: string; name: string; kind: string; publicUrl: string }[];
  onUploadAsset: (file: File) => Promise<string | null>;
  onSave: (note: Omit<WikiNote, "id" | "imageUrl">) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = WIKI_NOTE_REQUIRED_FIELDS.filter((field) => !draft[field].trim());
  const canSave = missing.length === 0 && !saving;

  const patch = (part: Partial<Draft>) => setDraft((value) => ({ ...value, ...part }));

  const invalid = (field: (typeof WIKI_NOTE_REQUIRED_FIELDS)[number]) =>
    touched && !draft[field].trim();

  const fieldClass = (field: (typeof WIKI_NOTE_REQUIRED_FIELDS)[number]) =>
    `dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white ${
      invalid(field) ? "border-[#ff8f6b] ring-1 ring-[#ff8f6b]" : ""
    }`;

  const image = assets.find((asset) => asset.id === draft.imageAssetId);

  return (
    <section className="rounded-xl border border-[#3b5878] bg-[#101826]/80 p-4">
      <div className="text-[13px] font-bold text-white">Свой материал в раздел «{sectionTitle}»</div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-[#8aa2c4]">
        Все поля обязательны. Материал появится в этом разделе справочника у всех сотрудников.
      </div>

      <div className="mt-3 space-y-2.5">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-[#8fa8cf]">
            {FIELD_TITLES.title} <span className="text-[#ff8f6b]">*</span>
          </span>
          <Input
            value={draft.title}
            placeholder="Например: Как мы считаем вес кейса на практике"
            onChange={(event) => patch({ title: event.target.value })}
            className={fieldClass("title")}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-[#8fa8cf]">
            {FIELD_TITLES.summary} <span className="text-[#ff8f6b]">*</span>
          </span>
          <Input
            value={draft.summary}
            placeholder="Одна строка: о чём материал"
            onChange={(event) => patch({ summary: event.target.value })}
            className={fieldClass("summary")}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-[#8fa8cf]">
            {FIELD_TITLES.body} <span className="text-[#ff8f6b]">*</span>
          </span>
          <Textarea
            value={draft.body}
            rows={5}
            placeholder="Что нужно знать, как это делать, на что смотреть"
            onChange={(event) => patch({ body: event.target.value })}
            className={fieldClass("body")}
          />
        </label>

        <div>
          <span className="mb-1 block text-[11px] font-semibold text-[#8fa8cf]">
            {FIELD_TITLES.imageAssetId} <span className="text-[#ff8f6b]">*</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={draft.imageAssetId}
              onChange={(event) => patch({ imageAssetId: event.target.value })}
              className={`h-9 min-w-[12rem] rounded-md px-2 text-[12.5px] ${fieldClass("imageAssetId")}`}
            >
              <option value="">Выберите изображение</option>
              {assets
                .filter((asset) => asset.kind === "image")
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
            </select>
            <label className="cursor-pointer rounded-md border border-[#3b5878] px-2.5 py-1.5 text-[12px] text-[#8ec5ff] transition hover:bg-[#6fa0ff]/10">
              Загрузить файл
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const id = await onUploadAsset(file);
                  if (id) patch({ imageAssetId: id });
                }}
              />
            </label>
          </div>
          {image && (
            <img
              src={image.publicUrl}
              alt=""
              className="mt-2 max-h-40 rounded-lg border border-[#243244] object-contain"
            />
          )}
        </div>
      </div>

      {touched && missing.length > 0 && (
        <div className="mt-3 rounded-lg border border-[#ffb27a]/35 bg-[#f68b1f]/8 px-3 py-2 text-[11.5px] text-[#ffb27a]">
          Не заполнено: {missing.map((field) => FIELD_TITLES[field]).join(", ")}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-lg border border-[#ff8f6b]/40 bg-[#ff8f6b]/10 px-3 py-2 text-[11.5px] text-[#ff8f6b]">
          {error}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={async () => {
            setTouched(true);
            if (missing.length > 0) return;
            setSaving(true);
            setError(null);
            try {
              await onSave({ sectionId, ...draft });
              setDraft(EMPTY);
              setTouched(false);
              onCancel();
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить материал");
            } finally {
              setSaving(false);
            }
          }}
          // Кнопка остаётся нажимаемой, чтобы показать, чего не хватает:
          // заблокированная кнопка молча ничего не объясняет.
          className={canSave ? "" : "opacity-70"}
        >
          {saving ? "Сохраняю…" : "Добавить материал"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-[#2a3a4e] bg-transparent text-[#9aabc6]"
          onClick={onCancel}
        >
          Отмена
        </Button>
      </div>
    </section>
  );
}
