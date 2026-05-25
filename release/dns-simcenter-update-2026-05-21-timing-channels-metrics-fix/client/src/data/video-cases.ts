import type { VideoCase, VideoOption } from "@shared/simulation-content";
import { createRuntimeArrayProxy, getSimulationContentSnapshot } from "@/lib/runtime-content";

export type { VideoCase, VideoOption };

export const VIDEO_CASES: VideoCase[] = createRuntimeArrayProxy(() => getSimulationContentSnapshot().videoCases);

