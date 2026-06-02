import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Package,
  ShoppingCart,
  Star,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useSimulation, type ZoneHealth } from "../context/SimulationContext";

type TacticalZone = {
  key: string;
  area: string;
  title: string;
  detail: string;
  unitLabel: string;
  primaryValue: string;
  percentage: number;
  health: ZoneHealth;
  Icon: LucideIcon;
  historyKey: keyof MetricSnapshots;
  inverseTrend?: boolean;
};

type MetricSnapshots = {
  conversion: number;
  nps: number;
  warehouseLoad: number;
  pickupSpeed: number;
  teamMorale: number;
  stockReserve: number;
  dailyRevenue: number;
};

const MAX_HISTORY_POINTS = 12;

const HEALTH_STYLES: Record<
  ZoneHealth,
  { accent: string; surface: string; text: string; glow: string; badge: string }
> = {
  green: {
    accent: "#54d28c",
    surface: "linear-gradient(180deg, rgba(84,210,140,0.14), rgba(10,18,28,0.92))",
    text: "#e6fff0",
    glow: "0 0 26px rgba(84,210,140,0.18)",
    badge: "Штатно",
  },
  yellow: {
    accent: "#f0c46b",
    surface: "linear-gradient(180deg, rgba(240,196,107,0.16), rgba(10,18,28,0.92))",
    text: "#fff3d7",
    glow: "0 0 26px rgba(240,196,107,0.17)",
    badge: "Внимание",
  },
  orange: {
    accent: "#ff9b53",
    surface: "linear-gradient(180deg, rgba(255,155,83,0.17), rgba(10,18,28,0.92))",
    text: "#ffe6d1",
    glow: "0 0 26px rgba(255,155,83,0.18)",
    badge: "Внимание",
  },
  red: {
    accent: "#d79f9f",
    surface: "linear-gradient(180deg, rgba(215,159,159,0.2), rgba(10,18,28,0.92))",
    text: "#fff0f0",
    glow: "0 0 26px rgba(215,159,159,0.18)",
    badge: "Риск",
  },
};

function resolveFinanceHealth(revenue: number): ZoneHealth {
  if (revenue >= 2200) return "green";
  if (revenue >= 1500) return "yellow";
  if (revenue >= 1000) return "orange";
  return "red";
}

function resolveMoraleHealth(morale: number): ZoneHealth {
  if (morale >= 7) return "green";
  if (morale >= 5) return "yellow";
  if (morale >= 3) return "orange";
  return "red";
}

function resolveClientRatingHealth(rating: number): ZoneHealth {
  if (rating >= 4.2) return "green";
  if (rating >= 3.4) return "yellow";
  if (rating >= 2.6) return "orange";
  return "red";
}

function resolveInventoryHealth(load: number): ZoneHealth {
  if (load <= 55) return "green";
  if (load <= 72) return "yellow";
  if (load <= 86) return "orange";
  return "red";
}

function resolveConversionHealth(conversion: number): ZoneHealth {
  if (conversion >= 55) return "green";
  if (conversion >= 43) return "yellow";
  if (conversion >= 32) return "orange";
  return "red";
}

function resolvePickupHealth(speedMinutes: number): ZoneHealth {
  if (speedMinutes <= 9) return "green";
  if (speedMinutes <= 13) return "yellow";
  if (speedMinutes <= 17) return "orange";
  return "red";
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

function formatStatusLabel(label: string, health: ZoneHealth) {
  if (health === "red") {
    return `${label} — риск`;
  }

  if (health === "orange") {
    return `${label} — напряжение`;
  }

  if (health === "yellow") {
    return `${label} — внимание`;
  }

  return `${label} — штатно`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildSnapshots(metrics: ReturnType<typeof useSimulation>["state"]["metrics"]): MetricSnapshots {
  return {
    conversion: metrics.conversion,
    nps: metrics.nps,
    warehouseLoad: metrics.warehouseLoad,
    pickupSpeed: metrics.pickupSpeed,
    teamMorale: metrics.teamMorale,
    stockReserve: Math.max(0, 100 - metrics.warehouseLoad),
    dailyRevenue: metrics.dailyRevenue,
  };
}

function buildSparklinePath(values: number[], inverseTrend = false) {
  const safeValues = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const width = 82;
  const height = 26;
  const points = safeValues.map((value, index) => {
    const x = (index / Math.max(1, safeValues.length - 1)) * width;
    const normalized = (value - min) / range;
    const y = inverseTrend ? normalized * height : height - normalized * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M ${points.join(" L ")}`;
}

export default function StoreMap() {
  const { state } = useSimulation();
  const currentSnapshots = useMemo(() => buildSnapshots(state.metrics), [state.metrics]);
  const [selectedZoneKey, setSelectedZoneKey] = useState("hall");
  const [metricHistory, setMetricHistory] = useState<Record<keyof MetricSnapshots, number[]>>(() => {
    const snapshots = buildSnapshots(state.metrics);
    return {
      conversion: [snapshots.conversion],
      nps: [snapshots.nps],
      warehouseLoad: [snapshots.warehouseLoad],
      pickupSpeed: [snapshots.pickupSpeed],
      teamMorale: [snapshots.teamMorale],
      stockReserve: [snapshots.stockReserve],
      dailyRevenue: [snapshots.dailyRevenue],
    };
  });

  useEffect(() => {
    setMetricHistory((previous) => {
      const next = { ...previous };
      (Object.keys(currentSnapshots) as Array<keyof MetricSnapshots>).forEach((key) => {
        const existing = previous[key] ?? [];
        const last = existing[existing.length - 1];
        if (last === currentSnapshots[key]) return;
        next[key] = [...existing, currentSnapshots[key]].slice(-MAX_HISTORY_POINTS);
      });
      return next;
    });
  }, [currentSnapshots]);

  const zoneCards: TacticalZone[] = [
    {
      key: "hall",
      area: "hall",
      title: "Торг. зал",
      detail: formatStatusLabel(state.zones.торговый_зал.label, state.zones.торговый_зал.health),
      health: resolveConversionHealth(state.metrics.conversion),
      Icon: ShoppingCart,
      percentage: clampPercent(state.metrics.conversion),
      primaryValue: `${clampPercent(state.metrics.conversion)}%`,
      unitLabel: "конверсия",
      historyKey: "conversion",
    },
    {
      key: "clients",
      area: "clients",
      title: "Клиенты",
      detail: `${formatClientRating(state.metrics.nps)} / 5 — клиентская оценка`,
      health: resolveClientRatingHealth(state.metrics.nps),
      Icon: Star,
      percentage: clampPercent(((state.metrics.nps - 1) / 4) * 100),
      primaryValue: formatClientRating(state.metrics.nps),
      unitLabel: "оценка",
      historyKey: "nps",
    },
    {
      key: "pickup",
      area: "pickup",
      title: "Выдача",
      detail: formatStatusLabel(state.zones.выдача.label, state.zones.выдача.health),
      health: resolvePickupHealth(state.metrics.pickupSpeed),
      Icon: Truck,
      percentage: clampPercent(100 - state.metrics.pickupSpeed * 4),
      primaryValue: `${state.metrics.pickupSpeed.toFixed(0)} мин`,
      unitLabel: "скорость",
      historyKey: "pickupSpeed",
      inverseTrend: true,
    },
    {
      key: "warehouse",
      area: "warehouse",
      title: "Склад",
      detail: formatStatusLabel(state.zones.склад.label, state.zones.склад.health),
      health: state.zones.склад.health,
      Icon: Package,
      percentage: clampPercent(state.metrics.warehouseLoad),
      primaryValue: `${clampPercent(state.metrics.warehouseLoad)}%`,
      unitLabel: "загрузка",
      historyKey: "warehouseLoad",
      inverseTrend: true,
    },
    {
      key: "team",
      area: "team",
      title: "Команда",
      detail: `${state.metrics.teamMorale.toFixed(1)} / 10 — состояние смены`,
      health: resolveMoraleHealth(state.metrics.teamMorale),
      Icon: Users,
      percentage: clampPercent(state.metrics.teamMorale * 10),
      primaryValue: state.metrics.teamMorale.toFixed(1),
      unitLabel: "мораль",
      historyKey: "teamMorale",
    },
    {
      key: "goods",
      area: "goods",
      title: "Товар",
      detail: `${Math.max(0, 100 - state.metrics.warehouseLoad)}% резерв — запас по полке`,
      health: resolveInventoryHealth(state.metrics.warehouseLoad),
      Icon: Boxes,
      percentage: clampPercent(100 - state.metrics.warehouseLoad),
      primaryValue: `${clampPercent(100 - state.metrics.warehouseLoad)}%`,
      unitLabel: "резерв",
      historyKey: "stockReserve",
    },
    {
      key: "finance",
      area: "finance",
      title: "Финансы",
      detail: `${formatRevenue(state.metrics.dailyRevenue)} — выполнение дня`,
      health: resolveFinanceHealth(state.metrics.dailyRevenue),
      Icon: Wallet,
      percentage: clampPercent((state.metrics.dailyRevenue / 3500) * 100),
      primaryValue: formatRevenue(state.metrics.dailyRevenue),
      unitLabel: "план дня",
      historyKey: "dailyRevenue",
    },
  ];

  const activeRiskCount = zoneCards.filter((item) => item.health === "orange" || item.health === "red").length;

  function selectZone(zone: TacticalZone) {
    setSelectedZoneKey(zone.key);
    window.dispatchEvent(
      new CustomEvent("dns-store-zone-selected", {
        detail: { zoneKey: zone.key, title: zone.title, health: zone.health, percentage: zone.percentage },
      }),
    );
  }

  return (
    <div className="dns-store-map flex h-full min-h-0 flex-col overflow-hidden">
      <div className="dns-store-map-shell">
        <div className="dns-store-map-head">
          <div>
            <div className="dns-store-map-kicker">Операционная карта</div>
            <div className="dns-store-map-title">Карта магазина</div>
          </div>
          <div className={`dns-store-map-pulse ${activeRiskCount > 0 ? "dns-store-map-pulse--warn" : ""}`}>
            {activeRiskCount > 0 ? `${activeRiskCount} зоны` : "штатно"}
          </div>
        </div>

        <div className="dns-store-map-tactical custom-scroll" role="listbox" aria-label="Зоны магазина">
          {zoneCards.map((zone) => {
            const tone = HEALTH_STYLES[zone.health];
            const sparklineValues = metricHistory[zone.historyKey] ?? [currentSnapshots[zone.historyKey]];
            const activeDots = Math.max(1, Math.ceil(zone.percentage / 20));
            return (
              <button
                key={zone.key}
                type="button"
                role="option"
                aria-selected={selectedZoneKey === zone.key}
                className={`dns-store-map-tactical-card dns-store-map-tactical-card--${zone.area} ${
                  selectedZoneKey === zone.key ? "dns-store-map-tactical-card--selected" : ""
                }`}
                onClick={() => selectZone(zone)}
                style={{
                  borderColor: `${tone.accent}88`,
                  background: tone.surface,
                  boxShadow: selectedZoneKey === zone.key ? tone.glow : "none",
                  ["--zone-accent" as string]: tone.accent,
                  ["--zone-text" as string]: tone.text,
                }}
              >
                <span className="dns-store-map-card-grid" aria-hidden="true" />
                <span className="dns-store-map-card-top">
                  <span className="dns-store-map-card-icon">
                    <zone.Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="dns-store-map-card-title-wrap">
                    <span className="dns-store-map-card-title">{zone.title}</span>
                    <span className="dns-store-map-card-detail">{zone.detail}</span>
                  </span>
                  <span className="dns-store-map-card-badge">{tone.badge}</span>
                </span>

                <span className="dns-store-map-card-body">
                  <span className="dns-store-map-kpi">
                    <strong>{zone.primaryValue}</strong>
                    <small>{zone.unitLabel}</small>
                  </span>
                  <span className="dns-store-map-sparkline">
                    <svg viewBox="0 0 82 26" preserveAspectRatio="none" focusable="false">
                      <path
                        d={buildSparklinePath(sparklineValues, zone.inverseTrend)}
                        fill="none"
                        stroke="var(--zone-accent)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </span>

                <span className="dns-store-map-card-bottom">
                  <span className="dns-store-map-meter" aria-hidden="true">
                    <span
                      className="dns-store-map-meter-fill"
                      style={{
                        width: `${Math.max(8, zone.percentage)}%`,
                        background: `linear-gradient(90deg, ${tone.accent}, rgba(255,255,255,0.18))`,
                      }}
                    />
                  </span>
                  <span className="dns-store-map-dot-row" aria-label={`${zone.percentage}%`}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <span
                        key={index}
                        className={index < activeDots ? "dns-store-map-mini-dot dns-store-map-mini-dot--active" : "dns-store-map-mini-dot"}
                      />
                    ))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="dns-store-map-legend">
          <span><i className="dns-store-map-dot dns-store-map-dot--ok" /> штатно</span>
          <span><i className="dns-store-map-dot dns-store-map-dot--warn" /> внимание</span>
          <span><i className="dns-store-map-dot dns-store-map-dot--risk" /> риск</span>
        </div>
      </div>
    </div>
  );
}
