import { useState } from "react";
import { CASE_TEMPLATES } from "@shared/case-templates";
import type { MasterStepId } from "./case-master-support";

/** Что показываем из эталона на каждом этапе. */
function peekContent(stepId: MasterStepId, templateIndex: number): Array<{ label: string; value: string }> {
  const template = CASE_TEMPLATES[templateIndex];
  const caseData = template.caseData;
  const firstCycle = caseData.cycles[0];

  if (stepId === "situation") {
    return [
      { label: "Текст сигнала", value: caseData.trigger.text },
      { label: "Скрытая причина", value: caseData.hiddenCause || "" },
      { label: "Данные для запроса", value: (caseData.dataPoints || []).map((point) => point.label).join(" · ") },
      { label: "Ложные следы", value: (caseData.falseTrails || []).join(" · ") },
    ];
  }

  if (stepId === "decisions") {
    return (firstCycle?.options || []).map((option) => ({
      label: `Вариант ${option.level}`,
      value: `${option.text} — ${Object.entries(option.competency_scores || {}).map(([id, score]) => `${id}: ${score}`).join(", ")}`,
    }));
  }

  if (stepId === "intent") {
    return [
      { label: "Название", value: caseData.title },
      { label: "Бизнес-проблема", value: caseData.businessProblem || "" },
      {
        label: "Компетенции",
        value: [
          (caseData.primaryCompetencies || []).map((id) => `${id} — первичная`).join(", "),
          (caseData.secondaryCompetencies || []).map((id) => `${id} — вторичная`).join(", "),
        ]
          .filter(Boolean)
          .join("; "),
      },
      { label: "Чему учит образец", value: template.teaches },
    ];
  }

  if (stepId === "structure") {
    // Форму кейса видно по переходам: куда ведёт каждый ответ.
    return caseData.cycles.map((cycle) => {
      const targets = (cycle.options || []).map((option) => {
        if (option.nextCycleId === "__complete") return "финал";
        const target = caseData.cycles.find((item) => item.id === option.nextCycleId);
        return target ? `шаг ${target.cycle}` : "дальше по порядку";
      });
      return {
        label: `Шаг ${cycle.cycle}`,
        value: `${cycle.situation} → ${targets.join(" / ")}`,
      };
    });
  }

  return [];
}

export function TemplatePeek({ stepId }: { stepId: MasterStepId }) {
  const [open, setOpen] = useState(false);
  const [templateIndex, setTemplateIndex] = useState(0);

  const rows = peekContent(stepId, templateIndex);
  if (rows.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-[#8aa2c4] underline decoration-dotted underline-offset-2 hover:text-white"
      >
        Как это выглядит в образце
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#243244] bg-[#0d1522]/70 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8aa2c4]">Образец</div>
        <select
          value={templateIndex}
          onChange={(event) => setTemplateIndex(Number(event.target.value))}
          className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-2 py-1 text-[11px] text-white"
        >
          {CASE_TEMPLATES.map((template, index) => (
            <option key={template.id} value={index}>{template.title}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto text-[11px] text-[#8aa2c4] hover:text-white"
        >
          Свернуть
        </button>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div key={`peek-${index}`}>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#8aa2c4]">{row.label}</div>
            <div className="text-[11.5px] leading-relaxed text-[#cbd8ef]">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
