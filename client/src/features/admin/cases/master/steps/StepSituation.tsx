import type { SimCase, ZoneType } from "@shared/simulation-content";
import { FieldArea, MultiSelectField, SelectField, SuggestField } from "../../../components/AdminFields";
import { CASE_SIGNAL_TYPE_OPTIONS, STORE_ZONE_OPTIONS } from "../../case-editor-support";
import { CaseDossierEditor } from "../../CaseDossierEditor";

export function StepSituation({
  entity,
  caseSourceOptions,
  onChange,
}: {
  entity: SimCase;
  caseSourceOptions: string[];
  onChange: (patch: Partial<SimCase>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Что видит участник и что от него скрыто?</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Участник видит только симптом. Настоящая причина, доступные данные и ложные следы — то, что превращает
          кейс в расследование, а не в угадывание правильной кнопки.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SuggestField
          label="Источник сигнала"
          value={entity.trigger.source}
          onChange={(value) => onChange({ trigger: { ...entity.trigger, source: value } })}
          options={caseSourceOptions}
        />
        <SelectField
          label="Тип сигнала"
          value={entity.trigger.type}
          onChange={(value) => {
            const nextType = CASE_SIGNAL_TYPE_OPTIONS.find((option) => option.value === value)?.value;
            if (!nextType) return;
            onChange({ trigger: { ...entity.trigger, type: nextType } });
          }}
          options={[...CASE_SIGNAL_TYPE_OPTIONS]}
        />
        <MultiSelectField
          label="Зоны магазина"
          values={entity.zones_affected || []}
          onChange={(values) =>
            onChange({
              zones_affected: values.filter((value): value is ZoneType =>
                STORE_ZONE_OPTIONS.some((option) => option.value === value),
              ),
            })
          }
          options={[...STORE_ZONE_OPTIONS]}
        />
      </div>

      <FieldArea
        label="Текст сигнала"
        value={entity.trigger.text}
        onChange={(value) => onChange({ trigger: { ...entity.trigger, text: value } })}
      />
      <div className="text-[11px] text-[#70829d]">
        Первое, что получит участник. Здесь только симптом — причину он должен найти сам.
      </div>

      <CaseDossierEditor entity={entity} onChange={onChange} />
    </div>
  );
}
