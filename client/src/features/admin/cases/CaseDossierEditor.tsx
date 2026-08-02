import type { CaseDataPoint, CaseQaStatus, SimCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldArea, SelectField } from "../components/AdminFields";
import { buildCaseDossierSummary } from "./case-editor-support";
import { CaseValidationPanel } from "./CaseValidationPanel";

const QA_STATUS_OPTIONS: Array<{ value: CaseQaStatus; label: string }> = [
  { value: "draft", label: "Черновик" },
  { value: "auto_check_failed", label: "Автопроверка не пройдена" },
  { value: "methodical_review", label: "На методической проверке" },
  { value: "ready_prototype", label: "Готов к прототипу" },
  { value: "ready_launch", label: "Готов к запуску" },
];

export function CaseDossierEditor({
  entity,
  onChange,
}: {
  entity: SimCase;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  const summary = buildCaseDossierSummary(entity);
  const dataPoints = entity.dataPoints || [];
  const falseTrails = entity.falseTrails || [];

  const updateDataPoint = (index: number, patch: Partial<CaseDataPoint>) => {
    onChange({
      dataPoints: dataPoints.map((point, pointIndex) => (pointIndex === index ? { ...point, ...patch } : point)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm font-semibold text-white">Паспорт кейса</div>
          <div className={`text-xs font-semibold ${summary.isComplete ? "text-[#54d28c]" : "text-[#ffb27a]"}`}>
            {summary.filled} из {summary.total}
          </div>
        </div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Скрытая причина, данные и ложные следы — то, что заставляет участника диагностировать ситуацию, а не угадывать «правильную кнопку». Без них автопроверка не пропустит кейс дальше черновика.
        </div>
      </div>

      <FieldArea
        label="Бизнес-проблема"
        value={entity.businessProblem || ""}
        onChange={(value) => onChange({ businessProblem: value })}
      />
      <FieldArea
        label="Скрытая причина (участник её не видит)"
        value={entity.hiddenCause || ""}
        onChange={(value) => onChange({ hiddenCause: value })}
      />

      <div className="rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Данные для запроса</div>
            <div className="mt-1 text-[11px] text-[#8890a8]">Что участник может запросить, чтобы понять причину.</div>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => onChange({ dataPoints: [...dataPoints, { label: "", costToRequest: null }] })}
          >
            Добавить
          </Button>
        </div>
        <div className="space-y-2">
          {dataPoints.map((point, index) => (
            <div key={`data-point-${index}`} className="grid gap-2 md:grid-cols-[2fr,1fr,auto]">
              <div>
                <Label className="mb-1.5 block text-xs text-[#8890a8]">Что доступно</Label>
                <Input
                  value={point.label}
                  onChange={(event) => updateDataPoint(index, { label: event.target.value })}
                  className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-[#8890a8]">Цена запроса</Label>
                <Input
                  value={point.costToRequest || ""}
                  onChange={(event) => updateDataPoint(index, { costToRequest: event.target.value || null })}
                  className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-end border-[#ff4444]/30 bg-transparent text-[#ff9999]"
                onClick={() => onChange({ dataPoints: dataPoints.filter((_, pointIndex) => pointIndex !== index) })}
              >
                Удалить
              </Button>
            </div>
          ))}
          {dataPoints.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#31455f] bg-[#0e1624] px-4 py-4 text-center text-[11px] text-[#8aa2c4]">
              Пока не добавлено ни одной записи данных.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Ложные следы</div>
            <div className="mt-1 text-[11px] text-[#8890a8]">Правдоподобные, но неверные объяснения ситуации.</div>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => onChange({ falseTrails: [...falseTrails, ""] })}
          >
            Добавить
          </Button>
        </div>
        <div className="space-y-2">
          {falseTrails.map((trail, index) => (
            <div key={`false-trail-${index}`} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="mb-1.5 block text-xs text-[#8890a8]">Ложный след {index + 1}</Label>
                <Input
                  value={trail}
                  onChange={(event) =>
                    onChange({
                      falseTrails: falseTrails.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                    })
                  }
                  className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[#ff4444]/30 bg-transparent text-[#ff9999]"
                onClick={() => onChange({ falseTrails: falseTrails.filter((_, itemIndex) => itemIndex !== index) })}
              >
                Удалить
              </Button>
            </div>
          ))}
          {falseTrails.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#31455f] bg-[#0e1624] px-4 py-4 text-center text-[11px] text-[#8aa2c4]">
              Пока не добавлено ни одного ложного следа.
            </div>
          )}
        </div>
      </div>

      <SelectField
        label="Статус готовности"
        value={entity.qaStatus || "draft"}
        onChange={(value) => onChange({ qaStatus: value as CaseQaStatus })}
        options={QA_STATUS_OPTIONS}
      />

      <CaseValidationPanel caseInput={entity} />
    </div>
  );
}
