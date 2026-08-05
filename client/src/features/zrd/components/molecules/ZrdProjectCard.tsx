import { Lock } from "lucide-react";
import type { ProjectCard, CardCondition } from "@shared/zrd/types";
import { CATEGORY_META, RESOURCE_META, METRIC_META, formatEffects, formatCost } from "../../zrd-view";
import { Chip } from "../atoms/Chip";
import type { ResourceKey, MetricKey } from "@shared/zrd/types";

function condText(cond?: CardCondition): string {
  if (!cond) return "";
  const parts: string[] = [];
  for (const k of Object.keys(cond.minMetric ?? {}) as MetricKey[]) parts.push(`${METRIC_META[k].label}≥${cond.minMetric![k]}`);
  for (const k of Object.keys(cond.minResource ?? {}) as ResourceKey[]) parts.push(`${RESOURCE_META[k].label}≥${cond.minResource![k]}`);
  for (const k of Object.keys(cond.minResourceProd ?? {}) as ResourceKey[]) parts.push(`произв. ${RESOURCE_META[k].short}≥${cond.minResourceProd![k]}`);
  return parts.join(", ");
}

interface Props {
  card: ProjectCard;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  title?: string;
}

export function ZrdProjectCard({ card, onClick, disabled, selected, title }: Props) {
  const cat = CATEGORY_META[card.category];
  const Icon = cat.icon;
  const chips = formatEffects(card.effects);
  const cond = condText(card.condition);
  return (
    <button
      type="button"
      className="zrd-card"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${card.title}. ${cat.label}. Стоимость ${formatCost(card.cost) || "—"}`}
      title={title}
      style={selected ? { borderColor: "#FF6B00", boxShadow: "0 0 0 2px rgba(255,107,0,0.45)" } : undefined}
    >
      <span className="zrd-card__band" style={{ background: cat.color }} />
      <div className="zrd-card__head">
        <span className="zrd-card__cat" style={{ background: `${cat.color}22`, color: cat.color }}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="zrd-card__title">{card.title}</span>
      </div>
      <div className="zrd-card__body">
        <div className="zrd-card__cost" style={{ marginLeft: 0 }}>{formatCost(card.cost) || "Бесплатно"}</div>
        <div className="zrd-card__chips">
          {chips.map((c, i) => (
            <Chip key={i} tone={c.positive ? "pos" : "neg"}>{c.text}</Chip>
          ))}
        </div>
      </div>
      {cond && (
        <div className="zrd-card__cond inline-flex items-center gap-1">
          <Lock className="h-3 w-3" aria-hidden /> {cond}
        </div>
      )}
    </button>
  );
}
