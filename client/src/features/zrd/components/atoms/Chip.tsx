import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipTone = "pos" | "neg" | "neutral";

/** Атом: компактный чип (эффект карты, стоимость, статус). */
export function Chip({ tone = "neutral", children, className, style }: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const neutralStyle: CSSProperties = tone === "neutral"
    ? { background: "rgba(127,140,165,0.16)", color: "var(--zrd-text-dim)" }
    : {};
  return (
    <span
      className={cn("zrd-chip", tone === "pos" && "zrd-chip--pos", tone === "neg" && "zrd-chip--neg", className)}
      style={{ ...neutralStyle, ...style }}
    >
      {children}
    </span>
  );
}
