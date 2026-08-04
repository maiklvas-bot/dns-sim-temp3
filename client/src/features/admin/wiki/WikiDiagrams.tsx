/**
 * Схемы справочника. Рисуются в интерфейсе, а не вставляются картинками:
 * так они переживают правки методологии и меняются вместе с темой.
 */

const ACCENT = "var(--dns-orange-hex)";
const INFO = "#4a9eff";
const OK = "#54d28c";
const DANGER = "#ff9999";

function Frame({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div className="dns-wiki-diagram overflow-hidden rounded-xl border border-[#243244] bg-[#0d1522]/70 p-3">
      <svg width="100%" height={height} viewBox={`0 0 640 ${height}`} preserveAspectRatio="xMidYMid meet">
        {children}
      </svg>
    </div>
  );
}

function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
  color = INFO,
  dashed,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  color?: string;
  dashed?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill="var(--roadmap-dim-fill)"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <text x={x + w / 2} y={y + (sub ? 22 : h / 2 + 4)} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--roadmap-dim-text)">
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + 38} textAnchor="middle" fontSize={10} fill="var(--roadmap-dim-text)" opacity={0.75}>
          {sub}
        </text>
      )}
    </g>
  );
}

function Arrow({ from, to, y, label }: { from: number; to: number; y: number; label?: string }) {
  return (
    <g>
      <line x1={from} y1={y} x2={to - 7} y2={y} stroke={ACCENT} strokeWidth={1.6} />
      <path d={`M ${to} ${y} L ${to - 8} ${y - 4} L ${to - 8} ${y + 4} z`} fill={ACCENT} />
      {label && (
        <text x={(from + to) / 2} y={y - 8} textAnchor="middle" fontSize={9.5} fill={ACCENT}>
          {label}
        </text>
      )}
    </g>
  );
}

/** Разрыв между знанием и практикой. */
function GapDiagram() {
  return (
    <Frame height={150}>
      <Node x={20} y={45} w={150} h={56} title="Курс пройден" sub="человек знает как правильно" color={INFO} />
      <Node x={245} y={45} w={150} h={56} title="Разрыв" sub="решение под давлением" color={ACCENT} dashed />
      <Node x={470} y={45} w={150} h={56} title="Смена" sub="что он сделает на самом деле" color={OK} />
      <Arrow from={170} to={245} y={73} />
      <Arrow from={395} to={470} y={73} />
      <text x={320} y={128} textAnchor="middle" fontSize={10.5} fill="var(--roadmap-dim-text)">
        Тест проверяет левую часть. Симуляция — среднюю.
      </text>
    </Frame>
  );
}

/** Путь от ответа участника к профилю. */
function ScoringDiagram() {
  const steps = [
    { title: "Разметка кейса", sub: "какие компетенции смотрим" },
    { title: "Уровень варианта", sub: "слабо / средне / сильно" },
    { title: "Выбор участника", sub: "уровень уходит в профиль" },
    { title: "Профиль", sub: "где силён, где проседает" },
  ];
  return (
    <Frame height={150}>
      {steps.map((step, index) => (
        <g key={step.title}>
          <Node
            x={12 + index * 158}
            y={40}
            w={140}
            h={58}
            title={step.title}
            sub={step.sub}
            color={index === 3 ? OK : INFO}
          />
          {index < steps.length - 1 && <Arrow from={152 + index * 158} to={170 + index * 158} y={69} />}
        </g>
      ))}
      <text x={320} y={126} textAnchor="middle" fontSize={10.5} fill="var(--roadmap-dim-text)">
        Вес кейса решает, насколько сильно он двигает итог. Первичные компетенции весят больше.
      </text>
    </Frame>
  );
}

/** Анатомия кейса: симптом, причина, что между ними. */
function CaseAnatomyDiagram() {
  return (
    <Frame height={215}>
      <Node x={20} y={20} w={165} h={52} title="Сигнал" sub="то, что видно снаружи" color={ACCENT} />
      <Node x={20} y={140} w={165} h={52} title="Скрытая причина" sub="участник её не видит" color={OK} dashed />
      <line x1={102} y1={72} x2={102} y2={140} stroke={ACCENT} strokeWidth={1.4} strokeDasharray="4 4" />
      <text x={112} y={110} fontSize={10} fill="var(--roadmap-dim-text)">
        нужно найти
      </text>

      <Node x={245} y={20} w={165} h={52} title="Данные" sub="запрос стоит времени" color={INFO} />
      <Node x={245} y={90} w={165} h={52} title="Ложные следы" sub="правдоподобно, но неверно" color={DANGER} />
      <Node x={245} y={160} w={165} h={48} title="Варианты ответа" color={INFO} />

      <Arrow from={185} to={245} y={46} />
      <Arrow from={185} to={245} y={116} />
      <Arrow from={185} to={245} y={184} />

      <Node x={465} y={90} w={155} h={52} title="Следующий шаг" sub="или финал кейса" color={OK} />
      <Arrow from={410} to={465} y={116} label="переход" />
    </Frame>
  );
}

/** Откуда взялись веса. */
function WeightsOriginDiagram() {
  return (
    <Frame height={165}>
      <Node x={16} y={30} w={140} h={58} title="Опрос 1" sub="43 ответа" color={INFO} />
      <Node x={16} y={96} w={140} h={44} title="Опрос 2" sub="19 ответов" color={INFO} />
      <Node x={230} y={55} w={165} h={58} title="Якоря поведения" sub="что считать сильным" color={ACCENT} />
      <Node x={460} y={55} w={160} h={58} title="Веса компетенций" sub="устойчивы при пересчёте" color={OK} />
      <Arrow from={156} to={230} y={62} />
      <Arrow from={156} to={230} y={112} />
      <Arrow from={395} to={460} y={84} />
      <text x={320} y={148} textAnchor="middle" fontSize={10.5} fill="var(--roadmap-dim-text)">
        Веса выведены из суждений руководителей, а не назначены разработчиком.
      </text>
    </Frame>
  );
}

/** Риски механики и проверки против них. */
function RisksDiagram() {
  const rows = [
    { risk: "Правильная кнопка", guard: "Антигейминг" },
    { risk: "Угадывание по форме", guard: "Разброс длины" },
    { risk: "Кейс без расследования", guard: "Диагностика" },
    { risk: "Декоративный выбор", guard: "Реальность эффектов" },
  ];
  return (
    <Frame height={205}>
      {rows.map((row, index) => {
        const y = 16 + index * 46;
        return (
          <g key={row.risk}>
            <rect x={16} y={y} width={250} height={34} rx={7} fill="rgba(255,153,153,0.10)" stroke={DANGER} strokeWidth={1.2} />
            <text x={30} y={y + 21} fontSize={11.5} fontWeight={600} fill="var(--roadmap-dim-text)">
              {row.risk}
            </text>
            <Arrow from={266} to={330} y={y + 17} />
            <rect x={330} y={y} width={230} height={34} rx={7} fill="rgba(84,210,140,0.10)" stroke={OK} strokeWidth={1.2} />
            <text x={344} y={y + 21} fontSize={11.5} fontWeight={600} fill="var(--roadmap-dim-text)">
              {row.guard}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

const DIAGRAMS = {
  gap: GapDiagram,
  scoring: ScoringDiagram,
  "case-anatomy": CaseAnatomyDiagram,
  "weights-origin": WeightsOriginDiagram,
  risks: RisksDiagram,
} as const;

export type WikiDiagramId = keyof typeof DIAGRAMS;

export function WikiDiagram({ id }: { id: WikiDiagramId }) {
  const Component = DIAGRAMS[id];
  return Component ? <Component /> : null;
}
