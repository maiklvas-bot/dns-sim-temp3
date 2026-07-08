/**
 * ЗРД — центральное поле: ЕДИНАЯ КАРТА ДИВИЗИОНА (полотно Canva DAHOaVN_cpI, обновлённое):
 * 4 региона-блока разделены лесополосой и рекой; фон полотна вырезан (прозрачный).
 * На каждом блоке — своя аффинная гекс-решётка (ячейки Вороного): подсветка освоения (охват),
 * маскот-фигурка в полный рост (не выше гекса), постройки из сыгранных карт.
 * СВОЙ блок интерактивен: маскот ходит по одному шагу (клик по соседней клетке, как в HoMM).
 * Блоки: TL=Пермь (пригород), TR=Челябинск (даунтаун), BL=Екатеринбург (кварталы), TN=BR=Тюмень.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Store, Warehouse, Factory, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MascotId, RrsId, ZrdSeatView } from "@shared/zrd/match-types";
import { RRS_LABEL } from "@shared/zrd/match-types";
import { computeKpi } from "@shared/zrd/kpi";
import { MASCOT_VISUAL } from "../../zrd-mascots";
import districtArt from "@/assets/brand/zrd/map/district-full.png";

// ── полотно ─────────────────────────────────────────────────────────────────
const ART_W = 2400;
const ART_H = 2400;
/** видимая область полотна (bbox контента + небольшие поля) */
const VIEW = { x: 430, y: 380, w: 1970, h: 1330 };

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

/** калибровка по координатной сетке полотна: 4 квадранта-острова.
 *  Классические РРС живут на «домашних» островах; областные (ЧБО2/СВО1) занимают
 *  квадранты РРС, отсутствующих в составе матча. */
const QUADRANT_OF_CLASSIC: Partial<Record<RrsId, keyof typeof BLOCKS>> = { perm: "perm", chel: "chel", ekb: "ekb", tmn: "tmn" };
const BLOCKS = {
  // TL — Пермь: фермерский край (карта 3; столица — рынок с фонтаном)
  perm: {
    origin: { x: 963, y: 642.5 },
    col: { x: 57.5, y: 83.3 },
    row: { x: -57.5, y: 83.3 },
    include: cellsOf([
      [-4, 2], [-4, 3], [-4, 4], [-3, 1], [-3, 2], [-3, 3], [-3, 4], [-2, 0], [-2, 1], [-2, 2],
      [-2, 3], [-2, 4], [-1, -1], [-1, 0], [-1, 1], [-1, 2], [-1, 3], [0, -2], [0, -1], [0, 0],
      [0, 1], [0, 2], [1, -3], [1, -2], [1, -1], [1, 0], [1, 1], [2, -3], [2, -2], [2, -1],
      [2, 0], [3, -4], [3, -3], [3, -2], [3, -1], [4, -3], [4, -2],
    ]),
  },
  // TR — Челябинск: пустынный город (карта 2; столица — арена)
  chel: {
    origin: { x: 1972.2, y: 639.8 },
    col: { x: 43.93, y: 65.64 },
    row: { x: -43.93, y: 65.64 },
    include: cellsOf([
      [-4, 2], [-4, 3], [-4, 4], [-3, 1], [-3, 2], [-3, 3], [-3, 4], [-3, 5], [-2, 0], [-2, 1],
      [-2, 2], [-2, 3], [-2, 4], [-1, -1], [-1, 0], [-1, 1], [-1, 2], [-1, 3], [0, -2], [0, -1],
      [0, 0], [0, 1], [0, 2], [1, -3], [1, -2], [1, -1], [1, 0], [1, 1], [2, -4], [2, -3],
      [2, -2], [2, -1], [2, 0], [3, -4], [3, -3], [3, -2], [3, -1], [4, -4], [4, -3], [4, -2], [5, -3],
    ]),
  },
  // BL — Екатеринбург: мегаполис (карта 1; столица — парк с фонтаном)
  ekb: {
    origin: { x: 938, y: 1364.4 },
    col: { x: 55.36, y: 76.84 },
    row: { x: -55.36, y: 76.84 },
    include: cellsOf([
      [-4, 2], [-4, 3], [-4, 4], [-3, 1], [-3, 2], [-3, 3], [-3, 4], [-3, 5], [-2, 0], [-2, 1],
      [-2, 2], [-2, 3], [-2, 4], [-2, 5], [-1, -1], [-1, 0], [-1, 1], [-1, 2], [-1, 3], [-1, 4],
      [0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [0, 3], [1, -3], [1, -2], [1, -1], [1, 0],
      [1, 1], [1, 2], [2, -4], [2, -3], [2, -2], [2, -1], [2, 0], [2, 1], [3, -4], [3, -3],
      [3, -2], [3, -1], [3, 0], [4, -4], [4, -3], [4, -2], [4, -1], [5, -3],
    ]),
  },
  // BR — Тюмень: лесной край (карта 4; столица — лагерь у озера)
  tmn: {
    origin: { x: 1974.8, y: 1364.3 },
    col: { x: 49.46, y: 69.14 },
    row: { x: -49.46, y: 69.14 },
    include: cellsOf([
      [-4, 2], [-4, 3], [-4, 4], [-3, 1], [-3, 2], [-3, 3], [-3, 4], [-3, 5], [-2, 0], [-2, 1],
      [-2, 2], [-2, 3], [-2, 4], [-2, 5], [-1, -1], [-1, 0], [-1, 1], [-1, 2], [-1, 3], [-1, 4],
      [0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [0, 3], [1, -3], [1, -2], [1, -1], [1, 0],
      [1, 1], [1, 2], [2, -4], [2, -3], [2, -2], [2, -1], [2, 0], [2, 1], [3, -4], [3, -3],
      [3, -2], [3, -1], [3, 0], [4, -3], [4, -2], [4, -1],
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
  /** квадрант-остров полотна (классические РРС — домашние, областные — свободные) */
  quadrant: keyof typeof BLOCKS;
  name: string;
  controllerKind: "human" | "ai" | "off";
  mascotId: MascotId | undefined;
  coveragePct: number;
  discard?: string[];
  isYou: boolean;
  /** счётчик активности места: растёт с каждым действием → маскот сам делает шаг (HoMM-стиль) */
  activity: number;
}

/** один регион на полотне: решётка + маскот + постройки (рисуется внутрь общего svg) */
function DistrictBlock({ data, interactive }: { data: BlockData; interactive: boolean }) {
  const b = BLOCKS[data.quadrant];
  const corners = useMemo(() => hexCorners(b), [b]);
  const cells = useMemo(() => buildBlockCells(b), [b]);
  const [mascot, setMascot] = useState<Axial>(CAPITAL);
  const off = data.controllerKind === "off";
  const figure = MASCOT_VISUAL[data.mascotId ?? "strateg"] ?? MASCOT_VISUAL.strateg;

  // ── авто-ход маскота (HoMM-стиль): каждое действие места двигает фигурку на клетку сама,
  //    без кликов пользователя; работает и для ИИ-мест (по их публичному счётчику активности)
  const visitedRef = useRef<Set<string>>(new Set([cellKey(CAPITAL)]));
  const prevActivity = useRef(data.activity);
  const stepTimers = useRef<number[]>([]);
  const [stepFx, setStepFx] = useState<{ key: number; cell: Axial } | null>(null);
  useEffect(() => () => { stepTimers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const autoStep = () => {
    setMascot((m) => {
      const nbs = cells.filter((c) => isNeighbor(m, c));
      if (nbs.length === 0) return m;
      const fresh = nbs.filter((c) => !visitedRef.current.has(cellKey(c)));
      const pool = fresh.length > 0 ? fresh : nbs;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      visitedRef.current.add(cellKey(pick));
      setStepFx({ key: Date.now() + Math.random(), cell: pick });
      return pick;
    });
  };

  useEffect(() => {
    const delta = data.activity - prevActivity.current;
    prevActivity.current = data.activity;
    if (off || delta <= 0) return;
    // несколько действий между поллингами → серия шагов с паузой (виден сам ход, как в HoMM)
    const steps = Math.min(delta, 3);
    for (let i = 0; i < steps; i++) {
      stepTimers.current.push(window.setTimeout(autoStep, i * 480));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.activity, off]);

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
            onClick={() => { if (canStep) { visitedRef.current.add(key); setMascot(c); } }}
            tabIndex={canStep ? 0 : -1}
            onKeyDown={(e) => { if (canStep && (e.key === "Enter" || e.key === " ")) { visitedRef.current.add(key); setMascot(c); } }}
          >
            <title>{canStep ? "Шагнуть сюда (1 ход)" : lit ? "Освоено — показатели растут" : "Дикая клетка"}</title>
          </path>
        );
      })}

      {/* столица */}
      <path d={hexPath(b, corners, CAPITAL, 0.85)} fill="none" stroke="#ffd166" strokeWidth={3} pointerEvents="none" />

      {/* эффект шага: расходящееся кольцо на клетке, куда пришёл маскот */}
      {stepFx && !off && (() => {
        const p = center(b, stepFx.cell);
        return <circle key={stepFx.key} cx={p.x} cy={p.y} r={22} className="zrd-step-fx" style={{ stroke: figure.accent }} pointerEvents="none" />;
      })()}

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
  // 4 места матча (вы + соперники) в порядке seatIdx; состав РРС задаёт оценщик
  const seatsAll = [
    {
      seatIdx: view.seatIdx,
      rrsId: view.you.rrsId,
      name: view.you.controller.kind === "human" ? view.you.controller.name : RRS_LABEL[view.you.rrsId],
      controllerKind: view.you.controller.kind,
      mascotId: view.you.mascotId,
      coveragePct: computeKpi(view.you).market_coverage,
      discard: view.you.discard,
      isYou: true,
      // каждое действие (карта/стандарт) и пас двигают фигурку сами
      activity: view.you.actionsTotal + (view.you.passed ? 1 : 0),
    },
    ...view.others.map((other) => ({
      seatIdx: other.seatIdx,
      rrsId: other.rrsId,
      name: other.name ?? RRS_LABEL[other.rrsId],
      controllerKind: other.controllerKind,
      mascotId: other.mascotId,
      coveragePct: other.kpi.market_coverage ?? 0,
      discard: undefined as string[] | undefined,
      isYou: false,
      // у чужих мест виден сброс и факт паса — этого достаточно, чтобы их маскоты «жили»
      activity: (other.discardCount ?? 0) + (other.passed ? 1 : 0),
    })),
  ].sort((a, z) => a.seatIdx - z.seatIdx);

  // квадранты: классические РРС — на домашних островах; областные (ЧБО2/СВО1) — на свободных
  const quadTaken = new Set<keyof typeof BLOCKS>();
  const assigned = new Map<number, keyof typeof BLOCKS>();
  for (const s of seatsAll) {
    const home = QUADRANT_OF_CLASSIC[s.rrsId];
    if (home && !quadTaken.has(home)) { assigned.set(s.seatIdx, home); quadTaken.add(home); }
  }
  const freeQuads = (Object.keys(BLOCKS) as (keyof typeof BLOCKS)[]).filter((q) => !quadTaken.has(q));
  for (const s of seatsAll) {
    if (!assigned.has(s.seatIdx)) assigned.set(s.seatIdx, freeQuads.shift() ?? "perm");
  }

  const blocks: BlockData[] = seatsAll.map((s) => ({
    rrsId: s.rrsId,
    quadrant: assigned.get(s.seatIdx) ?? "perm",
    name: s.name,
    controllerKind: s.controllerKind,
    mascotId: s.mascotId,
    coveragePct: s.coveragePct,
    discard: s.discard,
    isYou: s.isYou,
    activity: s.activity,
  }));

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
