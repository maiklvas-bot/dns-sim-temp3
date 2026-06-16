import { AlertTriangle, Clock3, ShieldAlert } from "lucide-react";
import { useSimulation, getActiveTimerSnapshots } from "../context/SimulationContext";
import { formatDuration } from "@/lib/simulation-timing";

function getTone(remainingSeconds: number, isOverdue: boolean) {
  if (isOverdue) {
    return {
      accent: "#d98f8f",
      border: "border-[#d98f8f]/45",
      background: "bg-[#d98f8f]/12",
      label: "Просрочено",
    };
  }

  if (remainingSeconds <= 60) {
    return {
      accent: "#d7a5a5",
      border: "border-[#d7a5a5]/45",
      background: "bg-[#d7a5a5]/14",
      label: "Критично",
    };
  }

  return {
    accent: "#4a9eff",
    border: "border-[#4a9eff]/30",
    background: "bg-[#4a9eff]/8",
    label: "В работе",
  };
}

export default function ActiveTimersPanel() {
  const { state } = useSimulation();
  const activeTimers = getActiveTimerSnapshots(state);

  if (activeTimers.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-[linear-gradient(180deg,rgba(30,42,58,0.9),rgba(14,21,33,0.94))] p-3">
        <div className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#4a9eff]" />
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase leading-4 tracking-[0.12em] text-[#8ec5ff]">Активные таймеры</div>
            <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Дедлайны появятся здесь сразу после прихода задач.</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/72 px-3 py-2">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 text-[11px] leading-4 text-foreground">
            Сейчас нет активных дедлайнов или событие ещё не пришло.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex h-full flex-col rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(30,42,58,0.9),rgba(14,21,33,0.94))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-[#8ec5ff]">Активные таймеры</div>
          <div className="text-[12px] text-muted-foreground">Все задачи с ограничением по времени</div>
        </div>
        <div className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-foreground shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
          {activeTimers.length}
        </div>
      </div>

      <div className="custom-scroll flex-1 space-y-2 overflow-y-auto pr-1">
        {activeTimers.map((timer) => {
          const remainingSeconds = Math.max(0, timer.dueAtElapsed - state.elapsedSeconds);
          const isOverdue = state.elapsedSeconds > timer.dueAtElapsed;
          const tone = getTone(remainingSeconds, isOverdue);
          const progress = Math.max(
            6,
            Math.min(
              100,
              ((isOverdue ? timer.totalSeconds : timer.dueAtElapsed - state.elapsedSeconds) / Math.max(1, timer.totalSeconds)) * 100,
            ),
          );

          return (
            <div
              key={timer.id}
              className={`rounded-xl border ${tone.border} ${tone.background} p-3`}
              data-testid={`active-timer-${timer.id}`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">{timer.title}</div>
                  <div className="mt-0.5 text-[12px] text-foreground">
                    {timer.taskType} • {timer.responsibility || "Без уточнения"}
                  </div>
                </div>
                <div className="rounded-full px-2 py-1 text-[11px] font-semibold" style={{ color: tone.accent, backgroundColor: `${tone.accent}22` }}>
                  {tone.label}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
                <div>
                  <div className="mb-0.5">Зона ответственности</div>
                  <div className="text-foreground">{timer.zoneLabel || "Общая зона"}</div>
                </div>
                <div>
                  <div className="mb-0.5">Осталось времени</div>
                  <div className="font-mono text-foreground">
                    {isOverdue ? `+${formatDuration(state.elapsedSeconds - timer.dueAtElapsed)}` : formatDuration(remainingSeconds)}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Срочность</span>
                  <span>{timer.label}</span>
                </div>
                <div className="h-2 rounded-full bg-background">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, backgroundColor: tone.accent }}
                  />
                </div>
              </div>

              {isOverdue && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#d98f8f]/35 bg-[#0f1724]/40 px-2.5 py-2 text-[12px] text-[#ffe3e3]">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Просрочка учитывается в итоговой оценке.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
