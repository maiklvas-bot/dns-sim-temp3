import type { ReactNode } from "react";

import { ThemeToggle, useDnsTheme } from "@/components/theme-toggle";
import { BRAND_ASSETS, hideMissingBrandAsset } from "@/lib/brand-assets";

type BackdropVariant = "auth" | "product" | "simulation" | "results" | "cabinet";

const BACKDROP_IMAGES: Record<BackdropVariant, { dark: string; light?: string }> = {
  auth: {
    dark: BRAND_ASSETS.backgrounds.authDark,
    light: BRAND_ASSETS.backgrounds.authLight,
  },
  product: {
    dark: BRAND_ASSETS.backgrounds.productDark,
    light: BRAND_ASSETS.backgrounds.productLight,
  },
  cabinet: {
    dark: BRAND_ASSETS.backgrounds.cabinetDark,
    light: BRAND_ASSETS.backgrounds.cabinetLight,
  },
  simulation: {
    dark: BRAND_ASSETS.backgrounds.simulationDark,
    light: BRAND_ASSETS.backgrounds.productLight,
  },
  results: {
    dark: BRAND_ASSETS.backgrounds.resultsDark,
    light: BRAND_ASSETS.backgrounds.productLight,
  },
};

export function BrandVisualBackdrop({ variant }: { variant: BackdropVariant }) {
  const images = BACKDROP_IMAGES[variant];

  return (
    <div className={`dns-visual-backdrop dns-visual-backdrop--${variant}`} aria-hidden="true">
      <img
        src={images.dark}
        alt=""
        className="dns-visual-backdrop__image dns-visual-backdrop__image--dark"
        onError={hideMissingBrandAsset}
      />
      {images.light ? (
        <img
          src={images.light}
          alt=""
          className="dns-visual-backdrop__image dns-visual-backdrop__image--light"
          onError={hideMissingBrandAsset}
        />
      ) : null}
      <div className="dns-visual-backdrop__gradient" />
      <img
        src={BRAND_ASSETS.patterns.gridOverlay}
        alt=""
        className="dns-visual-backdrop__grid"
        onError={hideMissingBrandAsset}
      />
      <img
        src={BRAND_ASSETS.patterns.noiseOverlay}
        alt=""
        className="dns-visual-backdrop__noise"
        onError={hideMissingBrandAsset}
      />
    </div>
  );
}

export function BrandAccessShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { theme, themeClass, toggleTheme } = useDnsTheme();

  return (
    <div className={`dns-product-shell dns-visual-shell dns-visual-shell--auth dns-access-shell ${themeClass} ${className}`.trim()}>
      <BrandVisualBackdrop variant="auth" />
      <div className="dns-access-theme-control">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      {children}
    </div>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dns-visual-logo${compact ? " dns-visual-logo--compact" : ""}`} aria-label="DNS SimCenter">
      <span className="dns-visual-logo__fallback">
        <strong>DNS</strong> SimCenter
      </span>
      <img
        src={BRAND_ASSETS.logos.dnsSimcenterDark}
        alt=""
        className="dns-visual-logo__image dns-visual-logo__image--dark"
        onError={hideMissingBrandAsset}
      />
      <img
        src={BRAND_ASSETS.logos.dnsSimcenterLight}
        alt=""
        className="dns-visual-logo__image dns-visual-logo__image--light"
        onError={hideMissingBrandAsset}
      />
    </div>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dns-access-brand-mark${compact ? " dns-access-brand-mark--compact" : ""}`}>
      <span>DNS</span>
      <img
        src={BRAND_ASSETS.logos.dnsMarkOrange}
        alt=""
        onError={hideMissingBrandAsset}
      />
    </div>
  );
}

export function BrandMiniHeader() {
  return <BrandLogo compact />;
}

export function BrandWorkspaceMark() {
  return (
    <div className="dns-workspace-brand" aria-label="DNS SimCenter">
      <BrandMark compact />
      <span>
        DNS <strong>SimCenter</strong>
      </span>
    </div>
  );
}
