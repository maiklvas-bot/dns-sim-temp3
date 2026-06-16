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
        {rows.map((row) => (
          <div key={row.name} className="rounded-lg border border-[#1f3045] bg-[#0d1522]/80 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-3"><div className="min-w-0 text-[12px] font-semibold leading-4 text-[#f3f7ff]">{row.name}</div><div className="text-[10px] uppercase tracking-[0.14em] text-[#71839d]">{row.shortName}</div></div>
            <div className="space-y-1.5">
              {series.map((item) => {
                const value = Math.max(0, Math.min(5, Number(row[item.key] || 0)));
                return <div key={item.key} className="grid grid-cols-[64px,1fr,32px] items-center gap-2"><div className="truncate text-[10px] text-[#93a7c3]">{item.label}</div><div className="h-2.5 overflow-hidden rounded-full bg-[#1b2638]"><div className="h-full rounded-full" style={{ width: `${(value / 5) * 100}%`, backgroundColor: item.color }} /></div><div className="text-right text-[11px] font-semibold tabular-nums text-[#e9f1ff]">{value > 0 ? value.toFixed(1) : "—"}</div></div>;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
