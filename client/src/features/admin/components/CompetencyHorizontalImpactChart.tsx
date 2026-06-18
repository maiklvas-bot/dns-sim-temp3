import { useState } from "react";

export type CompetencyImpactDatum = {
  name: string;
  shortName: string;
  aggregate?: number;
  selected?: number;
  value?: number;
};

export type CompetencyImpactSeries = {
  key: "aggregate" | "selected" | "value";
  label: string;
  color: string;
};

export function CompetencyHorizontalImpactChart({ data, series, emptyText = "Пока нет настроенного влияния на компетенции." }: {
  data: CompetencyImpactDatum[];
  series: CompetencyImpactSeries[];
  emptyText?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const visibleRows = data.filter((row) => series.some((item) => Number(row[item.key] || 0) > 0));
  const rows = visibleRows.length > 0 ? visibleRows : data;
  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-[#31455f] bg-[#101826]/70 px-4 py-6 text-center text-sm text-[#8aa2c4]">{emptyText}</div>;
  }
  return (
    <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {series.map((item) => <div key={item.key} className="flex items-center gap-2 text-[11px] font-medium text-[#cbd8ef]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</div>)}
        <div className="ml-auto text-[10px] uppercase tracking-[0.16em] text-[#6f829e]">Шкала 0–5</div>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const isActive = hover === row.name;
          // дельта между двумя сериями (если их две) — для подсказки при наведении
          const delta = series.length >= 2
            ? Number(row[series[1].key] || 0) - Number(row[series[0].key] || 0)
            : null;
          return (
            <div
              key={row.name}
              onMouseEnter={() => setHover(row.name)}
              onMouseLeave={() => setHover((prev) => (prev === row.name ? null : prev))}
              className={`rounded-lg border px-3 py-2 transition-colors ${isActive ? "border-[#FF6B00] bg-[#16233a]/80" : "border-[#1f3045] bg-[#0d1522]/80"}`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0 text-[12px] font-semibold leading-4 text-[#f3f7ff]">{row.name}</div>
                {isActive && delta !== null ? (
                  <div
                    className="flex-none rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{
                      color: delta > 0 ? "#00d4aa" : delta < 0 ? "#ff6b6b" : "#9aabc6",
                      background: delta > 0 ? "rgba(0,212,170,0.14)" : delta < 0 ? "rgba(255,68,68,0.14)" : "rgba(154,171,198,0.12)",
                    }}
                    title={`${series[1].label} − ${series[0].label}`}
                  >
                    Δ {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                  </div>
                ) : (
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#71839d]">{row.shortName}</div>
                )}
              </div>
              <div className="space-y-1.5">
                {series.map((item) => {
                  const value = Math.max(0, Math.min(5, Number(row[item.key] || 0)));
                  return <div key={item.key} className="grid grid-cols-[64px,1fr,32px] items-center gap-2"><div className="truncate text-[10px] text-[#93a7c3]">{item.label}</div><div className="h-2.5 overflow-hidden rounded-full bg-[#1b2638]"><div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${(value / 5) * 100}%`, backgroundColor: item.color, boxShadow: isActive ? `0 0 0 1px ${item.color}66` : "none" }} /></div><div className="text-right text-[11px] font-semibold tabular-nums text-[#e9f1ff]">{value > 0 ? value.toFixed(1) : "—"}</div></div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
