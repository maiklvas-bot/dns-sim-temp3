export function parseJsonArray<T>(value: string | null | undefined, fallback: T[]): T[] {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function buildPublicAssetUrl(storagePath: string): string {
  const optimizedSignalAssets: Record<string, string> = {
    "library/signal_phonecall.png": "library/optimized/signal_phonecall.jpg",
    "library/signal_client_complaint.png": "library/optimized/signal_client_complaint.jpg",
    "library/signal_store_floor.png": "library/optimized/signal_store_floor.jpg",
    "library/signal_boss.png": "library/optimized/signal_boss.jpg",
    "library/signal_warehouse.png": "library/optimized/signal_warehouse.jpg",
    "library/signal_videocall.png": "library/optimized/signal_videocall.jpg",
    "library/signal_messenger.png": "library/optimized/signal_messenger.jpg",
    "library/signal_email.png": "library/optimized/signal_email.jpg",
  };
  const normalizedPath = storagePath.replace(/^\/+/, "");
  const optimizedPath = optimizedSignalAssets[normalizedPath];
  if (optimizedPath) {
    return `/${optimizedPath}`;
  }

  if (/^https?:\/\//i.test(storagePath) || storagePath.startsWith("/")) {
    return storagePath;
  }

  return `/${normalizedPath}`;
}
