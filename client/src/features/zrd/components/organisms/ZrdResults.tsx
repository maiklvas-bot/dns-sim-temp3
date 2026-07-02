import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Trophy, Minus, Frown, RotateCcw } from "lucide-react";
import { COMPETENCY_KEYS, COMPETENCY_LABEL, METRIC_KEYS } from "@shared/zrd/types";
import type { CompetencyKey } from "@shared/zrd/types";
import { METRIC_META } from "../../zrd-view";
import type { ZrdResultView } from "../../zrd-api";

const SHORT: Record<CompetencyKey, string> = {
  planning: "Планир.", goal_setting: "Цель", decision_making: "Решения", analytical: "Аналитика",
  flexibility: "Гибкость", communication: "Комм.", result_orientation: "Результат", team_motivation: "Команда",
  critical_thinking: "Критич.", initiative: "Инициат.", conflict_management: "Конфликты", strategic_vision: "Стратегия",
};

const WINNER: Record<string, { label: string; color: string; icon: typeof Trophy }> = {
  player: { label: "Победа игрока", color: "#2ec4b6", icon: Trophy },
  ai: { label: "Победа компьютера", color: "#e85a5a", icon: Frown },
  draw: { label: "Ничья", color: "#ffb703", icon: Minus },
};

export function ZrdResults({ result, onLeave }: { result: ZrdResultView; onLeave: () => void }) {
  const w = WINNER[result.winner] ?? WINNER.draw;
  const WIcon = w.icon;
  const data = COMPETENCY_KEYS.map((k) => ({ name: SHORT[k], full: COMPETENCY_LABEL[k], value: result.competencies[k] ?? 0 }));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="zrd-panel flex flex-wrap items-center gap-4 p-5">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${w.color}22`, color: w.color }}>
          <WIcon className="h-7 w-7" aria-hidden />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--zrd-text-dim)" }}>Итог партии{result.outcome.earlyWin ? " · досрочная победа" : ""}</div>
          <h2 className="text-2xl font-extrabold" style={{ color: w.color }}>{w.label}</h2>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-extrabold" style={{ color: "var(--zrd-text)" }}>{result.tr}</div>
            <div className="text-[11px] font-semibold" style={{ color: "var(--zrd-text-dim)" }}>ТР игрока</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold" style={{ color: "var(--zrd-text-dim)" }}>{result.aiTr}</div>
            <div className="text-[11px] font-semibold" style={{ color: "var(--zrd-text-dim)" }}>ТР компьютера</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="zrd-panel p-5">
          <h3 className="mb-3 text-sm font-bold" style={{ color: "var(--zrd-text)" }}>Показатели региона</h3>
          <div className="space-y-2">
            {METRIC_KEYS.map((k) => {
              const meta = METRIC_META[k];
              const Icon = meta.icon;
              return (
                <div key={k} className="flex items-center gap-2">
                  <span style={{ color: meta.color }}><Icon className="h-4 w-4" aria-hidden /></span>
                  <span className="text-sm" style={{ color: "var(--zrd-text)" }}>{meta.label}</span>
                  <div className="mx-2 h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(127,140,165,0.18)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(result.finalMetrics[k] / 20) * 100}%`, background: meta.color }} />
                  </div>
                  <span className="w-8 text-right text-sm font-bold tabular-nums" style={{ color: "var(--zrd-text)" }}>{result.finalMetrics[k]}</span>
                </div>
              );
            })}
          </div>
          <h3 className="mb-2 mt-5 text-sm font-bold" style={{ color: "var(--zrd-text)" }}>Компетенции (ФАКТ, 0–5)</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {COMPETENCY_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="truncate" style={{ color: "var(--zrd-text-dim)" }}>{COMPETENCY_LABEL[k]}</span>
                <span className="font-bold tabular-nums" style={{ color: result.competencies[k] >= 3.5 ? "#2ec4b6" : result.competencies[k] < 2 ? "#e85a5a" : "var(--zrd-text)" }}>
                  {(result.competencies[k] ?? 0).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="zrd-panel p-3">
          <h3 className="mb-1 px-2 pt-2 text-sm font-bold" style={{ color: "var(--zrd-text)" }}>Профиль компетенций</h3>
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <RadarChart data={data} outerRadius="72%">
                <PolarGrid stroke="rgba(127,140,165,0.35)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: "var(--zrd-text-dim)", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fill: "var(--zrd-text-dim)", fontSize: 9 }} axisLine={false} />
                <Radar dataKey="value" stroke="#FF6B00" fill="#FF6B00" fillOpacity={0.32} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button type="button" onClick={onLeave} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors" style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text)", cursor: "pointer" }}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Новая партия
        </button>
      </div>
    </div>
  );
}
