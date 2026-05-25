import "../server/load-env";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import type {
  ChatInfo,
  CompetencyDefinition,
  EmailCase,
  MessengerCase,
  PublicMediaAsset,
  PublicSimulationContent,
  SimCase,
  VideoCase,
} from "../shared/simulation-content";
import { db } from "../server/db";
import { contentStorage } from "../server/content-storage";
import { staffStorage } from "../server/staff-storage";
import {
  caseCycles,
  caseImages,
  caseOptions,
  caseSignals,
  caseTimings,
  channelItems,
  channelOptions,
  competencies,
  mediaAssets,
  messengerChats,
  scoringRules,
  simulationCases,
  simulationSettings,
} from "../shared/schema";

interface BootstrapContent extends Partial<PublicSimulationContent> {
  settings?: Record<string, unknown>;
}

const defaultAssetCatalog = [
  { id: "asset-signal-phonecall", name: "Телефонный сигнал", file: "signal_phonecall.png" },
  { id: "asset-signal-client", name: "Жалоба клиента", file: "signal_client_complaint.png" },
  { id: "asset-signal-floor", name: "Торговый зал", file: "signal_store_floor.png" },
  { id: "asset-signal-boss", name: "Руководство", file: "signal_boss.png" },
  { id: "asset-signal-warehouse", name: "Склад", file: "signal_warehouse.png" },
  { id: "asset-signal-video", name: "Видео", file: "signal_videocall.png" },
  { id: "asset-signal-messenger", name: "Мессенджер", file: "signal_messenger.png" },
  { id: "asset-signal-email", name: "Почта", file: "signal_email.png" },
];

function loadBootstrapContent(filePath: string): BootstrapContent {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Source content file not found: ${resolvedPath}. ` +
      'Сначала соберите bootstrap-content.json, например: npm run db:generate-bootstrap -- "C:\\path\\to\\legacy-source.tar.gz".',
    );
  }

  const raw = fs.readFileSync(resolvedPath, "utf-8");
  const parsed = JSON.parse(raw) as BootstrapContent;

  if (!parsed.cases?.length && !parsed.emailCases?.length && !parsed.messengerCases?.length && !parsed.videoCases?.length) {
    throw new Error(`Bootstrap file ${resolvedPath} does not contain simulation content.`);
  }

  return parsed;
}

function clearContentTables() {
  db.delete(scoringRules).run();
  db.delete(caseOptions).run();
  db.delete(caseSignals).run();
  db.delete(caseCycles).run();
  db.delete(caseImages).run();
  db.delete(caseTimings).run();
  db.delete(channelOptions).run();
  db.delete(channelItems).run();
  db.delete(messengerChats).run();
  db.delete(simulationCases).run();
  db.delete(competencies).run();
  db.delete(mediaAssets).run();
  db.delete(simulationSettings).run();
}

function seedDefaultAssets() {
  for (const asset of defaultAssetCatalog) {
    contentStorage.createAsset({
      id: asset.id,
      name: asset.name,
      mimeType: "image/png",
      storagePath: `library/${asset.file}`,
      originalFilename: asset.file,
    });
  }
}

function seedImportedAssets(assets: PublicMediaAsset[] = []) {
  for (const asset of assets) {
    const alreadyExists = db.select().from(mediaAssets).where(eq(mediaAssets.id, asset.id)).get();
    if (alreadyExists) {
      continue;
    }

    contentStorage.createAsset({
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      storagePath: asset.storagePath,
      originalFilename: asset.name,
    });
  }
}

function seedCompetencies(definitions: CompetencyDefinition[] = []) {
  definitions.forEach((competency, index) => {
    db.insert(competencies).values({
      id: competency.id,
      name: competency.name,
      description: competency.description,
      category: competency.category,
      sortOrder: index + 1,
      isActive: true,
    }).run();
  });
}

function seedSettings(settings?: Record<string, unknown>) {
  db.insert(simulationSettings).values({
    firstSignalMinSeconds: Number(settings?.firstSignalMinSeconds ?? 15),
    firstSignalMaxSeconds: Number(settings?.firstSignalMaxSeconds ?? 30),
    signalIntervalMinSeconds: Number(settings?.signalIntervalMinSeconds ?? 120),
    signalIntervalMaxSeconds: Number(settings?.signalIntervalMaxSeconds ?? 180),
    reminderIntervalSeconds: Number(settings?.reminderIntervalSeconds ?? 3),
    easyAutoCaseCount: Number(settings?.easyAutoCaseCount ?? 6),
    mediumAutoCaseCount: Number(settings?.mediumAutoCaseCount ?? 10),
    hardAutoCaseCount: Number(settings?.hardAutoCaseCount ?? 14),
    defaultTimePerCaseMinutes: Number(settings?.defaultTimePerCaseMinutes ?? 4),
    minSimulationMinutes: Number(settings?.minSimulationMinutes ?? 20),
    updatedAt: new Date().toISOString(),
  }).run();
}

function seedMainCases(cases: SimCase[] = []) {
  cases.forEach((caseData, index) => {
    contentStorage.saveCase({
      ...caseData,
      sortOrder: caseData.sortOrder || index + 1,
      isActive: caseData.isActive ?? true,
      timing: caseData.timing || null,
      cycles: caseData.cycles.map((cycle) => ({
        ...cycle,
        id: cycle.id || `${caseData.id}__cycle_${cycle.cycle}`,
        options: cycle.options.map((option) => ({
          ...option,
          id: option.id || `${caseData.id}__cycle_${cycle.cycle}__option_${option.level}`,
        })),
      })),
    });
  });
}

function seedChats(chats: ChatInfo[] = []) {
  chats.forEach((chat, index) => {
    contentStorage.saveMessengerChat({
      ...chat,
      sortOrder: chat.sortOrder || index + 1,
    });
  });
}

function seedEmailCases(cases: EmailCase[] = []) {
  cases.forEach((item, index) => {
    contentStorage.saveEmailCase({
      ...item,
      sortOrder: item.sortOrder || index + 1,
      isActive: item.isActive ?? true,
      timing: item.timing || { arrivalMinute: item.arrivalMinute, reminderIntervalSeconds: 3 },
      options: item.options.map((option) => ({
        ...option,
        id: option.id || `${item.id}__option_${option.level}`,
      })),
    });
  });
}

function seedMessengerCases(cases: MessengerCase[] = []) {
  cases.forEach((item, index) => {
    contentStorage.saveMessengerCase({
      ...item,
      sortOrder: item.sortOrder || index + 1,
      isActive: item.isActive ?? true,
      timing: item.timing || { arrivalMinute: item.arrivalMinute, reminderIntervalSeconds: 3 },
      options: item.options.map((option) => ({
        ...option,
        id: option.id || `${item.id}__option_${option.level}`,
      })),
    });
  });
}

function seedVideoCases(cases: VideoCase[] = []) {
  cases.forEach((item, index) => {
    contentStorage.saveVideoCase({
      ...item,
      sortOrder: item.sortOrder || index + 1,
      isActive: item.isActive ?? true,
      timing: item.timing || { arrivalMinute: item.arrivalMinute, reminderIntervalSeconds: 3 },
      options: item.options.map((option) => ({
        ...option,
        id: option.id || `${item.id}__option_${option.level}`,
      })),
    });
  });
}

function main() {
  const sourcePath = process.argv[2] || path.resolve("script/bootstrap-content.json");
  const content = loadBootstrapContent(sourcePath);

  clearContentTables();
  seedDefaultAssets();
  seedImportedAssets(content.assets || []);
  seedCompetencies(content.competencies || []);
  seedSettings(content.settings);
  seedMainCases(content.cases || []);
  seedChats(content.messengerChats || []);
  seedEmailCases(content.emailCases || []);
  seedMessengerCases(content.messengerCases || []);
  seedVideoCases(content.videoCases || []);
  staffStorage.ensureDefaults();

  console.log(`Simulation content imported into database from ${path.resolve(sourcePath)}.`);
}

main();
