/**
 * ЗРД — центральное поле: ЕДИНАЯ КАРТА ДИВИЗИОНА (полотно Canva DAHOaVN_cpI, обновлённое):
 * 4 региона-блока разделены лесополосой и рекой; фон полотна вырезан (прозрачный).
 * На каждом блоке — своя аффинная гекс-решётка (ячейки Вороного): подсветка освоения (охват),
 * маскот-фигурка в полный рост (не выше гекса), постройки из сыгранных карт.
 * СВОЙ блок интерактивен: маскот ходит по одному шагу (клик по соседней клетке, как в HoMM).
 * Блоки: TL=Пермь (пригород), TR=Челябинск (даунтаун), BL=Екатеринбург (кварталы), TN=BR=Тюмень.
 */
import { useMemo, useState } from "react";
import { Store, Warehouse, Factory, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MascotId, RrsId, ZrdSeatView } from "@shared/zrd/match-types";
import { RRS_IDS, RRS_LABEL } from "@shared/zrd/match-types";
import { computeKpi } from "@shared/zrd/kpi";
import { MASCOT_VISUAL } from "../../zrd-mascots";
import districtArt from "@/assets/brand/zrd/map/district-full.png";

// ── полотно ─────────────────────────────────────────────────────────────────
const ART_W = 2400;
const ART_H = 2400;
/** видимая область полотна (bbox контента + небольшие поля) */
const VIEW = { x: 600, y: 380, w: 1800, h: 1330 };

interface Axial { q: number; r: number }
interface Pt { x: number; y: number }
const cellKey = (c: Axial) => `${c.q},${c.r}`;

/** решётка одного блока: столица (0,0) + базис + точный набор клеток (силуэт острова).
 *  Силуэт откалиброван программно (сэмплинг альфа-канала district-full.png в центре каждой
 *  клетки + отсев соседних дивайдеров — реки/лесополосы) и выверен визуально по гекс-сетке;
 *  это НЕ прямоугольник — контур острова фигурный, прямоугольная граница даёт клетки на воде/фоне. */
interface BlockConfig {
  origin: Pt;
  col: Pt;
  row: Pt;
  include: Set<string>;
}

const cellsOf = (list: [number, number][]): Set<string> => new Set(list.map(([q, r]) => `${q},${r}`));

/** калибровка по координатной сетке полотна */
const BLOCKS: Record<RrsId, BlockConfig> = {
  // TL — Пермь: пригород (аэропорт, ферма, очистные; столица — городок с площадью)
  perm: {
    origin: { x: 1030, y: 705 },
    col: { x: 77.5, y: 106 },
    row: { x: -77.5, y: 106 },
    include: cellsOf([
      [-2, 0], [-2, 1], [-2, 2], [-2, 3], [-1, -1], [-1, 0], [-1, 1], [-1, 2], [-1, 3],
      [0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [1, -2], [1, -1], [1, 0], [1, 1],
      [2, -3], [2, -2], [2, -1], [2, 0], [3, -2], [3, -1],
    ]),
  },
  // TR — Челябинск: даунтаун у воды (столица — небоскрёбный центр)
  chel: {
    origin: { x: 1920, y: 695 },
    col: { x: 77.5, y: 105 },
    row: { x: -77.5, y: 105 },
    include: cellsOf([
      [-3, 2], [-2, 0], [-2, 1], [-2, 2], [-1, -1], [-1, 0], [-1, 1], [-1, 2],
      [0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [1, -2], [1, -1], [1, 0], [1, 1],
      [2, -3], [2, -2], [2, -1], [2, 0],
    ]),
  },
  // BL — Екатеринбург: крупные кварталы (столица — синие высотки, 2-й ряд)
  ekb: {
    origin: { x: 1000, y: 1290 },
    col: { x: 77.5, y: 105 },
    row: { x: -77.5, y: 105 },
    include: cellsOf([
      [-2, 1], [-2, 2], [-1, 0], [-1, 1], [-1, 2], [0, -1], [0, 0], [0, 1], [0, 2],
      [1, -2], [1, -1], [1, 0], [1, 1], [2, -3], [2, -2], [2, -1], [2, 0], [3, -2], [3, -1],
    ]),
  },
  // BR — Тюмень: горы, ветряки, карьер (столица — городские высотки)
  tmn: {
    origin: { x: 1965, y: 1360 },
    col: { x: 77.5, y: 106 },
    row: { x: -77.5, y: 106 },
    include: cellsOf([
      [-3, 1], [-2, 1], [-2, 2], [-2, 3], [-1, -1], [-1, 0], [-1, 1], [-1, 2], [-1, 3],
      [0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [1, -2], [1, -1], [1, 0], [1, 1],
      [2, -3], [2, -2], [2, -1], [2, 0],
    ]),
  },
};

const center = (b: BlockConfig, c: Axial): Pt => ({
  x: b.origin.x + c.q * b.col.x + c.r * b.row.x,
  y: b.origin.y + c.q * b.col.y + c.r * b.row.y,
});

/** вершины ячейки Вороного треугольной решётки с базисом (col,row) — тесселируются точно */
function hexCorners(b: BlockConfig): Pt[] {
  const a = b.col, d = b.row;
  const pts = [
    { x: (a.x + d.x) / 3, y: (a.y + d.y) / 3 },
    { x: (2 * d.x - a.x) / 3, y: (2 * d.y - a.y) / 3 },
    { x: (d.x - 2 * a.x) / 3, y: (d.y - 2 * a.y) / 3 },
  ];
  return [...pts, ...pts.map((p) => ({ x: -p.x, y: -p.y }))];
}
function hexPath(b: BlockConfig, corners: Pt[], c: Axial, inset = 1): string {
  const { x, y } = center(b, c);
  return corners.map((p, i) => `${i === 0 ? "M" : "L"}${(x + p.x * inset).toFixed(1)},${(y + p.y * inset).toFixed(1)}`).join(" ") + " Z";
}
const NEIGHBORS: Axial[] = [{ q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: -1, r: 1 }];
const isNeighbor = (a: Axial, b: Axial) => NEIGHBORS.some((d) => a.q + d.q === b.q && a.r + d.r === b.r);

function buildBlockCells(b: BlockConfig): Axial[] {
  return Array.from(b.include, (key) => {
    const [q, r] = key.split(",").map(Number);
    return { q, r };
  });
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

// ── данные блока ────────────────────────────────────────────────────────────
interface BlockData {
  rrsId: RrsId;
  name: string;
  controllerKind: "human" | "ai" | "off";
  mascotId: MascotId | undefined;
  coveragePct: number;
  discard?: string[];
  isYou: boolean;
}

/** один регион на полотне: решётка + маскот + постройки (рисуется внутрь общего svg) */
function DistrictBlock({ data, interactive }: { data: BlockData; interactive: boolean }) {
  const b = BLOCKS[data.rrsId];
  const corners = useMemo(() => hexCorners(b), [b]);
  const cells = useMemo(() => buildBlockCells(b), [b]);
  const [mascot, setMascot] = useState<Axial>(CAPITAL);
  const off = data.controllerKind === "off";
  const figure = MASCOT_VISUAL[data.mascotId ?? "strateg"] ?? MASCOT_VISUAL.strateg;

  const litKeys = useMemo(() => {
    const byDist = [...cells].sort((a, c) => {
      const da = Math.abs(a.q) + Math.abs(a.r) + Math.abs(a.q + a.r);
      const db = Math.abs(c.q) + Math.abs(c.r) + Math.abs(c.q + c.r);
      return da - db;
    });
    const n = Math.round((data.coveragePct / 100) * cells.length);
    return new Set(byDist.slice(0, Math.max(off ? 0 : 1, n)).map(cellKey));
  }, [data.coveragePct, cells, off]);

  const buildings = useMemo(() => {
    if (!data.discard) return [];
    const out: { cell: Axial; icon: LucideIcon; label: string; color: string }[] = [];
    const used = new Set<string>([cellKey(CAPITAL)]);
    for (const id of data.discard) {
      const anchor = Object.keys(BUILDING_BY_ANCHOR).find((a) => id.startsWith(a));
      if (!anchor) continue;
      const meta = BUILDING_BY_ANCHOR[anchor];
      const idx = hashStr(id) % cells.length;
      for (let tries = 0; tries < cells.length; tries++) {
        const cell = cells[(idx + tries) % cells.length];
        if (!used.has(cellKey(cell))) { used.add(cellKey(cell)); out.push({ cell, ...meta }); break; }
      }
    }
    return out;
  }, [data.discard, cells]);

  const reachable = interactive && !off ? cells.filter((c) => isNeighbor(mascot, c)) : [];
  const mc = center(b, mascot);
  const hexW = Math.abs(b.col.x - b.row.x); // ширина гекса блока
  const FH = hexW * 0.95;                    // фигурка — в пределах одного гекса
  const FW = FH * 0.62;
  const cap = center(b, CAPITAL);
  // плашка — на 1 гекс выше самой верхней клетки силуэта (не над жёстким rect'ом, которого больше нет)
  const topCellY = Math.min(...cells.map((c) => center(b, c).y));
  const labelY = topCellY - Math.abs(b.col.y) * 0.9 - 14;

  return (
    <g style={{ opacity: off ? 0.55 : 1, filter: off ? "grayscale(0.85)" : undefined }}>
      {cells.map((c) => {
        const key = cellKey(c);
        const lit = litKeys.has(key);
        const canStep = reachable.some((n) => cellKey(n) === key);
        return (
          <path
            key={key}
            d={hexPath(b, corners, c, 0.85)}
            fill={lit ? "rgba(255,196,90,0.16)" : "rgba(6,10,18,0.30)"}
            stroke={canStep ? "#FF6B00" : lit ? "rgba(255,196,90,0.6)" : "rgba(120,140,170,0.25)"}
            strokeWidth={canStep ? 3.5 : 1.4}
            strokeDasharray={canStep ? "9 7" : undefined}
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
      <path d={hexPath(b, corners, CAPITAL, 0.85)} fill="none" stroke="#ffd166" strokeWidth={3} pointerEvents="none" />

      {/* постройки из сыгранных карт (только свой блок) */}
      {buildings.map((bl, i) => {
        const p = center(b, bl.cell);
        const Icon = bl.icon;
        return (
          <g key={i} pointerEvents="none">
            <circle cx={p.x + 26} cy={p.y - 22} r={17} fill="rgba(10,14,24,0.85)" stroke={bl.color} strokeWidth={2.5} />
            <foreignObject x={p.x + 26 - 10} y={p.y - 22 - 10} width={20} height={20}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: bl.color }}>
                <Icon size={15} aria-label={bl.label} />
              </div>
            </foreignObject>
          </g>
        );
      })}

      {/* маскот — фигурка в полный рост (у чужих — в столице; позиция чужих не синхронизируется) */}
      {!off && (
        <g style={{ transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)", transform: `translate(${mc.x}px, ${mc.y}px)` }} pointerEvents="none">
          <ellipse cx={0} cy={6} rx={FW * 0.55} ry={FH * 0.07} fill="rgba(0,0,0,0.55)" />
          <ellipse cx={0} cy={6} rx={FW * 0.58} ry={FH * 0.085} fill="none" stroke={figure.accent} strokeWidth={2.5} opacity={0.9} />
          <ellipse cx={0} cy={-FH * 0.38} rx={FW * 0.28} ry={FH * 0.38} fill="rgba(12,14,18,0.6)" />
          <image
            href={figure.figure}
            x={-FW / 2} y={-FH + 4} width={FW} height={FH}
            preserveAspectRatio="xMidYMax meet"
            style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.65))" }}
          />
        </g>
      )}

      {/* плашка региона над блоком */}
      <g pointerEvents="none">
        <rect x={cap.x - 150} y={labelY - 22} width={300} height={30} rx={8}
          fill="rgba(10,14,24,0.78)" stroke={data.isYou ? "rgba(255,107,0,0.6)" : "rgba(140,160,190,0.3)"} strokeWidth={1.5} />
        <text x={cap.x} y={labelY} textAnchor="middle"
          fontSize={17} fontWeight={800} letterSpacing={1}
          fill={data.isYou ? "#FF6B00" : "rgba(224,232,244,0.92)"}>
          {RRS_LABEL[data.rrsId].toUpperCase()}{data.isYou ? " · ВЫ" : ""} {off ? "· —" : `· ${Math.round(data.coveragePct)}%`}
        </text>
      </g>
    </g>
  );
}

// ── единая карта дивизиона ──────────────────────────────────────────────────
export function ZrdIslandMap({ view }: { view: ZrdSeatView }) {
  const blocks: BlockData[] = RRS_IDS.map((rrsId) => {
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
    <div style={{ position: "absolute", inset: 0, background: "#0b0d12" }}>
      <svg
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        role="application"
        aria-label={`Карта дивизиона: 4 региона; ваш — ${RRS_LABEL[view.you.rrsId]}, клик по соседней клетке — шаг маскота`}
      >
        <image href={districtArt} x={0} y={0} width={ART_W} height={ART_H} preserveAspectRatio="xMidYMid meet" />
        {blocks.map((bd) => (
          <DistrictBlock key={bd.rrsId} data={bd} interactive={bd.isYou} />
        ))}
      </svg>
    </div>
  );
}
