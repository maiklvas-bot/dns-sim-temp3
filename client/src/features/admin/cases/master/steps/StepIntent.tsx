import type { CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { CompetencyRoleSelector, Field, FieldArea } from "../../../components/AdminFields";
import { MasterHelp } from "../MasterHelp";
import { HELP } from "../master-help-topics";

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
        <div className="dns-master-hint mt-1">
          Начните с того, какую рабочую ситуацию воспроизводит кейс и какое поведение вы хотите увидеть.
          Всё остальное — сигнал, варианты ответа, эффекты — будет строиться вокруг этого.
          У каждого блока есть знак вопроса: там объяснение и готовый пример.
        </div>
      </div>

      <div>
        <Field label="Название кейса" value={entity.title} onChange={(value) => onChange({ title: value })} />
        <div className="dns-master-hint mt-1 flex items-start gap-1.5">
          <MasterHelp topic={HELP.caseTitle} />
          <span>Коротко и по делу: «Очередь на кассе в час пик».</span>
        </div>
      </div>

      <div>
        <FieldArea label="Описание" value={entity.description} onChange={(value) => onChange({ description: value })} />
        <div className="dns-master-hint mt-1 flex items-start gap-1.5">
          <MasterHelp topic={HELP.caseDescription} />
          <span>Что происходит в подразделении. Это увидит оценщик, не участник.</span>
        </div>
      </div>

      <div>
        <FieldArea
          label="Бизнес-проблема"
          value={entity.businessProblem || ""}
          onChange={(value) => onChange({ businessProblem: value })}
        />
        <div className="dns-master-hint mt-1 flex items-start gap-1.5">
          <MasterHelp topic={HELP.businessProblem} />
          <span>Чем ситуация вредит магазину, если её решают плохо: теряем клиентов, растут потери, выгорает смена.</span>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-xs font-semibold text-[#8890a8]">Компетенции кейса</span>
          <MasterHelp topic={HELP.competencies} />
        </div>
        <CompetencyRoleSelector
          primaryValues={entity.primaryCompetencies || []}
          secondaryValues={entity.secondaryCompetencies || []}
          onChange={(next) => onChange(next)}
          competencies={competencies}
        />
        <div className="dns-master-hint mt-1">
          Первичные — то, ради чего кейс существует, они дают основной вес в оценке. Вторичные проявятся
          попутно. Держитесь 1–2 первичных: если отметить половину списка, кейс не проверяет ничего конкретного.
        </div>
      </div>
    </div>
  );
}
