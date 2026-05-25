import { getSimulationContentSnapshot, getSimulationSettingsSnapshot } from "@/lib/runtime-content";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";

function getAssetUrl(assetId: string): string {
  const { assets } = getSimulationContentSnapshot();
  const exact = assets.find((asset) => asset.id === assetId && asset.kind === "image");
  if (exact) {
    return exact.publicUrl;
  }

  return assets.find((asset) => asset.kind === "image")?.publicUrl || "";
}

export function getWaitingSignalImage(): string {
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  if (settings?.waitingImageAssetId) {
    return getAssetUrl(settings.waitingImageAssetId);
  }

  return getAssetUrl("asset-signal-floor");
}

// Map signal types and zone keywords to images
export function getSignalImage(
  signalType: string,
  zonesAffected: string[],
  caseTitle: string,
  channel?: "audio" | "email" | "messenger" | "video",
  imageUrl?: string | null,
): string {
  if (imageUrl) return imageUrl;
  // Channel-specific images
  if (channel === "email") return getAssetUrl("asset-signal-email");
  if (channel === "messenger") return getAssetUrl("asset-signal-messenger");
  if (channel === "video") return getAssetUrl("asset-signal-video");

  // Zone-based
  if (zonesAffected.includes("начальство") || caseTitle.toLowerCase().includes("директор") || caseTitle.toLowerCase().includes("управляющ")) {
    return getAssetUrl("asset-signal-boss");
  }
  if (zonesAffected.includes("склад") || caseTitle.toLowerCase().includes("склад") || caseTitle.toLowerCase().includes("поставк")) {
    return getAssetUrl("asset-signal-warehouse");
  }

  // Signal type-based
  if (signalType === "call" || signalType === "message") {
    // Detect complaint/client signals
    if (
      caseTitle.toLowerCase().includes("клиент") ||
      caseTitle.toLowerCase().includes("жалоб") ||
      caseTitle.toLowerCase().includes("рекламац") ||
      caseTitle.toLowerCase().includes("возврат")
    ) {
      return getAssetUrl("asset-signal-client");
    }
    return getAssetUrl("asset-signal-phonecall");
  }

  if (signalType === "visitor") return getAssetUrl("asset-signal-client");
  if (signalType === "zone_signal") return getAssetUrl("asset-signal-floor");
  if (signalType === "email") return getAssetUrl("asset-signal-email");

  // Default: store floor
  return getAssetUrl("asset-signal-floor");
}
