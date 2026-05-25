import { Clock3 } from "lucide-react";
import { formatDuration, getDeadlineSnapshot, type ScenarioDeadline } from "@/lib/simulation-timing";

export default function DeadlineChip({
  deadline,
  elapsedSeconds,
  referenceElapsedSeconds,
  compact = false,
}: {
  deadline: ScenarioDeadline | null | undefined;
  elapsedSeconds: number;
  referenceElapsedSeconds?: number | null;
  compact?: boolean;
}) {
  const effectiveElapsed = referenceElapsedSeconds ?? elapsedSeconds;
  const snapshot = getDeadlineSnapshot(deadline, effectiveElapsed);

  if (!deadline || !snapshot) {
    return null;
  }

  const toneClass = snapshot.isOverdue
    ? "border-[#d98f8f]/45 bg-[#d98f8f]/14 text-[#ffe7e7]"
    : snapshot.remainingSeconds <= 60
    ? "border-[#d7a5a5]/45 bg-[#d7a5a5]/14 text-[#ffeaea]"
    : "border-[#4a9eff]/40 bg-[#4a9eff]/10 text-[#8ec5ff]";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${toneClass} ${compact ? "text-[10px]" : "text-xs"}`}
      data-testid="deadline-chip"
      title={deadline.sourceText}
    >
      <Clock3 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span className="font-medium">
        {snapshot.isOverdue ? "Просрочено" : deadline.label}
      </span>
      <span className="tabular-nums opacity-90">
        {formatDuration(snapshot.remainingSeconds)}
      </span>
    </div>
  );
}
