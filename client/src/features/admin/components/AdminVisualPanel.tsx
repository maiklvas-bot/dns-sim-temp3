import { hideMissingBrandAsset } from "@/lib/brand-assets";
import type { AdminVisualIdentity } from "../admin-types";

export function AdminVisualPanel({ visual }: { visual: AdminVisualIdentity }) {
  return (
    <section className={`dns-admin-visual-panel dns-admin-visual-panel--${visual.tone}`} aria-label={visual.title}>
      <div className="dns-admin-visual-copy">
        <div className="dns-admin-visual-kicker">Фирменный контекст</div>
        <h2 className="dns-admin-visual-title">{visual.title}</h2>
        <p className="dns-admin-visual-subtitle">{visual.subtitle}</p>
      </div>
      <div className="dns-admin-visual-stage">
        <img
          src={visual.primarySrc}
          alt={visual.primaryAlt}
          className={`dns-admin-visual-image dns-admin-visual-primary ${visual.primaryClassName}`}
          onError={hideMissingBrandAsset}
        />
      </div>
    </section>
  );
}
