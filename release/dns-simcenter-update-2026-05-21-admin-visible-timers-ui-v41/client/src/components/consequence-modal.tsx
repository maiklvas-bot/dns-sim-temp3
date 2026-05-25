import { useSimulation } from "../context/SimulationContext";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function ConsequenceModal() {
  const { state, dispatch } = useSimulation();

  if (!state.showConsequence || state.lastConsequences.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-[#2a3a4e] bg-[#1e2a3af5] p-5 shadow-2xl">
        {/* Close button */}
        <button
          onClick={() => dispatch({ type: "DISMISS_CONSEQUENCE" })}
          className="absolute top-3 right-3 text-[#555570] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-sm font-semibold text-[#FF6B00] mb-1">Результат решения</div>
        <p className="text-xs text-[#8890a8] mb-4 line-clamp-2">
          {state.lastOptionText}
        </p>

        {/* Consequence items */}
        <div className="space-y-2.5 mb-5 max-h-[300px] overflow-y-auto custom-scroll pr-1">
          {state.lastConsequences.map((c, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                c.direction === "up"
                  ? "border-[#00d4aa]/20 bg-[#00d4aa]/5"
                  : c.direction === "down"
                  ? "border-[#ff4444]/20 bg-[#ff4444]/5"
                  : "border-[#2a3a4e]/30 bg-[#1a1a2e]/30"
              }`}
            >
              <span className="text-lg flex-shrink-0">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-white">{c.metric}</span>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{
                      color: c.direction === "up" ? "#00d4aa" : c.direction === "down" ? "#ff4444" : "#8890a8",
                    }}
                  >
                    {c.displayValue}
                  </span>
                </div>
                <p className="text-xs text-[#8890a8] mt-0.5 leading-relaxed">
                  {c.explanation}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={() => dispatch({ type: "DISMISS_CONSEQUENCE" })}
          className="w-full bg-[#FF6B00] hover:bg-[#e06000] text-white text-sm"
          data-testid="button-dismiss-consequence"
        >
          Продолжить работу
        </Button>
      </div>
    </div>
  );
}
