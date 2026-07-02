import type { ProjectCard } from "@shared/zrd/types";
import { ZrdProjectCard } from "../molecules/ZrdProjectCard";

interface Check { ok: boolean; reason?: string }

interface Props {
  cards: ProjectCard[];
  selectedIds?: string[];
  onCardClick: (card: ProjectCard) => void;
  check?: (card: ProjectCard) => Check;
  emptyText?: string;
}

export function ZrdHand({ cards, selectedIds, onCardClick, check, emptyText }: Props) {
  if (cards.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed px-4 text-sm" style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text-dim)" }}>
        {emptyText || "Нет доступных карт"}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {cards.map((card) => {
        const v = check?.(card) ?? { ok: true };
        return (
          <ZrdProjectCard
            key={card.id}
            card={card}
            selected={selectedIds?.includes(card.id)}
            disabled={!v.ok}
            title={v.reason}
            onClick={() => onCardClick(card)}
          />
        );
      })}
    </div>
  );
}
