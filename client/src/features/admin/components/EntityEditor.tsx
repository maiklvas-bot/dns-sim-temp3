import type { ChatInfo, CompetencyDefinition } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pause, Play } from "lucide-react";
import { StructuredOptionsEditor } from "../cases/CaseEditors";
import { getPreviewAudioUrl } from "../cases/case-editor-support";
import { Field, FieldArea, SelectField, SuggestField } from "./AdminFields";

export function EntityEditor({
  title,
  entity,
  assets,
  competencies,
  chats,
  caseSourceOptions,
  emailSenderOptions,
  emailDepartmentOptions,
  messengerSenderOptions,
  messengerRoleOptions,
  videoSenderOptions,
  videoRoleOptions,
  onChange,
  onUploadAsset,
  mode,
  onAddOption,
  onTogglePreviewAudio,
  activePreviewKey,
  selectedCycleIndex,
  onSelectedCycleIndexChange,
}: {
  title: string;
  entity: any;
  assets: any[];
  competencies: CompetencyDefinition[];
  chats: ChatInfo[];
  caseSourceOptions: string[];
  emailSenderOptions: string[];
  emailDepartmentOptions: string[];
  messengerSenderOptions: string[];
  messengerRoleOptions: string[];
  videoSenderOptions: string[];
  videoRoleOptions: string[];
  onChange: (value: any) => void;
  onUploadAsset: (file: File) => Promise<string | null>;
  mode: "case" | "email" | "messenger" | "video";
  onAddOption: () => void;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
  selectedCycleIndex?: number;
  onSelectedCycleIndexChange?: (index: number) => void;
}) {
  const imageAssets = assets.filter((asset) => asset.kind === "image");
  const audioAssets = assets.filter((asset) => asset.kind === "audio");
  const videoAssets = assets.filter((asset) => asset.kind === "video");
  const selectedAudioAsset = audioAssets.find((asset) => asset.id === entity.audioAssetId);
  const selectedVideoAsset = videoAssets.find((asset) => asset.id === entity.videoAssetId);
  const previewAudioUrl = selectedAudioAsset?.publicUrl || getPreviewAudioUrl(entity.id, mode);
  const previewKey = `${mode}:${entity.id}`;
  const isPreviewActive = activePreviewKey === previewKey;
  const competencyOptions = competencies.map((competency) => ({
    value: competency.id,
    label: competency.name,
  }));
  const update = (patch: Record<string, any>) => onChange({ ...entity, ...patch });
  const updateTiming = (patch: Record<string, number | null>) => {
    update({
      timing: {
        ...entity.timing,
        arrivalMinute: entity.arrivalMinute,
        ...patch,
      },
    });
  };
  const timingTitle = mode === "email"
    ? "Тайминг письма"
    : mode === "messenger"
    ? "Тайминг сообщения"
    : "Тайминг видеозвонка";
  const timingHelper = "Регулирует минуту появления канального события, срок решения и повторное напоминание участнику.";
  const audioTitle = mode === "email"
    ? "Аудио письма"
    : mode === "messenger"
    ? "Аудиосообщение"
    : mode === "video"
    ? "Озвучка видео"
    : "Озвучка кейса";

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <Field label="Порядок показа" value={entity.sortOrder} onChange={(value) => update({ sortOrder: Number(value) })} />
      <div className="rounded-2xl border border-[#f68b1f]/35 bg-gradient-to-br from-[#f68b1f]/14 via-[#1a2537]/88 to-[#101826]/92 p-4 shadow-[0_18px_45px_rgba(255,107,0,0.12)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb27a]">Настройки хода симуляции</div>
            <div className="mt-1 text-base font-bold text-white">{timingTitle}</div>
            <div className="mt-1 max-w-2xl text-xs leading-relaxed text-[#b8c7df]">{timingHelper}</div>
          </div>
          <div className="rounded-full border border-[#f68b1f]/35 bg-[#f68b1f]/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb27a]">
            Видно сразу
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          <Field
            label="Минута прихода"
            value={entity.timing?.arrivalMinute ?? entity.arrivalMinute ?? ""}
            onChange={(value) => {
              const nextValue = value ? Number(value) : 0;
              update({
                arrivalMinute: nextValue,
                timing: {
                  ...entity.timing,
                  arrivalMinute: value ? nextValue : null,
                },
              });
            }}
          />
          <Field
            label="Срок решения, сек"
            value={entity.timing?.decisionDeadlineSeconds ?? ""}
            onChange={(value) => updateTiming({ decisionDeadlineSeconds: value ? Number(value) : null })}
          />
          <Field
            label="Повтор напоминания, сек"
            value={entity.timing?.reminderIntervalSeconds ?? (mode === "messenger" ? 5 : 180)}
            onChange={(value) => updateTiming({ reminderIntervalSeconds: value ? Number(value) : null })}
          />
          <div className="rounded-xl border border-[#30445f] bg-[#101826]/75 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8ec5ff]">Канал</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {mode === "email" ? "Почта" : mode === "messenger" ? "Мессенджер" : "Видео звонок"}
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-[#8aa2c4]">Эти значения применяются без изменения текста и вариантов ответа.</div>
          </div>
        </div>
      </div>
      {mode === "email" && (
        <>
          <Field label="Тема" value={entity.subject} onChange={(value) => update({ subject: value })} />
          <SuggestField label="Отправитель" value={entity.from} onChange={(value) => update({ from: value })} options={emailSenderOptions} />
          <div className="grid gap-4 md:grid-cols-2">
            <SuggestField label="Подразделение" value={entity.department} onChange={(value) => update({ department: value })} options={emailDepartmentOptions} />
            <Field label="Цвет отдела" value={entity.departmentColor} onChange={(value) => update({ departmentColor: value })} />
          </div>
          <SelectField
            label="Компетенция"
            value={entity.primaryCompetency}
            onChange={(value) => update({ primaryCompetency: value })}
            options={competencyOptions}
          />
          <FieldArea label="Короткое превью письма" value={entity.preview} onChange={(value) => update({ preview: value })} />
          <FieldArea label="Тело письма" value={entity.body} onChange={(value) => update({ body: value })} />
          <StructuredOptionsEditor
            title="Варианты ответа"
            options={entity.options || []}
            competencies={competencies}
            onChange={(options) => update({ options })}
          />
        </>
      )}
      {mode === "messenger" && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SuggestField label="Отправитель" value={entity.senderName} onChange={(value) => update({ senderName: value })} options={messengerSenderOptions} />
            <SuggestField label="Роль" value={entity.senderRole} onChange={(value) => update({ senderRole: value })} options={messengerRoleOptions} />
            <Field label="Аватар" value={entity.senderAvatar} onChange={(value) => update({ senderAvatar: value })} />
          </div>
          <Label className="text-xs text-[#8890a8] block">Чат</Label>
          <select value={entity.chatId} onChange={(e) => update({ chatId: e.target.value })} className="w-full rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white">
            <option value="">Выберите чат</option>
            {chats.map((chat) => <option key={chat.id} value={chat.id}>{chat.name}</option>)}
          </select>
          <SelectField
            label="Компетенция"
            value={entity.primaryCompetency}
            onChange={(value) => update({ primaryCompetency: value })}
            options={competencyOptions}
          />
          <FieldArea label="Сообщение" value={entity.message} onChange={(value) => update({ message: value })} />
          <StructuredOptionsEditor
            title="Варианты ответа"
            options={entity.options || []}
            competencies={competencies}
            onChange={(options) => update({ options })}
          />
        </>
      )}
      {mode === "video" && (
        <>
          <Field label="Заголовок" value={entity.title} onChange={(value) => update({ title: value })} />
          <div className="grid gap-4 md:grid-cols-3">
            <SuggestField label="Отправитель" value={entity.sender} onChange={(value) => update({ sender: value })} options={videoSenderOptions} />
            <SuggestField label="Роль" value={entity.role} onChange={(value) => update({ role: value })} options={videoRoleOptions} />
            <Field label="Аватар" value={entity.senderAvatar} onChange={(value) => update({ senderAvatar: value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Длительность" value={entity.duration} onChange={(value) => update({ duration: value })} />
            <SelectField
              label="Компетенция"
              value={entity.primaryCompetency}
              onChange={(value) => update({ primaryCompetency: value })}
              options={competencyOptions}
            />
          </div>
          <FieldArea label="Ситуация" value={entity.situation} onChange={(value) => update({ situation: value })} />
          <StructuredOptionsEditor
            title="Варианты ответа"
            options={entity.options || []}
            competencies={competencies}
            onChange={(options) => update({ options })}
          />
        </>
      )}

      {mode === "video" ? (
        <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-4">
          <div className="text-xs font-semibold text-[#8890a8] mb-3 uppercase tracking-wider">Видеофайл</div>
          <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
            <select
              value={entity.videoAssetId || ""}
              onChange={(e) => update({ videoAssetId: e.target.value || null, imageAssetId: null })}
              className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
            >
              <option value="">Без видеофайла</option>
              {videoAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="bg-[#141c2b] border-[#2a3a4e] text-white"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const assetId = await onUploadAsset(file);
                if (assetId) update({ videoAssetId: assetId, imageAssetId: null });
              }}
            />
          </div>
          <div className="mt-2 text-[11px] text-[#8fa0b8]">
            Если видео не выбрано, в симуляции останется цифровой аватар.
          </div>
          <div className="mt-2 rounded-xl border border-[#29425f] bg-[#122031] px-3 py-2 text-[11px] leading-5 text-[#cbd8ef]">
            Рекомендуемый формат: `MP4`, горизонтальное `16:9`, лучше всего `1280x720` или `1920x1080`.
            Видео в симуляции теперь показывается целиком без обрезки, поэтому важно оставлять лицо и ключевой контент в центре кадра.
            Допустимый размер файла до `150 MB`.
          </div>
          {selectedVideoAsset?.publicUrl && (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#2a3a4e] bg-black/30">
              <video
                src={selectedVideoAsset.publicUrl}
                controls
                playsInline
                preload="metadata"
                className="h-48 w-full bg-black object-contain"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-4">
          <div className="text-xs font-semibold text-[#8890a8] mb-3 uppercase tracking-wider">Изображение</div>
          <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
            <select value={entity.imageAssetId || ""} onChange={(e) => update({ imageAssetId: e.target.value || null })} className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white">
              <option value="">Без изображения</option>
              {imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Input type="file" accept="image/png,image/jpeg,image/webp" className="bg-[#141c2b] border-[#2a3a4e] text-white" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const assetId = await onUploadAsset(file);
              if (assetId) update({ imageAssetId: assetId });
            }} />
          </div>
        </div>
      )}

      <div className={`rounded-lg border p-4 ${isPreviewActive ? "border-[#00d4aa]/40 bg-[#00d4aa]/8" : "border-[#2a3a4e] bg-[#141c2b]/40"}`}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#8890a8]">{audioTitle}</div>
              <div className="mt-1 text-sm text-white">Связанный аудиофайл для воспроизведения в симуляции</div>
              <div className="mt-1 text-[11px] text-[#8fa0b8]">
                Если файл не выбран, система оставит только системный сигнал канала и не будет озвучивать текст роботом.
              </div>
            </div>
            {isPreviewActive && (
              <span className="rounded-full bg-[#00d4aa]/16 px-2 py-1 text-[10px] font-semibold text-[#00d4aa]">
                Активный трек
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
            <select value={entity.audioAssetId || ""} onChange={(e) => update({ audioAssetId: e.target.value || null })} className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white">
              <option value="">Без аудио</option>
              {audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/x-m4a,audio/aac" className="bg-[#141c2b] border-[#2a3a4e] text-white" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const assetId = await onUploadAsset(file);
              if (assetId) update({ audioAssetId: assetId });
            }} />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[#00d4aa] text-[#0d1117] hover:bg-[#00c39c]"
              onClick={() => onTogglePreviewAudio(previewKey, previewAudioUrl)}
            >
              <Play className="mr-2 h-4 w-4" />
              Плей
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[#2a3a4e] bg-transparent text-[#8890a8]"
              onClick={() => isPreviewActive && onTogglePreviewAudio(previewKey, previewAudioUrl)}
            >
              <Pause className="mr-2 h-4 w-4" />
              Пауза
            </Button>
          </div>
      </div>
    </div>
  );
}
