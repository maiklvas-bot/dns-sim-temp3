import { COMPETENCIES } from "../data/competencies";

interface CompetencyRadarProps {
  getAverage: (id: string) => number;
  size?: number;
  showExpectedLine?: boolean; // Показать пунктирную линию ожидаемого уровня (4.0)
}

/**
 * Радарная диаграмма компетенций с опциональной линией ожиданий
 *
 * Визуализирует профиль компетенций участника на полигональной сетке.
 * При showExpectedLine=true рисуется пунктирный полигон на уровне 4.0/5,
 * чтобы наглядно показать разрыв между фактическим результатом и ожидаемым.
 */
export default function CompetencyRadar({ getAverage, size = 320, showExpectedLine = false }: CompetencyRadarProps) {
  const center = size / 2;
  const maxRadius = size * 0.34;
  const labelRadius = size * 0.43;
  const levels = 5;
  const comps = COMPETENCIES;
  const n = comps.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const getPoint = (index: number, value: number) => {
    const angle = startAngle + angleStep * index;
    const r = (value / levels) * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const getLabelPoint = (index: number) => {
    const angle = startAngle + angleStep * index;
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
    };
  };

  // ─── Grid lines (уровни 1-5) ──────────────────────────────
  const gridLines = Array.from({ length: levels }, (_, level) => {
    const points = Array.from({ length: n }, (_, i) => {
      const p = getPoint(i, level + 1);
      return `${p.x},${p.y}`;
    }).join(" ");
    return points;
  });

  // ─── Data polygon (фактические значения) ───────────────────
  const dataValues = comps.map(c => getAverage(c.id));
  const dataPoints = dataValues.map((v, i) => {
    const p = getPoint(i, Math.min(v, 5));
    return `${p.x},${p.y}`;
  }).join(" ");

  // ─── Expected polygon (ожидаемый уровень 4.0) ─────────────
  const expectedLevel = 4.0;
  const expectedPoints = Array.from({ length: n }, (_, i) => {
    const p = getPoint(i, expectedLevel);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Сетка уровней */}
        {gridLines.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="#2a3a4e"
            strokeWidth={i === levels - 1 ? 1.5 : 0.5}
            opacity={0.6}
          />
        ))}

        {/* Осьевые линии */}
        {comps.map((_, i) => {
          const p = getPoint(i, levels);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke="#2a3a4e"
              strokeWidth={0.5}
              opacity={0.4}
            />
          );
        })}

        {/* Пунктирный полигон ожидаемого уровня (4.0) */}
        {showExpectedLine && (
          <>
            <polygon
              points={expectedPoints}
              fill="none"
              stroke="#64748B"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.8}
            />
            {/* Подпись "Expected" на первой оси */}
            {(() => {
              const p = getPoint(0, expectedLevel);
              return (
                <text
                  x={p.x + 8}
                  y={p.y - 6}
                  fill="#64748B"
                  fontSize={8}
                  fontWeight={600}
                  fontFamily="Inter, sans-serif"
                >
                  4.0
                </text>
              );
            })()}
          </>
        )}

        {/* Фактический результат — заливка */}
        <polygon
          points={dataPoints}
          fill="rgba(240, 78, 35, 0.12)"
          stroke="#F04E23"
          strokeWidth={2}
        />

        {/* Точки данных */}
        {dataValues.map((v, i) => {
          const p = getPoint(i, Math.min(v, 5));
          const color = v >= 4 ? "#00C853" : v >= 3 ? "#FFB300" : v >= 2 ? "#FF6B35" : "#FF1744";
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={5}
              fill={color}
              stroke="#0F1923"
              strokeWidth={2}
            />
          );
        })}

        {/* Метки с номерами компетенций */}
        {comps.map((c, i) => {
          const p = getLabelPoint(i);
          const v = getAverage(c.id);
          const color = v >= 4 ? "#00C853" : v >= 3 ? "#FFB300" : v >= 2 ? "#FF6B35" : v > 0 ? "#FF1744" : "#94A3B8";
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={12} fill="#0F1923" stroke={color} strokeWidth={1.5} />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#FFFFFF"
                fontSize={9}
                fontWeight={700}
                fontFamily="Inter, sans-serif"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Легенда компетенций с мини-барами */}
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {comps.map((competency, index) => {
          const value = getAverage(competency.id);
          const color = value >= 4 ? "#00C853" : value >= 3 ? "#FFB300" : value >= 2 ? "#FF6B35" : value > 0 ? "#FF1744" : "#94A3B8";
          const gradient = value >= 4
            ? 'linear-gradient(90deg, #00C853 0%, #00D4AA 100%)'
            : value >= 3
              ? 'linear-gradient(90deg, #2979FF 0%, #4A9EFF 100%)'
              : value >= 2
                ? 'linear-gradient(90deg, #FFB300 0%, #FF6B35 100%)'
                : value > 0
                  ? 'linear-gradient(90deg, #FF1744 0%, #FF6B35 100%)'
                  : '#334155';
          return (
            <div
              key={competency.id}
              className="flex items-start gap-2 rounded-lg border border-[#2a3a4e] bg-[#0F1923]/60 px-3 py-2"
            >
              {/* Номер компетенции */}
              <span
                className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ backgroundColor: color, color: '#0F1923' }}
              >
                {index + 1}
              </span>
              {/* Название + мини-бар */}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold leading-4 text-[#f3f7ff]">
                  {competency.name}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[#1a2435] relative overflow-hidden">
                  {/* Линия ожидания 4.0 */}
                  {showExpectedLine && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-[#64748B] z-10"
                      style={{ left: `${(4.0 / 5) * 100}%` }}
                    />
                  )}
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, (value / 5) * 100))}%`, background: gradient }}
                  />
                </div>
              </div>
              {/* Значение */}
              <span className="flex-shrink-0 text-[12px] font-bold tabular-nums" style={{ color }}>
                {value > 0 ? value.toFixed(1) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
