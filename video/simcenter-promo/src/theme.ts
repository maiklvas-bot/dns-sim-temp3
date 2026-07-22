// Copied verbatim from client/src/styles/dns-theme.ts — keep in sync if that file changes.
export const COLORS = {
  primary: "#F04E23",
  primaryLight: "#FF6B35",
  primaryDark: "#D84315",
  bgDark: "#0F1923",
  bgCard: "#1A2634",
  bgElevated: "#243447",
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
} as const;

export const FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif";

export const GRADIENTS = {
  dark: "linear-gradient(180deg, #0F1923 0%, #1A2634 100%)",
  hero: "linear-gradient(135deg, #F04E23 0%, #0F1923 60%)",
} as const;
