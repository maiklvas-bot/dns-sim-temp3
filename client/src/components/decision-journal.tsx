import { useSimulation } from "../context/SimulationContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function DecisionJournal() {
  const { state, dispatch } = useSimulation();
  const decisions = [...state.decisions].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return (
    <Sheet open={state.journalOpen} onOpenChange={() => dispatch({ type: "TOGGLE_JOURNAL" })}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[480px] bg-card border-border text-foreground p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="text-foreground text-base">
            📋 Журнал решений
            <span className="text-xs text-muted-foreground font-normal ml-2">
              ({decisions.length} записей)
            </span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100dvh-80px)]">
          <div className="p-4 space-y-3">
            {decisions.length === 0 && (
              <p className="text-sm text-foreground text-center py-8">
                Решения ещё не приняты
              </p>
            )}

            {decisions.map((d, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-card/60 p-3"
                data-testid={`journal-entry-${idx}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[#FF6B00] font-medium">
                    {d.caseId} • Этап {d.cycle}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{d.simTime}</span>
                </div>
                <div className="text-sm text-foreground font-medium mb-1">{d.caseTitle}</div>
                <p className="text-[13px] text-foreground mb-2 line-clamp-2">{d.optionText}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[10px] border ${
                      d.score >= 4
                        ? "border-[#00d4aa]/40 text-[#00d4aa]"
                        : d.score >= 3
                        ? "border-[#ffc107]/40 text-[#ffc107]"
                        : "border-[#ff4444]/40 text-[#ff4444]"
                    }`}
                  >
                    Балл: {d.score}/5
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-border text-foreground">
                    Вариант {d.optionLevel}
                  </Badge>
                </div>
                {/* Mini consequence summary */}
                {d.consequences.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
                    {d.consequences.slice(0, 3).map((c, ci) => (
                      <div key={ci} className="text-[11px] text-muted-foreground">
                        {c.icon} {c.metric}: <span style={{ color: c.direction === "up" ? "#00d4aa" : "#ff4444" }}>{c.displayValue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
