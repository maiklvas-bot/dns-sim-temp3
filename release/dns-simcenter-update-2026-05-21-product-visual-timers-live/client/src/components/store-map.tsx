import {
  Boxes,
  Package,
  ShoppingCart,
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

  return (
    <div className="flex h-full flex-col">
      <div className="rounded-[22px] border border-[#2a3a4e] bg-[linear-gradient(180deg,rgba(20,29,43,0.94),rgba(9,14,23,0.96))] px-3 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
        <div className="text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white">Карта магазина</div>
          <div className="mx-auto mt-2 h-[3px] w-12 rounded-full bg-[linear-gradient(90deg,rgba(74,158,255,0),rgba(74,158,255,0.9),rgba(74,158,255,0))]" />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5">
          {zoneCards.map(({ key, title, detail, health, Icon, fill }) => {
            const tone = HEALTH_STYLES[health];
            return (
              <div
                key={key}
                className="rounded-2xl border px-3 py-2.5"
                style={{
                  borderColor: `${tone.accent}88`,
                  background: tone.surface,
                  boxShadow: tone.glow,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-none text-white">{title}</div>
                    <div className="mt-1.5 text-[11px] leading-5 whitespace-normal" style={{ color: tone.text }}>
                      {detail}
                    </div>
                  </div>
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border"
                    style={{ borderColor: `${tone.accent}66`, backgroundColor: `${tone.accent}18`, color: tone.accent }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>

                <div className="mt-2.5 rounded-full border border-[#293546] bg-[#0e1521] p-[3px]">
                  <div
                    className="h-1.5 rounded-full"
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
