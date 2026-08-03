import type { CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { CompetencyRoleSelector, Field, FieldArea } from "../../../components/AdminFields";

export function StepIntent({
  entity,
  competencies,
  onChange,
}: {
  entity: SimCase;
  competencies: CompetencyDefinition[];
  onChange: (patch: Partial<SimCase>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Зачем этот кейс и что он проверяет?</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Начните с того, какую рабочую ситуацию воспроизводит кейс и какое поведение вы хотите увидеть.
          Всё остальное — сигнал, варианты ответа, эффекты — будет строиться вокруг этого.
        </div>
      </div>

      <Field label="Название кейса" value={entity.title} onChange={(value) => onChange({ title: value })} />
      <div className="text-[11px] text-[#70829d]">Коротко и по делу: «Очередь на кассе в час пик».</div>

      <FieldArea label="Описание" value={entity.description} onChange={(value) => onChange({ description: value })} />
      <div className="text-[11px] text-[#70829d]">Что происходит в подразделении. Это увидит оценщик, не участник.</div>

      <FieldArea
        label="Бизнес-проблема"
        value={entity.businessProblem || ""}
        onChange={(value) => onChange({ businessProblem: value })}
      />
      <div className="text-[11px] text-[#70829d]">
        Чем эта ситуация вредит магазину, если её решают плохо: теряем клиентов, растут потери, выгорает смена.
      </div>

      <CompetencyRoleSelector
        primaryValues={entity.primaryCompetencies || []}
        secondaryValues={entity.secondaryCompetencies || []}
        onChange={(next) => onChange(next)}
        competencies={competencies}
      />
      <div className="text-[11px] text-[#70829d]">
        Основные — то, ради чего кейс существует. Дополнительные проявятся попутно.
      </div>
    </div>
  );
}
