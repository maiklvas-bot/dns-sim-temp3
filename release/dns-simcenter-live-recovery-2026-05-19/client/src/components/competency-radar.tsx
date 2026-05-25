import { COMPETENCIES } from "../data/competencies";

interface CompetencyRadarProps {
  getAverage: (id: string) => number;
  size?: number;
}

export default function CompetencyRadar({ getAverage, size = 320 }: CompetencyRadarProps) {
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

  // Grid lines
  const gridLines = Array.from({ length: levels }, (_, level) => {
    const points = Array.from({ length: n }, (_, i) => {
      const p = getPoint(i, level + 1);
      return `${p.x},${p.y}`;
    }).join(" ");
    return points;
  });

  // Data polygon
  const dataValues = comps.map(c => getAverage(c.id));
  const dataPoints = dataValues.map((v, i) => {
    const p = getPoint(i, Math.min(v, 5));
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid */}
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

        {/* Axis lines */}
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

        {/* Data area */}
        <polygon
          points={dataPoints}
          fill="rgba(255, 107, 0, 0.15)"
          stroke="#FF6B00"
          strokeWidth={2}
        />

        {/* Data dots */}
        {dataValues.map((v, i) => {
          const p = getPoint(i, Math.min(v, 5));
          const color = v >= 4 ? "#00d4aa" : v >= 3 ? "#ffc107" : v >= 2 ? "#FF6B00" : "#ff4444";
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={color}
              stroke="#1a1a2e"
              strokeWidth={2}
            />
          );
        })}

        {/* Labels */}
        {comps.map((c, i) => {
          const p = getLabelPoint(i);
          const v = getAverage(c.id);
          const color = v >= 4 ? "#00d4aa" : v >= 3 ? "#ffc107" : v >= 2 ? "#FF6B00" : v > 0 ? "#ff6b6b" : "#9fb4cf";
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={10} fill="#101826" stroke={color} strokeWidth={1.4} />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#eef6ff"
                fontSize={9}
                fontWeight={800}
                fontFamily="Inter, sans-serif"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {comps.map((competency, index) => {
          const value = getAverage(competency.id);
          const color = value >= 4 ? "#00d4aa" : value >= 3 ? "#ffc107" : value >= 2 ? "#FF6B00" : value > 0 ? "#ff6b6b" : "#9fb4cf";
          return (
            <div
              key={competency.id}
              className="flex items-start gap-2 rounded-lg border border-[#31455f] bg-[#101826]/78 px-3 py-2"
            >
              <span
                className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#0d1117]"
                style={{ backgroundColor: color }}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold leading-4 text-[#f3f7ff]">
                  {competency.name}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[#1a2435]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, (value / 5) * 100))}%`, backgroundColor: color }}
                  />
                </div>
              </div>
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
