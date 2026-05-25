import type { CaseOption, CaseTrigger, CycleSignal, SimCase, ZoneType } from "@shared/simulation-content";
import { createRuntimeArrayProxy, getSimulationContentSnapshot } from "@/lib/runtime-content";

export type { CaseOption, CaseTrigger, CycleSignal, SimCase, ZoneType };

export const CASES_DATA: SimCase[] = createRuntimeArrayProxy(() => getSimulationContentSnapshot().cases);

