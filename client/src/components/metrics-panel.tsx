import { useSimulation, getActiveTimerSnapshots } from "../context/SimulationContext";
import { Users, Receipt, TrendingUp, Star, Timer, Warehouse, Heart, DollarSign, AlertTriangle } from "lucide-react";
import { formatDuration } from "@/lib/simulation-timing";

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  barPct?: number;
}

function MetricRow({ icon, label, value, subValue, color, barPct }: MetricRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center" style={{ color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-[#bfd0e7] truncate">{label}</span>
          <span className="text-sm font-semibold tabular-nums ml-1" style={{ color }}>
            {value}
          </span>
        </div>
        {barPct !== undefined && (
          <div className="w-full h-1 rounded-full bg-[#1a1a2e] mt-0.5">
            <div
              className="h-full rounded-full metric-bar"
              style={{ width: `${Math.min(barPct, 100)}%`, backgroundColor: color }}
            />
          </div>
        )}
        {subValue && (
          <div className="text-[11px] text-[#8ea4c2] mt-0.5">{subValue}</div>
        )}
      </div>
    </div>
  );
}

function MoraleDots({ value }: { value: number }) {
  const dots = Math.round(value);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-colors duration-300"
          style={{
            backgroundColor: i < dots
              ? (dots >= 7 ? "#00d4aa" : dots >= 4 ? "#ffc107" : "#ff4444")
              : "#1a1a2e",
          }}
        />
      ))}
    </div>
  );
}

function formatRevenue(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} млн ₽`;
  }

  return `${value}K₽`;
}

function formatClientRating(value: number) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function MetricsPanel() {
  const { state } = useSimulation();
  const m = state.metrics;
  const criticalTimers = getActiveTimerSnapshots(state).slice(0, 3);
  const clientRatingPct = ((m.nps - 1) / 4) * 100;
  const storePulse = Math.round((m.conversion + m.teamMorale * 10 + Math.max(0, 100 - m.pickupSpeed * 3) + clientRatingPct) / 4);

  const convColor = m.conversion >= 55 ? "#00d4aa" : m.conversion >= 40 ? "#ffc107" : "#ff4444";
  const npsColor = m.nps >= 4.2 ? "#00d4aa" : m.nps >= 3.4 ? "#ffc107" : m.nps >= 2.6 ? "#ff9f43" : "#ff4444";
  const speedColor = m.pickupSpeed <= 10 ? "#00d4aa" : m.pickupSpeed <= 18 ? "#ffc107" : m.pickupSpeed <= 28 ? "#ff9f43" : "#ff4444";
  const whColor = m.warehouseLoad <= 55 ? "#00d4aa" : m.warehouseLoad <= 72 ? "#ffc107" : m.warehouseLoad <= 86 ? "#ff9f43" : "#ff4444";
  const moraleColor = m.teamMorale >= 7 ? "#00d4aa" : m.teamMorale >= 4 ? "#ffc107" : "#ff4444";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 rounded-2xl border border-[#2a3a4e] bg-[linear-gradient(180deg,rgba(20,28,43,0.82),rgba(11,18,28,0.9))] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#FF6B00]">Метрики магазина</div>
            <div className="mt-1 text-[12px] text-[#a8bbd6]">Живой срез смены по клиентам, людям и операционке</div>
          </div>
          <div className="flex min-w-[102px] flex-col items-center justify-center rounded-2xl border border-[#2d4563] bg-[#101826] px-3 py-2 text-center">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#8ea4c2]">Пульс смены</div>
            <div className="text-lg font-bold text-white tabular-nums">{storePulse}%</div>
          </div>
        </div>
      </div>
      <div className="space-y-0.5">
        <MetricRow
          icon={<Users className="w-3.5 h-3.5" />}
          label="Покупатели в зале"
          value={`${m.customersInStore}`}
          color="#a0a0b8"
          barPct={(m.customersInStore / 60) * 100}
        />
        <MetricRow
          icon={<Receipt className="w-3.5 h-3.5" />}
          label="Средний чек"
          value={`${m.avgCheck.toLocaleString("ru-RU")}₽`}
          color="#a0a0b8"
        />
        <MetricRow
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Конверсия"
          value={`${m.conversion}%`}
          color={convColor}
          barPct={m.conversion}
        />
        <MetricRow
          icon={<Star className="w-3.5 h-3.5" />}
          label="Клиентская оценка"
          value={formatClientRating(m.nps)}
          color={npsColor}
          barPct={clientRatingPct}
        />
        <MetricRow
          icon={<Timer className="w-3.5 h-3.5" />}
          label="Скорость выдачи"
          value={`${m.pickupSpeed} мин`}
          color={speedColor}
          barPct={((45 - m.pickupSpeed) / 40) * 100}
        />
        <MetricRow
          icon={<Warehouse className="w-3.5 h-3.5" />}
          label="Загрузка склада"
          value={`${m.warehouseLoad}%`}
          color={whColor}
          barPct={m.warehouseLoad}
        />
        <div className="flex items-center gap-2 py-1.5">
          <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center" style={{ color: moraleColor }}>
            <Heart className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[12px] text-[#bfd0e7]">Настроение команды</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: moraleColor }}>
                {m.teamMorale.toFixed(1)}
              </span>
            </div>
            <MoraleDots value={m.teamMorale} />
          </div>
        </div>
        <MetricRow
          icon={<DollarSign className="w-3.5 h-3.5" />}
          label="Выручка за день"
          value={formatRevenue(m.dailyRevenue)}
          color={m.dailyRevenue >= 2200 ? "#00d4aa" : m.dailyRevenue >= 1500 ? "#ffc107" : "#ff4444"}
          barPct={(m.dailyRevenue / 3500) * 100}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-[#d7a5a5]/18 bg-[linear-gradient(180deg,rgba(215,165,165,0.1),rgba(20,28,43,0.68))] p-3">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[#ffd4d4]">
          <AlertTriangle className="h-3.5 w-3.5" />
          Критичные таймеры
        </div>
        {criticalTimers.length === 0 ? (
          <div className="rounded-2xl border border-[#2a3a4e] bg-[#101826]/70 px-3 py-4 text-center text-[12px] text-[#c8d7eb]">
            Сейчас в сводке нет активных таймеров. Правая панель покажет их сразу после появления.
          </div>
        ) : (
          <div className="space-y-2">
            {criticalTimers.map((timer) => {
              const overdue = state.elapsedSeconds > timer.dueAtElapsed;
              const remaining = overdue
                ? `+${formatDuration(state.elapsedSeconds - timer.dueAtElapsed)}`
                : formatDuration(timer.dueAtElapsed - state.elapsedSeconds);

              return (
                <div key={timer.id} className="rounded-lg border border-[#d7a5a5]/30 bg-[linear-gradient(180deg,rgba(215,165,165,0.12),rgba(15,23,36,0.82))] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-white">{timer.title}</div>
                      <div className="truncate text-[11px] text-[#b7c8df]">{timer.taskType} • {timer.zoneLabel}</div>
                    </div>
                    <div className={`font-mono text-[12px] ${overdue ? "text-[#ffd7d7]" : "text-[#f4d5d5]"}`}>
                      {remaining}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
