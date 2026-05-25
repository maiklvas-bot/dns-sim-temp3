import type { CompetencyDefinition } from "@shared/simulation-content";
import { createRuntimeArrayProxy, getSimulationContentSnapshot } from "@/lib/runtime-content";

export interface CompetencyUiDefinition extends CompetencyDefinition {
  shortName: string;
  maxScore: number;
}

function toShortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) {
    return name.slice(0, 6);
  }
  return parts.map((part) => part.slice(0, 4)).join(".");
}

export const COMPETENCIES: CompetencyUiDefinition[] = createRuntimeArrayProxy(() =>
  getSimulationContentSnapshot().competencies.map((item) => ({
    ...item,
    shortName: toShortName(item.name),
    maxScore: 5,
  })),
);

export const COMPETENCY_MAP = Object.fromEntries(
  COMPETENCIES.map((competency) => [competency.id, competency]),
);
