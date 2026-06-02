import {
  Boxes,
  Package,
  ShoppingCart,
  Star,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useSimulation, type ZoneHealth } from "../context/SimulationContext";

const HEALTH_STYLES: Record<ZoneHealth, { accent: string; surface: string; text: string; glow: string }> = {
  green: {
    accent: "#54d28c",
    surface: "linear-gradient(180deg, rgba(84,210,140,0.14), rgba(10,18,28,0.94))",
    text: "#e6fff0",
    glow: "0 0 24px rgba(84,210,140,0.18)",
  },
  yellow: {
    accent: "#f0c46b",
    surface: "linear-gradient(180deg, rgba(240,196,107,0.15), rgba(10,18,28,0.94))",
    text: "#fff3d7",
    glow: "0 0 24px rgba(240,196,107,0.16)",
  },
  orange: {
    accent: "#ff9b53",
    surface: "linear-gradient(180deg, rgba(255,155,83,0.16), rgba(10,18,28,0.94))",
    text: "#ffe6d1",
    glow: "0 0 24px rgba(255,155,83,0.16)",
  },
  red: {
    accent: "#d79f9f",
    surface: "linear-gradient(180deg, rgba(215,159,159,0.18), rgba(10,18,28,0.94))",
    text: "#fff0f0",
    glow: "0 0 24px rgba(215,159,159,0.16)",
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

export default function StoreMap() {
  const { state } = useSimulation();
  const zoneCards = [
    {
      key: "hall",
      title: "Торг. зал",
      detail: formatStatusLabel(state.zones.торговый_зал.label, state.zones.торговый_зал.health),
      health: state.zones.торговый_зал.health,
      Icon: ShoppingCart,
      fill: state.metrics.conversion,
    },
    {
      key: "client-rating",
      title: "Клиенты",
      detail: `${formatClientRating(state.metrics.nps)} / 5 — клиентская оценка`,
      health: resolveClientRatingHealth(state.metrics.nps),
      Icon: Star,
      fill: ((state.metrics.nps - 1) / 4) * 100,
    },
    {
      key: "warehouse",
      title: "Склад",
      detail: formatStatusLabel(state.zones.склад.label, state.zones.склад.health),
      health: state.zones.склад.health,
      Icon: Package,
      fill: state.metrics.warehouseLoad,
    },
    {
      key: "pickup",
      title: "Выдача",
      detail: formatStatusLabel(state.zones.выдача.label, state.zones.выдача.health),
      health: state.zones.выдача.health,
      Icon: Truck,
      fill: Math.max(8, 100 - state.metrics.pickupSpeed * 4),
    },
    {
      key: "team",
      title: "Команда",
      detail: `${state.metrics.teamMorale.toFixed(1)} / 10 — состояние смены`,
      health: resolveMoraleHealth(state.metrics.teamMorale),
      Icon: Users,
      fill: state.metrics.teamMorale * 10,
    },
    {
      key: "goods",
      title: "Товар",
      detail: `${Math.max(0, 100 - state.metrics.warehouseLoad)}% резерв — запас по полке`,
      health: resolveInventoryHealth(state.metrics.warehouseLoad),
      Icon: Boxes,
      fill: Math.max(6, 100 - state.metrics.warehouseLoad),
    },
    {
      key: "finance",
      title: "Финансы",
      detail: `${formatRevenue(state.metrics.dailyRevenue)} — выполнение дня`,
      health: resolveFinanceHealth(state.metrics.dailyRevenue),
      Icon: Wallet,
      fill: Math.min(100, (state.metrics.dailyRevenue / 3500) * 100),
    },
  ];

  const activeRiskCount = zoneCards.filter((item) => item.health === "orange" || item.health === "red").length;

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

        <div className="dns-store-map-floor" aria-hidden="true">
          <span className="dns-store-map-floor-line dns-store-map-floor-line--top" />
          <span className="dns-store-map-floor-line dns-store-map-floor-line--mid" />
          <span className="dns-store-map-floor-dot dns-store-map-floor-dot--hall" />
          <span className="dns-store-map-floor-dot dns-store-map-floor-dot--pickup" />
          <span className="dns-store-map-floor-dot dns-store-map-floor-dot--warehouse" />
        </div>

        <div className="dns-store-map-grid custom-scroll">
          {zoneCards.map(({ key, title, detail, health, Icon, fill }) => {
            const tone = HEALTH_STYLES[health];
            return (
              <div
                key={key}
                className="dns-store-map-card"
                style={{
                  borderColor: `${tone.accent}88`,
                  background: tone.surface,
                  boxShadow: tone.glow,
                  ["--zone-accent" as string]: tone.accent,
                  ["--zone-text" as string]: tone.text,
                }}
              >
                <div className="dns-store-map-card-head">
                  <div className="dns-store-map-card-icon">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="dns-store-map-card-title">{title}</div>
                    <div className="dns-store-map-card-detail">
                      {detail}
                    </div>
                  </div>
                </div>

                <div className="dns-store-map-meter">
                  <div
                    className="dns-store-map-meter-fill"
                    style={{
                      width: `${Math.max(8, Math.min(fill, 100))}%`,
                      background: `linear-gradient(90deg, ${tone.accent}, rgba(255,255,255,0.18))`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
