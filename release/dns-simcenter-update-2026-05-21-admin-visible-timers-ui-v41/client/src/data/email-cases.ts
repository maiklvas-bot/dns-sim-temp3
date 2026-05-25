import type { EmailCase, EmailOption } from "@shared/simulation-content";
import { createRuntimeArrayProxy, getSimulationContentSnapshot } from "@/lib/runtime-content";

export type { EmailCase, EmailOption };

export const EMAIL_CASES: EmailCase[] = createRuntimeArrayProxy(() => getSimulationContentSnapshot().emailCases);

