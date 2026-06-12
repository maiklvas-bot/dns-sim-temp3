import type { SyntheticEvent } from "react";

import authDark from "@/assets/brand/backgrounds/01_background_auth_dark_dns_store_cosmic.png";
import authLight from "@/assets/brand/backgrounds/02_background_auth_light_dns_store_clean.png";
import authStoreDark from "@/assets/brand/backgrounds/07_background_auth_dark_store_interior.png";
import authStoreLight from "@/assets/brand/backgrounds/08_background_auth_light_storefront.png";
import productDark from "@/assets/brand/backgrounds/03_background_product_dashboard_dark.png";
import productLight from "@/assets/brand/backgrounds/04_background_product_dashboard_light.png";
import simulationDark from "@/assets/brand/backgrounds/05_background_simulation_store_day_dark.png";
import resultsDark from "@/assets/brand/backgrounds/06_background_results_trophy_dark.png";
import logoDark from "@/assets/brand/logos/logo_dns_simcenter_dark.png";
import logoLight from "@/assets/brand/logos/logo_dns_simcenter_light.png";
import dnsMarkOrange from "@/assets/brand/logos/logo_dns_mark_orange.png";
import alienIdea from "@/assets/brand/heroes/dnstech_alien_idea.png";
import alienNotebookSit from "@/assets/brand/heroes/dnstech_alien_notebooksit.png";
import alienObserve from "@/assets/brand/heroes/dnstech_alien_observe.png";
import alienOk from "@/assets/brand/heroes/dnstech_alien_OK.png";
import alienPen from "@/assets/brand/heroes/dnstech_alien_pen.png";
import alienPoint from "@/assets/brand/heroes/dnstech_alien_point.png";
import alienWelcome from "@/assets/brand/heroes/dnstech_alien_welcome.png";
import alienWorkPc from "@/assets/brand/heroes/dnstech_alien_workpc.png";
import glowOrange from "@/assets/brand/effects/effect_glow_orange.png";
import glowBlue from "@/assets/brand/effects/effect_glow_blue.png";
import glowCyan from "@/assets/brand/effects/effect_glow_cyan.png";
import iconAdmin from "@/assets/brand/effects/icon_admin_role.png";
import iconCosmonaut from "@/assets/brand/effects/icon_cosmonaut_role.png";
import iconEvaluator from "@/assets/brand/effects/icon_evaluator_role.png";
import iconInstruction from "@/assets/brand/effects/icon_instruction.png";
import iconResults from "@/assets/brand/effects/icon_results.png";
import iconSessionCode from "@/assets/brand/effects/icon_session_code.png";
import iconSuccess from "@/assets/brand/effects/icon_success.png";
import iconWarning from "@/assets/brand/effects/icon_warning.png";
import gridOverlay from "@/assets/brand/patterns/pattern_grid_overlay.png";
import noiseOverlay from "@/assets/brand/patterns/pattern_noise_overlay.png";
import orbitOverlay from "@/assets/brand/patterns/pattern_orbit_overlay.png";
import scanlineOverlay from "@/assets/brand/patterns/pattern_scanline_overlay.png";
import likedMainScreen from "@/assets/brand/reference/reference_main_screen_mockup_liked_by_user.png";
import rejectedDirection from "@/assets/brand/reference/reference_full_project_mockup_rejected_direction.png";

export const BRAND_ASSETS = Object.freeze({
  backgrounds: {
    authDark: authStoreDark,
    authLight: authStoreLight,
    authCosmicDark: authDark,
    authCosmicLight: authLight,
    productDark,
    productLight,
    simulationDark,
    resultsDark,
  },
  logos: {
    dnsSimcenterDark: logoDark,
    dnsSimcenterLight: logoLight,
    dnsMarkOrange,
  },
  heroes: {
    alienIdea,
    alienNotebookSit,
    alienObserve,
    alienOk,
    alienPen,
    alienPoint,
    alienWelcome,
    alienWorkPc,
    alienAnalyst: alienWorkPc,
  },
  effects: {
    glowOrange,
    glowBlue,
    glowCyan,
    iconAdmin,
    iconCosmonaut,
    iconEvaluator,
    iconInstruction,
    iconResults,
    iconSessionCode,
    iconSuccess,
    iconWarning,
  },
  patterns: {
    gridOverlay,
    noiseOverlay,
    scanlineOverlay,
    orbitOverlay,
  },
  reference: {
    mainScreenMockupLikedByUser: likedMainScreen,
    fullProjectMockupRejectedDirection: rejectedDirection,
  },
});

// Compatibility alias for the first visual pass.
export const brandAssets = BRAND_ASSETS;

export type StaffBrandRole = "admin" | "evaluator";

export function getStaffBrandHero(role: StaffBrandRole) {
  return role === "admin" ? BRAND_ASSETS.heroes.alienWorkPc : BRAND_ASSETS.heroes.alienObserve;
}

export function hideMissingBrandAsset(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  image.hidden = true;
  image.dataset.brandAssetMissing = "true";
  image.parentElement?.setAttribute("data-brand-asset-fallback", "true");
}
