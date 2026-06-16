import { CheckCircle2, CircleDot, ListChecks } from "lucide-react";
import type { getSimulationProgressSummary } from "@/context/SimulationContext";

type SimulationProgressSummary = ReturnType<typeof getSimulationProgressSummary>;

export function SimulationProgressRail({ summary }: { summary: SimulationProgressSummary }) {
  const steps = [
    { key: "done", label: "Пройдено", value: summary.completed, color: "#00d4aa" },
    { key: "active", label: "В работе", value: summary.active, color: "#FFB300" },
    { key: "left", label: "Осталось", value: Math.max(0, summary.futureMain + summary.futureChannels), color: "#4a9eff" },
  ];

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-[#2a3a4e] bg-[#101826cc] px-2.5 py-3 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-center">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-[#4a9eff]/35 bg-[#4a9eff]/10 text-[#8ec5ff]">
          <ListChecks className="h-4 w-4" />
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-semibold uppercase leading-4 tracking-[0.14em] text-[#8aa2c4]">Ход</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-white">{summary.completed}</div>
        <div className="text-[10px] text-[#6f829e]">из {summary.total}</div>
      </div>
      <div className="my-3 h-px bg-[#26364c]" />
      <div className="relative flex min-h-0 flex-1 justify-center">
        <div className="absolute bottom-2 top-2 w-1 rounded-full bg-[#1d2a3d]" />
        <div className="absolute top-2 w-1 rounded-full bg-[#00d4aa]" style={{ height: `${Math.min(100, Math.max(0, summary.percent))}%` }} />
        <div className="relative z-10 flex w-full flex-col justify-between py-1">
          {steps.map((step) => (
            <div key={step.key} className="flex flex-col items-center gap-1 rounded-xl bg-[#101826]/80 py-1">
              {step.key === "done" ? <CheckCircle2 className="h-4 w-4" style={{ color: step.color }} /> : <CircleDot className="h-4 w-4" style={{ color: step.color }} />}
              <div className="text-sm font-bold tabular-nums text-white">{step.value}</div>
              <div className="max-w-[4.4rem] text-center text-[9px] font-semibold uppercase leading-3 tracking-[0.08em] text-[#8aa2c4]">{step.label}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function SimulationProgressCompact({ summary }: { summary: SimulationProgressSummary }) {
  return (
    <div className="rounded-2xl border border-[#2a3a4e] bg-[#101826cc] px-3 py-2 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8ec5ff]">
          <ListChecks className="h-3.5 w-3.5" />
          Ход симуляции
        </div>
        <div className="text-xs font-bold tabular-nums text-white">{summary.completed} / {summary.total}</div>
      </div>
      <div className="h-2 rounded-full border border-[#26364c] bg-[#101826] p-[2px]">
        <div className="h-full rounded-full bg-[#00d4aa]" style={{ width: `${Math.min(100, Math.max(0, summary.percent))}%` }} />
      </div>
    </div>
  );
}
