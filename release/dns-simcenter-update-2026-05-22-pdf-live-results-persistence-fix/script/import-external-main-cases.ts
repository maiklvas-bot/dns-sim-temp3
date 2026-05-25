import "../server/load-env";
import fs from "fs";
import path from "path";
import { db } from "../server/db";
import { contentStorage } from "../server/content-storage";
import { competencies, simulationCases } from "../shared/schema";
import type { SimCase, ZoneType } from "../shared/simulation-content";

interface ImportedCaseOption {
  level: number;
  text: string;
  score: number;
  effects?: {
    queue?: number | null;
    conversion?: number | null;
    morale?: number | null;
    revenue_impact?: number | null;
    delivery_status?: number | null;
  };
}

interface ImportedCaseCycle {
  cycle: number;
  situation: string;
  signal: {
    type: SimCase["cycles"][number]["signal"]["type"];
    content: string;
  };
  options: ImportedCaseOption[];
}

interface ImportedCase {
  sourceFile?: string;
  id?: string | null;
  title: string;
  description: string;
  trigger: {
    source: string;
    type: SimCase["trigger"]["type"];
    text: string;
  };
  zones_affected: string[];
  primaryCompetencies: string[];
  secondaryCompetencies: string[];
  timing?: {
    minIntervalSeconds?: number | null;
    maxIntervalSeconds?: number | null;
    reminderIntervalSeconds?: number | null;
  } | null;
  imageAssetId?: string | null;
  audioAssetId?: string | null;
  isActive?: boolean;
  cycles: ImportedCaseCycle[];
}

const VALID_ZONES = new Set<ZoneType>(["торговый_зал", "склад", "выдача", "начальство"]);

function loadImportedCases(filePath: string): ImportedCase[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Imported cases file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  const parsed = JSON.parse(raw) as ImportedCase[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Imported cases file ${resolved} does not contain any cases.`);
  }

  return parsed;
}

function toCaseId(caseNumber: number) {
  return `CASE-${String(caseNumber).padStart(2, "0")}`;
}

function main() {
  const sourcePath = process.argv[2] || path.resolve("script/imported-main-cases.json");
  const importedCases = loadImportedCases(sourcePath);

  const competencyRows = db.select().from(competencies).all();
  const competenciesByName = new Map(
    competencyRows.map((row) => [row.name.trim().toLowerCase(), row.id]),
  );

  const existingCases = db.select().from(simulationCases).all();
  const usedIds = new Set(existingCases.map((row) => row.id));
  let nextCaseNumber = existingCases.reduce((max, row) => {
    const match = /^CASE-(\d+)$/.exec(row.id);
    if (!match) {
      return max;
    }
    return Math.max(max, parseInt(match[1] || "0", 10));
  }, 0) + 1;

  let nextSortOrder = existingCases.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;

  const importedSummary: string[] = [];

  for (const imported of importedCases) {
    const sourceLabel = imported.sourceFile || imported.title || "unknown source";
    const title = imported.title?.trim();
    const description = imported.description?.trim();
    if (!title || !description) {
      throw new Error(`Case "${sourceLabel}" must include title and description.`);
    }

    const primaryCompetencies = imported.primaryCompetencies.map((name) => {
      const competencyId = competenciesByName.get(name.trim().toLowerCase());
      if (!competencyId) {
        throw new Error(`Unknown primary competency "${name}" in ${sourceLabel}.`);
      }
      return competencyId;
    });

    const secondaryCompetencies = imported.secondaryCompetencies.map((name) => {
      const competencyId = competenciesByName.get(name.trim().toLowerCase());
      if (!competencyId) {
        throw new Error(`Unknown secondary competency "${name}" in ${sourceLabel}.`);
      }
      return competencyId;
    });

    const normalizedZones = imported.zones_affected.map((zone) => zone.trim()).filter(Boolean);
    if (normalizedZones.some((zone) => !VALID_ZONES.has(zone as ZoneType))) {
      throw new Error(`Case "${sourceLabel}" contains unsupported zones: ${normalizedZones.join(", ")}`);
    }

    const caseIdMatch = imported.id ? /^CASE-(\d+)$/.exec(imported.id) : null;
    const assignedCaseId = caseIdMatch && !usedIds.has(imported.id!)
      ? imported.id!
      : toCaseId(nextCaseNumber++);
    usedIds.add(assignedCaseId);

    const competencyIdsForScoring = Array.from(
      new Set([...primaryCompetencies, ...secondaryCompetencies]),
    );

    const cycles = imported.cycles
      .filter((cycle) => cycle.situation?.trim() && cycle.signal?.content?.trim() && cycle.options?.length)
      .map((cycle) => ({
        cycle: cycle.cycle,
        id: undefined,
        situation: cycle.situation.trim(),
        signal: {
          type: cycle.signal.type,
          content: cycle.signal.content.trim(),
        },
        options: cycle.options
          .filter((option) => option.text?.trim())
          .map((option) => ({
            id: undefined,
            level: option.level,
            text: option.text.trim(),
            score: option.score,
            effects: {
              queue: option.effects?.queue ?? 0,
              conversion: option.effects?.conversion ?? 0,
              morale: option.effects?.morale ?? 0,
              revenue_impact: option.effects?.revenue_impact ?? 0,
              delivery_status: option.effects?.delivery_status ?? 0,
            },
            // Excel export contains case-level competencies but not per-option scoring.
            // We apply the option score to each listed competency to preserve competency analytics.
            competency_scores: Object.fromEntries(
              competencyIdsForScoring.map((competencyId) => [competencyId, option.score]),
            ),
          })),
      }));

    if (cycles.length === 0) {
      throw new Error(`Case "${sourceLabel}" does not contain any filled cycles with options.`);
    }

    contentStorage.saveCase({
      id: assignedCaseId,
      title,
      description,
      primaryCompetencies,
      secondaryCompetencies,
      trigger: {
        source: imported.trigger.source.trim(),
        type: imported.trigger.type,
        text: imported.trigger.text.trim(),
      },
      zones_affected: normalizedZones as ZoneType[],
      cycles,
      imageAssetId: imported.imageAssetId || null,
      imageUrl: null,
      audioAssetId: imported.audioAssetId || null,
      audioUrl: null,
      timing: imported.timing || null,
      sortOrder: nextSortOrder++,
      isActive: imported.isActive ?? true,
    });

    importedSummary.push(`${assignedCaseId} <- ${sourceLabel}`);
  }

  console.log(`Imported ${importedSummary.length} cases into ${process.env.SQLITE_PATH || "data.db"}:`);
  for (const item of importedSummary) {
    console.log(`- ${item}`);
  }
}

main();
