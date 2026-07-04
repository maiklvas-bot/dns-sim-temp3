/**
 * ЗРД — центральное поле: остров своей РРС (арты Canva, по одному на территорию).
 * Поверх арта — аффинная гекс-решётка (ячейки Вороного тесселируются при любом наклоне):
 * по клеткам ХОДИТ маскот (по одному шагу, как в HoMM — клик по соседней клетке);
 * клетки СВЕТЛЕЮТ, когда показатели растут (охват), и умеют темнеть при захвате;
 * ПОСТРОЙКИ (магазины/склады/заводы/машины) появляются из сыгранных карт-проектов.
 * Готовы четверти: ekb (DAHOZGYlaCI), chel (DAHOaYejeXg); tmn/perm — временно чужой арт.
 */
import { useMemo, useState } from "react";
import { Store, Warehouse, Factory, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RrsId, ZrdSeatView } from "@shared/zrd/match-types";
import { RRS_LABEL } from "@shared/zrd/match-types";
import { computeKpi } from "@shared/zrd/kpi";
import { MASCOT_VISUAL } from "../../zrd-mascots";
import islandQ1 from "@/assets/brand/zrd/map/island-q1.png";
import islandQ2 from "@/assets/brand/zrd/map/island-q2.png";

// ── геометрия: аффинная гекс-решётка, калибруется по каждому арту (2000×1126) ─
// Арты — flat-top гексы в изометрии. Базис измерен по координатной сетке:
// col — сосед «вправо-вниз», row — сосед «влево-вниз»; col+row — сосед строго вниз.
const VIEW_W = 2000;
const VIEW_H = 1126;

interface Axial { q: number; r: number }
interface Pt { x: number; y: number }
const cellKey = (c: Axial) => `${c.q},${c.r}`;

/** конфиг острова: арт + калибровка решётки + силуэт */
interface IslandConfig {
  art: string;
  /** центр клетки (0,0) — «столица» острова */
  origin: Pt;
  col: Pt;
  row: Pt;
  /** центр клетки внутри силуэта арта? (рамка + отрезанные пустые углы) */
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
  // Челябинск: промышленный мегаполис (столица — деловой центр с небоскрёбами)
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

/** четверти 3–4 временно переиспользуют готовые арты (свои карты — следующими итерациями) */
const ISLAND_CONFIGS: Record<RrsId, IslandConfig> = {
  ekb: Q1_CONFIG,
  chel: Q2_CONFIG,
  tmn: Q1_CONFIG,
  perm: Q2_CONFIG,
};
/** номер четверти общей карты дивизиона */
const QUARTER_NO: Record<RrsId, number> = { ekb: 1, chel: 2, tmn: 3, perm: 4 };

const center = (cfg: IslandConfig, c: Axial): Pt => ({
  x: cfg.origin.x + c.q * cfg.col.x + c.r * cfg.row.x,
  y: cfg.origin.y + c.q * cfg.col.y + c.r * cfg.row.y,
});

/** вершины ячейки Вороного треугольной решётки с базисом (col, row) — тесселируются точно */
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

/** остров: клетки решётки, чьи центры попадают в силуэт арта */
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

export function ZrdIslandMap({ view }: { view: ZrdSeatView }) {
  const cfg = ISLAND_CONFIGS[view.you.rrsId] ?? Q1_CONFIG;
  const corners = useMemo(() => hexCorners(cfg), [cfg]);
  const island = useMemo(() => buildIsland(cfg), [cfg]);
  const [mascot, setMascot] = useState<Axial>(CAPITAL);
  const kpi = computeKpi(view.you);
  // матчи до появления маскотов не несут mascotId — фигурка по умолчанию
  const figure = MASCOT_VISUAL[view.you.mascotId] ?? MASCOT_VISUAL.strateg;

  // клетки, «поднятые» ростом показателей: доля охвата → сколько клеток сияет (от столицы наружу)
  const litKeys = useMemo(() => {
    const byDist = [...island].sort((a, b) => {
      const da = Math.abs(a.q - CAPITAL.q) + Math.abs(a.r - CAPITAL.r) + Math.abs((a.q + a.r) - (CAPITAL.q + CAPITAL.r));
      const db = Math.abs(b.q - CAPITAL.q) + Math.abs(b.r - CAPITAL.r) + Math.abs((b.q + b.r) - (CAPITAL.q + CAPITAL.r));
      return da - db;
    });
    const n = Math.round((kpi.market_coverage / 100) * island.length);
    return new Set(byDist.slice(0, Math.max(1, n)).map(cellKey));
  }, [kpi.market_coverage, island]);

  // постройки: сыгранные карты → значок на детерминированной клетке острова
  const buildings = useMemo(() => {
    const out: { cell: Axial; icon: LucideIcon; label: string; color: string }[] = [];
    const used = new Set<string>([cellKey(CAPITAL)]);
    for (const id of view.you.discard) {
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
  }, [view.you.discard, island]);

  const reachable = island.filter((c) => isNeighbor(mascot, c));
  const mc = center(cfg, mascot);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0 }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        role="application"
        aria-label={`Карта территории ${RRS_LABEL[view.you.rrsId]}: маскот ходит по клеткам, клик по соседней клетке — шаг`}
      >
        <image href={cfg.art} x={0} y={0} width={VIEW_W} height={VIEW_H} preserveAspectRatio="xMidYMid meet" />

        {/* клетки: подсветка роста, затемнение захвата, ход маскота */}
        {island.map((c) => {
          const key = cellKey(c);
          const lit = litKeys.has(key);
          const canStep = reachable.some((n) => cellKey(n) === key);
          const isMascotHere = cellKey(mascot) === key;
          return (
            <path
              key={key}
              d={hexPath(cfg, corners, c, 0.86)}
              fill={lit ? "rgba(255,196,90,0.16)" : "rgba(6,10,18,0.30)"}
              stroke={canStep ? "#FF6B00" : lit ? "rgba(255,196,90,0.55)" : "rgba(140,160,190,0.25)"}
              strokeWidth={canStep ? 5 : 2}
              strokeDasharray={canStep ? "14 10" : undefined}
              style={{ cursor: canStep ? "pointer" : "default", transition: "fill 300ms ease, stroke 200ms ease", outline: "none" }}
              onClick={() => { if (canStep) setMascot(c); }}
              tabIndex={canStep ? 0 : -1}
              onKeyDown={(e) => { if (canStep && (e.key === "Enter" || e.key === " ")) setMascot(c); }}
              aria-label={canStep ? "Соседняя клетка — шагнуть сюда" : isMascotHere ? "Клетка маскота" : lit ? "Освоенная клетка" : "Клетка территории"}
            >
              <title>{isMascotHere ? "Ваш управленец здесь" : canStep ? "Шагнуть сюда (1 ход, как в HoMM)" : lit ? "Территория освоена — показатели растут" : "Дикая клетка — сюда ещё не дотянулись"}</title>
            </path>
          );
        })}

        {/* столица */}
        <path d={hexPath(cfg, corners, CAPITAL, 0.86)} fill="none" stroke="#ffd166" strokeWidth={5} pointerEvents="none" />

        {/* постройки из сыгранных карт */}
        {buildings.map((b, i) => {
          const p = center(cfg, b.cell);
          const Icon = b.icon;
          return (
            <g key={i} pointerEvents="none">
              <circle cx={p.x + 52} cy={p.y - 40} r={30} fill="rgba(10,14,24,0.85)" stroke={b.color} strokeWidth={3} />
              <foreignObject x={p.x + 52 - 17} y={p.y - 40 - 17} width={34} height={34}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: b.color }}>
                  <Icon size={26} aria-label={b.label} />
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* маскот — круглая фишка выбранной фигурки, плавный шаг */}
        <defs>
          <clipPath id="zrd-mascot-clip"><circle cx={0} cy={-52} r={48} /></clipPath>
        </defs>
        <g style={{ transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)", transform: `translate(${mc.x}px, ${mc.y}px)` }} pointerEvents="none">
          <ellipse cx={0} cy={18} rx={40} ry={13} fill="rgba(0,0,0,0.5)" />
          <line x1={0} y1={12} x2={0} y2={-8} stroke={figure.accent} strokeWidth={5} />
          <image
            href={figure.img}
            x={-48} y={-100} width={96} height={96}
            clipPath="url(#zrd-mascot-clip)"
            preserveAspectRatio="xMidYMin slice"
          />
          <circle cx={0} cy={-52} r={48} fill="none" stroke={figure.accent} strokeWidth={4}
            style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.7))" }} />
        </g>
      </svg>

      {/* подпись четверти */}
      <div style={{ position: "absolute", left: 10, top: 8, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FF6B00", background: "rgba(10,14,24,0.7)", border: "1px solid rgba(255,107,0,0.35)" }}>
        {RRS_LABEL[view.you.rrsId]} · четверть {QUARTER_NO[view.you.rrsId]}/4 · освоено {Math.round(kpi.market_coverage)}%
      </div>
    </div>
  );
}
