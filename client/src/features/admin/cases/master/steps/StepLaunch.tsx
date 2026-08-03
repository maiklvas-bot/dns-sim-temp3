import type { SimCase } from "@shared/simulation-content";
import { Field } from "../../../components/AdminFields";
import { CaseMediaPanel } from "../../CaseEditors";
import { CaseValidationPanel } from "../../CaseValidationPanel";
import { MasterHelp } from "../MasterHelp";
import { HELP } from "../master-help-topics";

export function StepLaunch({
  entity,
  assets,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  onChange,
}: {
  entity: SimCase;
  assets: any[];
  onUploadAsset: (file: File) => Promise<string | null>;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  const updateTiming = (patch: Record<string, number | null>) => {
    onChange({ timing: { ...(entity.timing || {}), ...patch } });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Готов ли кейс к участникам?</div>
        <div className="dns-master-hint mt-1">
          Последний шаг: как кейс выглядит и когда приходит. Ниже — результат автопроверки: пока есть
          замечания, кейс нельзя пометить готовым, но черновик сохраняется свободно.
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-[#8aa2c4]">
            <MasterHelp topic={HELP.defaultMedia} /> Медиа по умолчанию
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#8aa2c4]">
            <MasterHelp topic={HELP.timing} /> Тайминги
          </span>
        </div>
      </div>

      <CaseMediaPanel
        title="Медиа кейса по умолчанию"
        helper="Используется, если у конкретного шага не выбраны свои изображение или озвучка."
        target={entity}
        assets={assets}
        onChange={(patch) => onChange(patch)}
        onUploadAsset={onUploadAsset}
        onTogglePreviewAudio={onTogglePreviewAudio}
        activePreviewKey={activePreviewKey}
        previewKey={`case-default:${entity.id}`}
      />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Field
          label="Мин. интервал, сек"
          value={entity.timing?.minIntervalSeconds ?? ""}
          onChange={(value) => updateTiming({ minIntervalSeconds: value ? Number(value) : null })}
        />
        <Field
          label="Макс. интервал, сек"
          value={entity.timing?.maxIntervalSeconds ?? ""}
          onChange={(value) => updateTiming({ maxIntervalSeconds: value ? Number(value) : null })}
        />
        <Field
          label="Срок решения, сек"
          value={entity.timing?.decisionDeadlineSeconds ?? ""}
          onChange={(value) => updateTiming({ decisionDeadlineSeconds: value ? Number(value) : null })}
        />
        <Field
          label="Повтор напоминания, сек"
          value={entity.timing?.reminderIntervalSeconds ?? 180}
          onChange={(value) => updateTiming({ reminderIntervalSeconds: value ? Number(value) : null })}
        />
      </div>

      <Field
        label="Порядок показа"
        value={entity.sortOrder}
        onChange={(value) => onChange({ sortOrder: Number(value) })}
      />

      <CaseValidationPanel caseInput={entity} onChange={onChange} />
    </div>
  );
}
