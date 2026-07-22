import { describe, expect, it } from "vitest";
import { COLORS, FONT_FAMILY, GRADIENTS } from "../theme";

describe("theme tokens", () => {
  it("matches client/src/styles/dns-theme.ts exactly", () => {
    expect(COLORS.primary).toBe("#F04E23");
    expect(COLORS.primaryLight).toBe("#FF6B35");
    expect(COLORS.primaryDark).toBe("#D84315");
    expect(COLORS.bgDark).toBe("#0F1923");
    expect(COLORS.bgCard).toBe("#1A2634");
    expect(COLORS.bgElevated).toBe("#243447");
    expect(COLORS.textPrimary).toBe("#FFFFFF");
    expect(COLORS.textSecondary).toBe("#94A3B8");
    expect(COLORS.textMuted).toBe("#64748B");
    expect(FONT_FAMILY).toBe("Inter, system-ui, -apple-system, sans-serif");
    expect(GRADIENTS.hero).toContain("240,78,35");
  });
});
