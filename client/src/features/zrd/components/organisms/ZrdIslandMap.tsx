/**
 * ЗРД — центральное поле: ОБЩАЯ КАРТА ДИВИЗИОНА 2×2 — четыре четверти-острова,
 * по одному на РРС, друг напротив друга. Каждая четверть: арт Canva + аффинная
 * гекс-решётка (ячейки Вороного) + маскот-фишка + подсветка освоения (охват).
 * СВОЯ четверть интерактивна: маскот ходит по одному шагу (как в HoMM), постройки
 * появляются из сыгранных карт. Чужие четверти — обзорные (их руки/сбросы скрыты,
 * позиция чужого маскота пока не синхронизируется — стоит в столице).
 * Арты: ekb — DAHOZGYlaCI, chel — DAHOaYejeXg; tmn/perm — временно те же до своих карт.
 */
import { useMemo, useState } from "react";
import { Store, Warehouse, Factory, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MascotId, RrsId, ZrdSeatView } from "@shared/zrd/match-types";
import { RRS_IDS, RRS_LABEL } from "@shared/zrd/match-types";
import { computeKpi } from "@shared/zrd/kpi";
import { MASCOT_VISUAL } from "../../zrd-mascots";
import islandQ1 from "@/assets/brand/zrd/map/island-q1.png";
import islandQ2 from "@/assets/brand/zrd/map/island-q2.png";

// ── геометрия: аффинная гекс-решётка, калибруется по каждому арту (2000×1126) ─
const VIEW_W = 2000;
const VIEW_H = 1126;

interface Axial { q: number; r: number }
interface Pt { x: number; y: number }
const cellKey = (c: Axial) => `${c.q},${c.r}`;

interface IslandConfig {
  art: string;
  origin: Pt;
  col: Pt;
  row: Pt;
  inBounds: (x: number, y: number) => boolean;
  exclude: Set<string>;
}

const Q1_CONFIG: IslandConfig = {
  // Екатеринбург: лесной остров с реками (столица — тайл с белым храмом)
  art: islandQ1,
  origin: { x: 800, y: 460 },
  col: { x: 181, y: 88 },
  row: { x: -181, y: 104 },
  inBounds: (x, y) =>
    x >= 210 && x <= 1850 && y >= 195 && y <= 905
    && !(x < 560 && y < 430) && !(x > 1560 && y < 340)
    && !(x > 1700 && y > 780) && !(x < 400 && y > 780),
  exclude: new Set(["1,-3", "3,-2", "4,-1"]),
};

const Q2_CONFIG: IslandConfig = {
  // Челябинск: промышленный мегаполис (столица — деловой центр)
  art: islandQ2,
  origin: { x: 930, y: 460 },
  col: { x: 181, y: 88 },
  row: { x: -181, y: 104 },
  inBounds: (x, y) =>
    x >= 110 && x <= 1930 && y >= 150 && y <= 1000
    && !(x < 420 && y < 320) && !(x > 1610 && y < 345)
    && !(x > 1660 && y > 850) && !(x < 340 && y > 830),
  exclude: new Set(["1,-3", "2,-3", "3,-2"]),
};

/** четверти 3–4 временно переиспользуют готовые арты (свои карты — когда появятся) */
const ISLAND_CONFIGS: Record<RrsId, IslandConfig> = {
  ekb: Q1_CONFIG,
  chel: Q2_CONFIG,
  tmn: Q1_CONFIG,
  perm: Q2_CONFIG,
};
const QUARTER_NO: Record<RrsId, number> = { ekb: 1, chel: 2, tmn: 3, perm: 4 };
const RRS_SHORT: Record<RrsId, string> = { ekb: "Екатеринбург", chel: "Челябинск", tmn: "Тюмень", perm: "Пермь" };

const center = (cfg: IslandConfig, c: Axial): Pt => ({
  x: cfg.origin.x + c.q * cfg.col.x + c.r * cfg.row.x,
  y: cfg.origin.y + c.q * cfg.col.y + c.r * cfg.row.y,
});

function hexCorners(cfg: IslandConfig): Pt[] {
  const a = cfg.col, b = cfg.row;
  const pts = [
    { x: (a.x + b.x) / 3, y: (a.y + b.y) / 3 },
    { x: (2 * b.x - a.x) / 3, y: (2 * b.y - a.y) / 3 },
    { x: (b.x - 2 * a.x) / 3, y: (b.y - 2 * a.y) / 3 },
  ];
  return [...pts, ...pts.map((p) => ({ x: -p.x, y: -p.y }))];
}
function hexPath(cfg: IslandConfig, corners: Pt[], c: Axial, inset = 1): string {
  const { x, y } = center(cfg, c);
  return corners.map((p, i) => `${i === 0 ? "M" : "L"}${(x + p.x * inset).toFixed(1)},${(y + p.y * inset).toFixed(1)}`).join(" ") + " Z";
}
const NEIGHBORS: Axial[] = [{ q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: -1, r: 1 }];
const isNeighbor = (a: Axial, b: Axial) => NEIGHBORS.some((d) => a.q + d.q === b.q && a.r + d.r === b.r);

function buildIsland(cfg: IslandConfig): Axial[] {
  const cells: Axial[] = [];
  for (let q = -7; q <= 7; q++) {
    for (let r = -7; r <= 7; r++) {
      const { x, y } = center(cfg, { q, r });
      if (!cfg.inBounds(x, y)) continue;
      if (cfg.exclude.has(`${q},${r}`)) continue;
      cells.push({ q, r });
    }
  }
  return cells;
}
const CAPITAL: Axial = { q: 0, r: 0 };

// ── постройки из сыгранных карт ─────────────────────────────────────────────
const BUILDING_BY_ANCHOR: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  pj_open_store: { icon: Store, label: "Магазин", color: "#FF6B00" },
  pj_pickup: { icon: Store, label: "Пункт выдачи", color: "#FF6B00" },
  pj_new_loc: { icon: Store, label: "Новая локация", color: "#FF6B00" },
  pj_warehouse: { icon: Warehouse, label: "Склад", color: "#b48cff" },
  lg_warehouse: { icon: Warehouse, label: "Склад", color: "#b48cff" },
  gd_storage: { icon: Warehouse, label: "Склад", color: "#b48cff" },
  gd_purchase: { icon: Factory, label: "Завод-поставщик", color: "#4ea8de" },
  gd_arrival: { icon: Factory, label: "Завод-поставщик", color: "#4ea8de" },
  lg_transport: { icon: Truck, label: "Машина", color: "#2ec4b6" },
  lg_delivery: { icon: Truck, label: "Машина", color: "#2ec4b6" },
  lg_supply: { icon: Truck, label: "Машина", color: "#2ec4b6" },
};
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── одна четверть ───────────────────────────────────────────────────────────
interface QuarterData {
  rrsId: RrsId;
  name: string;
  controllerKind: "human" | "ai" | "off";
  mascotId: MascotId | undefined;
  coveragePct: number;         // KPI «покрытие рынка» 0..100 → подсветка освоения
  discard?: string[];          // только своя четверть (постройки)
  isYou: boolean;
}

function IslandQuarter({ data, interactive }: { data: QuarterData; interactive: boolean }) {
  const cfg = ISLAND_CONFIGS[data.rrsId] ?? Q1_CONFIG;
  const corners = useMemo(() => hexCorners(cfg), [cfg]);
  const island = useMemo(() => buildIsland(cfg), [cfg]);
  const [mascot, setMascot] = useState<Axial>(CAPITAL);
  const off = data.controllerKind === "off";
  const figure = MASCOT_VISUAL[data.mascotId ?? "strateg"] ?? MASCOT_VISUAL.strateg;
  const clipId = `zrd-mclip-${data.rrsId}`;

  const litKeys = useMemo(() => {
    const byDist = [...island].sort((a, b) => {
      const da = Math.abs(a.q) + Math.abs(a.r) + Math.abs(a.q + a.r);
      const db = Math.abs(b.q) + Math.abs(b.r) + Math.abs(b.q + b.r);
      return da - db;
    });
    const n = Math.round((data.coveragePct / 100) * island.length);
    return new Set(byDist.slice(0, Math.max(off ? 0 : 1, n)).map(cellKey));
  }, [data.coveragePct, island, off]);

  const buildings = useMemo(() => {
    if (!data.discard) return [];
    const out: { cell: Axial; icon: LucideIcon; label: string; color: string }[] = [];
    const used = new Set<string>([cellKey(CAPITAL)]);
    for (const id of data.discard) {
      const anchor = Object.keys(BUILDING_BY_ANCHOR).find((a) => id.startsWith(a));
      if (!anchor) continue;
      const meta = BUILDING_BY_ANCHOR[anchor];
      const idx = hashStr(id) % island.length;
      for (let tries = 0; tries < island.length; tries++) {
        const cell = island[(idx + tries) % island.length];
        if (!used.has(cellKey(cell))) { used.add(cellKey(cell)); out.push({ cell, ...meta }); break; }
      }
    }
    return out;
  }, [data.discard, island]);

  const reachable = interactive ? island.filter((c) => isNeighbor(mascot, c)) : [];
  const mc = center(cfg, mascot);

  return (
    <div style={{ position: "relative", minWidth: 0, minHeight: 0, borderRadius: 10, overflow: "hidden", border: `1px solid ${data.isYou ? "rgba(255,107,0,0.55)" : "rgba(140,160,190,0.18)"}`, background: "#0d0f14", opacity: off ? 0.55 : 1 }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: off ? "grayscale(0.85)" : undefined }}
        role={interactive ? "application" : "img"}
        aria-label={interactive
          ? `Ваша территория ${RRS_LABEL[data.rrsId]}: клик по соседней клетке — шаг маскота`
          : `Территория ${RRS_LABEL[data.rrsId]} (${off ? "не задействована" : data.name})`}
      >
        <image href={cfg.art} x={0} y={0} width={VIEW_W} height={VIEW_H} preserveAspectRatio="xMidYMid meet" />

        {island.map((c) => {
          const key = cellKey(c);
          const lit = litKeys.has(key);
          const canStep = reachable.some((n) => cellKey(n) === key);
          return (
            <path
              key={key}
              d={hexPath(cfg, corners, c, 0.86)}
              fill={lit ? "rgba(255,196,90,0.16)" : "rgba(6,10,18,0.32)"}
              stroke={canStep ? "#FF6B00" : lit ? "rgba(255,196,90,0.55)" : "rgba(140,160,190,0.22)"}
              strokeWidth={canStep ? 6 : 2.5}
              strokeDasharray={canStep ? "16 12" : undefined}
              style={{ cursor: canStep ? "pointer" : "default", transition: "fill 300ms ease, stroke 200ms ease", outline: "none" }}
              onClick={() => { if (canStep) setMascot(c); }}
              tabIndex={canStep ? 0 : -1}
              onKeyDown={(e) => { if (canStep && (e.key === "Enter" || e.key === " ")) setMascot(c); }}
            >
              <title>{canStep ? "Шагнуть сюда (1 ход)" : lit ? "Освоено — показатели растут" : "Дикая клетка"}</title>
            </path>
          );
        })}

        {/* столица */}
        <path d={hexPath(cfg, corners, CAPITAL, 0.86)} fill="none" stroke="#ffd166" strokeWidth={5} pointerEvents="none" />

        {/* постройки (только своя четверть — чужие сбросы скрыты) */}
        {buildings.map((b, i) => {
          const p = center(cfg, b.cell);
          const Icon = b.icon;
          return (
            <g key={i} pointerEvents="none">
              <circle cx={p.x + 52} cy={p.y - 40} r={34} fill="rgba(10,14,24,0.85)" stroke={b.color} strokeWidth={4} />
              <foreignObject x={p.x + 52 - 20} y={p.y - 40 - 20} width={40} height={40}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: b.color }}>
                  <Icon size={30} aria-label={b.label} />
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* маскот-фишка (у чужих — в столице, позиция не синхронизируется) */}
        {!off && (
          <>
            <defs>
              <clipPath id={clipId}><circle cx={0} cy={-64} r={62} /></clipPath>
            </defs>
            <g style={{ transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)", transform: `translate(${mc.x}px, ${mc.y}px)` }} pointerEvents="none">
              <ellipse cx={0} cy={20} rx={48} ry={15} fill="rgba(0,0,0,0.5)" />
              <line x1={0} y1={14} x2={0} y2={-10} stroke={figure.accent} strokeWidth={6} />
              <image
                href={figure.img}
                x={-62} y={-126} width={124} height={124}
                clipPath={`url(#${clipId})`}
                preserveAspectRatio="xMidYMin slice"
              />
              <circle cx={0} cy={-64} r={62} fill="none" stroke={figure.accent} strokeWidth={5}
                style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.7))" }} />
            </g>
          </>
        )}
      </svg>

      {/* плашка четверти */}
      <div style={{ position: "absolute", left: 6, top: 5, display: "flex", alignItems: "center", gap: 6, borderRadius: 7, padding: "2px 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: data.isYou ? "#FF6B00" : "rgba(220,228,240,0.85)", background: "rgba(10,14,24,0.75)", border: `1px solid ${data.isYou ? "rgba(255,107,0,0.45)" : "rgba(140,160,190,0.25)"}` }}>
        {QUARTER_NO[data.rrsId]}/4 · {RRS_SHORT[data.rrsId]}{data.isYou ? " · вы" : ""} {off ? "· —" : `· ${Math.round(data.coveragePct)}%`}
      </div>
    </div>
  );
}

// ── общая карта дивизиона 2×2 ───────────────────────────────────────────────
export function ZrdIslandMap({ view }: { view: ZrdSeatView }) {
  // данные четвертей: своя — полная, чужие — из публичной сводки
  const quarters: QuarterData[] = RRS_IDS.map((rrsId) => {
    if (rrsId === view.you.rrsId) {
      return {
        rrsId,
        name: view.you.controller.kind === "human" ? view.you.controller.name : RRS_LABEL[rrsId],
        controllerKind: view.you.controller.kind,
        mascotId: view.you.mascotId,
        coveragePct: computeKpi(view.you).market_coverage,
        discard: view.you.discard,
        isYou: true,
      };
    }
    const other = view.others.find((o) => o.rrsId === rrsId);
    return {
      rrsId,
      name: other?.name ?? RRS_LABEL[rrsId],
      controllerKind: other?.controllerKind ?? "off",
      mascotId: other?.mascotId,
      coveragePct: other?.kpi.market_coverage ?? 0,
      isYou: false,
    };
  });

  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 6, padding: 6 }}>
      {quarters.map((q) => (
        <IslandQuarter key={q.rrsId} data={q} interactive={q.isYou} />
      ))}
    </div>
  );
}
