/**
 * ЗРД — центральное поле, четверть 1 из 4: остров своей РРС (арт Canva DAHOZGYlaCI).
 * Поверх арта — аффинная гекс-решётка (ячейки Вороного тесселируются при любом наклоне):
 * по клеткам ХОДИТ маскот (по одному шагу, как в HoMM — клик по соседней клетке);
 * клетки СВЕТЛЕЮТ, когда показатели растут (охват), и умеют темнеть при захвате;
 * ПОСТРОЙКИ (магазины/склады/заводы/машины) появляются из сыгранных карт-проектов.
 */
import { useMemo, useState } from "react";
import { Store, Warehouse, Factory, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ZrdSeatView } from "@shared/zrd/match-types";
import { RRS_LABEL } from "@shared/zrd/match-types";
import { computeKpi } from "@shared/zrd/kpi";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import islandArt from "@/assets/brand/zrd/map/island-q1.png";

// ── геометрия: аффинная гекс-решётка, подогнанная под арт (2000×1126) ───────
// Арт — flat-top гексы в изометрии. Базис измерен по координатной сетке:
// COL — сосед «вправо-вниз», ROW — сосед «влево-вниз»; COL+ROW — сосед строго вниз.
const VIEW_W = 2000;
const VIEW_H = 1126;
/** центр клетки (0,0) — «столица» острова (тайл с белым храмом) */
const ORIGIN = { x: 800, y: 460 };
const COL = { x: 181, y: 88 };
const ROW = { x: -181, y: 104 };

interface Axial { q: number; r: number }
const cellKey = (c: Axial) => `${c.q},${c.r}`;
const center = (c: Axial) => ({ x: ORIGIN.x + c.q * COL.x + c.r * ROW.x, y: ORIGIN.y + c.q * COL.y + c.r * ROW.y });

/** вершины ячейки Вороного треугольной решётки с базисом (COL, ROW) — тесселируются точно */
function hexCorners(): { x: number; y: number }[] {
  const a = COL, b = ROW;
  const pts = [
    { x: (a.x + b.x) / 3, y: (a.y + b.y) / 3 },
    { x: (2 * b.x - a.x) / 3, y: (2 * b.y - a.y) / 3 },
    { x: (b.x - 2 * a.x) / 3, y: (b.y - 2 * a.y) / 3 },
  ];
  return [...pts, ...pts.map((p) => ({ x: -p.x, y: -p.y }))];
}
const CORNERS = hexCorners();
function hexPath(c: Axial, inset = 1): string {
  const { x, y } = center(c);
  return CORNERS.map((p, i) => `${i === 0 ? "M" : "L"}${(x + p.x * inset).toFixed(1)},${(y + p.y * inset).toFixed(1)}`).join(" ") + " Z";
}
const NEIGHBORS: Axial[] = [{ q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: -1, r: 1 }];
const isNeighbor = (a: Axial, b: Axial) => NEIGHBORS.some((d) => a.q + d.q === b.q && a.r + d.r === b.r);

/** остров: клетки решётки, чьи центры попадают в силуэт арта (углы фона отрезаны) */
const EXCLUDE = new Set<string>(["1,-3", "3,-2", "4,-1"]);
function buildIsland(): Axial[] {
  const cells: Axial[] = [];
  for (let q = -6; q <= 6; q++) {
    for (let r = -6; r <= 6; r++) {
      const { x, y } = center({ q, r });
      if (x < 210 || x > 1850 || y < 195 || y > 905) continue;      // рамка арта
      if (x < 560 && y < 430) continue;                             // пустой угол сверху-слева
      if (x > 1560 && y < 340) continue;                            // пустой угол сверху-справа
      if (x > 1700 && y > 780) continue;                            // пустой угол снизу-справа
      if (x < 400 && y > 780) continue;                             // пустой угол снизу-слева
      if (EXCLUDE.has(`${q},${r}`)) continue;
      cells.push({ q, r });
    }
  }
  return cells;
}
const ISLAND: Axial[] = buildIsland();
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
  const [mascot, setMascot] = useState<Axial>(CAPITAL);
  const kpi = computeKpi(view.you);

  // клетки, «поднятые» ростом показателей: доля охвата → сколько клеток сияет (от столицы наружу)
  const litKeys = useMemo(() => {
    const byDist = [...ISLAND].sort((a, b) => {
      const da = Math.abs(a.q - CAPITAL.q) + Math.abs(a.r - CAPITAL.r) + Math.abs((a.q + a.r) - (CAPITAL.q + CAPITAL.r));
      const db = Math.abs(b.q - CAPITAL.q) + Math.abs(b.r - CAPITAL.r) + Math.abs((b.q + b.r) - (CAPITAL.q + CAPITAL.r));
      return da - db;
    });
    const n = Math.round((kpi.market_coverage / 100) * ISLAND.length);
    return new Set(byDist.slice(0, Math.max(1, n)).map(cellKey));
  }, [kpi.market_coverage]);

  // постройки: сыгранные карты → значок на детерминированной клетке острова
  const buildings = useMemo(() => {
    const out: { cell: Axial; icon: LucideIcon; label: string; color: string }[] = [];
    const used = new Set<string>([cellKey(CAPITAL)]);
    for (const id of view.you.discard) {
      const anchor = Object.keys(BUILDING_BY_ANCHOR).find((a) => id.startsWith(a));
      if (!anchor) continue;
      const meta = BUILDING_BY_ANCHOR[anchor];
      let idx = hashStr(id) % ISLAND.length;
      for (let tries = 0; tries < ISLAND.length; tries++) {
        const cell = ISLAND[(idx + tries) % ISLAND.length];
        if (!used.has(cellKey(cell))) { used.add(cellKey(cell)); out.push({ cell, ...meta }); break; }
      }
    }
    return out;
  }, [view.you.discard]);

  const reachable = ISLAND.filter((c) => isNeighbor(mascot, c));
  const mc = center(mascot);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0 }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        role="application"
        aria-label={`Карта территории ${RRS_LABEL[view.you.rrsId]}: маскот ходит по клеткам, клик по соседней клетке — шаг`}
      >
        <image href={islandArt} x={0} y={0} width={VIEW_W} height={VIEW_H} preserveAspectRatio="xMidYMid meet" />

        {/* клетки: подсветка роста, затемнение захвата, ход маскота */}
        {ISLAND.map((c) => {
          const key = cellKey(c);
          const lit = litKeys.has(key);
          const canStep = reachable.some((n) => cellKey(n) === key);
          const isMascotHere = cellKey(mascot) === key;
          return (
            <path
              key={key}
              d={hexPath(c, 0.92)}
              fill={lit ? "rgba(255,196,90,0.16)" : "rgba(6,10,18,0.30)"}
              stroke={canStep ? "#FF6B00" : lit ? "rgba(255,196,90,0.55)" : "rgba(140,160,190,0.25)"}
              strokeWidth={canStep ? 5 : 2}
              strokeDasharray={canStep ? "14 10" : undefined}
              style={{ cursor: canStep ? "pointer" : "default", transition: "fill 300ms ease, stroke 200ms ease" }}
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
        <path d={hexPath(CAPITAL, 0.92)} fill="none" stroke="#ffd166" strokeWidth={5} pointerEvents="none" />

        {/* постройки из сыгранных карт */}
        {buildings.map((b, i) => {
          const p = center(b.cell);
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

        {/* маскот — фигурка игрока, плавный шаг */}
        <g style={{ transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)", transform: `translate(${mc.x}px, ${mc.y}px)` }} pointerEvents="none">
          <ellipse cx={0} cy={34} rx={44} ry={14} fill="rgba(0,0,0,0.45)" />
          <image href={BRAND_ASSETS.heroes.alienPoint} x={-55} y={-118} width={110} height={148} style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))" }} />
        </g>
      </svg>

      {/* подпись четверти */}
      <div style={{ position: "absolute", left: 10, top: 8, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FF6B00", background: "rgba(10,14,24,0.7)", border: "1px solid rgba(255,107,0,0.35)" }}>
        {RRS_LABEL[view.you.rrsId]} · четверть 1/4 · освоено {Math.round(kpi.market_coverage)}%
      </div>
    </div>
  );
}
