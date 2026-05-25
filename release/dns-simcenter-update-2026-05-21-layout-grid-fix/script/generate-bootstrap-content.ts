import fs from "fs";
import path from "path";
import vm from "vm";
import { spawnSync } from "child_process";
import ts from "typescript";

type CompetencyCategory = "basic" | "advanced" | "leadership";

interface LegacyCompetencyDefinition {
  id: string;
  name: string;
  description: string;
}

interface LegacyCaseOption {
  level: number;
  text: string;
  score: number;
  effects: {
    queue: number;
    conversion: number;
    morale: number;
    revenue_impact: number;
    delivery_status: number;
  };
  competency_scores: Record<string, number>;
}

interface LegacySimCase {
  id: string;
  title: string;
  description: string;
  primaryCompetencies: string[];
  secondaryCompetencies: string[];
  trigger: {
    type: "message" | "zone_signal" | "email" | "call" | "visitor";
    source: string;
    text: string;
  };
  zones_affected: string[];
  cycles: Array<{
    cycle: number;
    situation: string;
    signal: {
      type: "message" | "zone_signal" | "email" | "call" | "visitor";
      content: string;
    };
    options: LegacyCaseOption[];
  }>;
}

interface LegacyEmailCase {
  id: string;
  subject: string;
  from: string;
  department: string;
  departmentColor: string;
  preview: string;
  body: string;
  arrivalMinute: number;
  options: LegacyCaseOption[];
  primaryCompetency: string;
}

interface LegacyMessengerChat {
  id: string;
  name: string;
  isGroup: boolean;
  avatar: string;
  role?: string;
  icon?: string;
  members?: string[];
}

interface LegacyMessengerCase {
  id: string;
  chatId: string;
  isGroup: boolean;
  senderName: string;
  senderRole: string;
  senderAvatar: string;
  message: string;
  arrivalMinute: number;
  options: LegacyCaseOption[];
  primaryCompetency: string;
}

interface LegacyVideoCase {
  id: string;
  title: string;
  sender: string;
  role: string;
  senderAvatar: string;
  duration: string;
  situation: string;
  arrivalMinute: number;
  options: LegacyCaseOption[];
  primaryCompetency: string;
}

interface BootstrapAsset {
  id: string;
  name: string;
  mimeType: string;
  storagePath: string;
  publicUrl: string;
  kind: "image";
}

interface BootstrapContent {
  settings: {
    firstSignalMinSeconds: number;
    firstSignalMaxSeconds: number;
    signalIntervalMinSeconds: number;
    signalIntervalMaxSeconds: number;
    reminderIntervalSeconds: number;
    easyAutoCaseCount: number;
    mediumAutoCaseCount: number;
    hardAutoCaseCount: number;
    defaultTimePerCaseMinutes: number;
    minSimulationMinutes: number;
  };
  competencies: Array<{
    id: string;
    name: string;
    description: string;
    category: CompetencyCategory;
  }>;
  assets: BootstrapAsset[];
  cases: Array<Record<string, unknown>>;
  messengerChats: Array<Record<string, unknown>>;
  emailCases: Array<Record<string, unknown>>;
  messengerCases: Array<Record<string, unknown>>;
  videoCases: Array<Record<string, unknown>>;
}

const DATA_FILE_SUFFIXES = {
  cases: "client/src/data/cases.ts",
  emailCases: "client/src/data/email-cases.ts",
  messengerCases: "client/src/data/messenger-cases.ts",
  videoCases: "client/src/data/video-cases.ts",
  competencies: "client/src/data/competencies.ts",
} as const;

const DEFAULT_SETTINGS = {
  firstSignalMinSeconds: 15,
  firstSignalMaxSeconds: 30,
  signalIntervalMinSeconds: 120,
  signalIntervalMaxSeconds: 180,
  reminderIntervalSeconds: 3,
  easyAutoCaseCount: 6,
  mediumAutoCaseCount: 10,
  hardAutoCaseCount: 14,
  defaultTimePerCaseMinutes: 4,
  minSimulationMinutes: 20,
};

const DEFAULT_ASSETS: BootstrapAsset[] = [
  {
    id: "asset-signal-phonecall",
    name: "Телефонный сигнал",
    mimeType: "image/png",
    storagePath: "library/signal_phonecall.png",
    publicUrl: "/library/signal_phonecall.png",
    kind: "image",
  },
  {
    id: "asset-signal-client",
    name: "Жалоба клиента",
    mimeType: "image/png",
    storagePath: "library/signal_client_complaint.png",
    publicUrl: "/library/signal_client_complaint.png",
    kind: "image",
  },
  {
    id: "asset-signal-floor",
    name: "Торговый зал",
    mimeType: "image/png",
    storagePath: "library/signal_store_floor.png",
    publicUrl: "/library/signal_store_floor.png",
    kind: "image",
  },
  {
    id: "asset-signal-boss",
    name: "Руководство",
    mimeType: "image/png",
    storagePath: "library/signal_boss.png",
    publicUrl: "/library/signal_boss.png",
    kind: "image",
  },
  {
    id: "asset-signal-warehouse",
    name: "Склад",
    mimeType: "image/png",
    storagePath: "library/signal_warehouse.png",
    publicUrl: "/library/signal_warehouse.png",
    kind: "image",
  },
  {
    id: "asset-signal-video",
    name: "Видео",
    mimeType: "image/png",
    storagePath: "library/signal_videocall.png",
    publicUrl: "/library/signal_videocall.png",
    kind: "image",
  },
  {
    id: "asset-signal-messenger",
    name: "Мессенджер",
    mimeType: "image/png",
    storagePath: "library/signal_messenger.png",
    publicUrl: "/library/signal_messenger.png",
    kind: "image",
  },
  {
    id: "asset-signal-email",
    name: "Почта",
    mimeType: "image/png",
    storagePath: "library/signal_email.png",
    publicUrl: "/library/signal_email.png",
    kind: "image",
  },
  {
    id: "asset-store-bg",
    name: "Фон магазина",
    mimeType: "image/png",
    storagePath: "library/store_bg.png",
    publicUrl: "/library/store_bg.png",
    kind: "image",
  },
];

const COMPETENCY_CATEGORY_MAP: Record<string, CompetencyCategory> = {
  planning: "leadership",
  management_basics: "leadership",
  delegation: "leadership",
  responsibility: "leadership",
  communication: "advanced",
  decision_making: "advanced",
  stress_resistance: "advanced",
  legal_basics: "basic",
  business_processes: "advanced",
  control: "leadership",
  flexibility: "advanced",
  result_orientation: "leadership",
  product_knowledge: "basic",
  it_tools: "advanced",
};

function isArchivePath(inputPath: string) {
  return /\.(tar|tar\.gz|tgz)$/i.test(inputPath);
}

function runTar(args: string[], sourcePath: string) {
  const result = spawnSync("tar", args, {
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(
      `Failed to read legacy source ${sourcePath} with tar.\n` +
      `${result.stderr || result.stdout || "tar returned a non-zero exit code."}`,
    );
  }

  return result.stdout;
}

function readArchiveEntries(sourcePath: string) {
  return runTar(["-tf", sourcePath], sourcePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readArchiveFile(sourcePath: string, suffix: string) {
  const entry = readArchiveEntries(sourcePath).find((line) => line.endsWith(suffix));
  if (!entry) {
    throw new Error(`Legacy archive ${sourcePath} does not contain ${suffix}.`);
  }

  return runTar(["-xOf", sourcePath, entry], sourcePath);
}

function readDirectoryFile(sourcePath: string, suffix: string) {
  const normalizedSuffix = suffix.replaceAll("/", path.sep);
  const candidates = [
    path.join(sourcePath, normalizedSuffix),
    path.join(sourcePath, "dns-simcenter-fixed", normalizedSuffix),
  ];

  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (!existing) {
    throw new Error(`Legacy source directory ${sourcePath} does not contain ${suffix}.`);
  }

  return fs.readFileSync(existing, "utf-8");
}

function readLegacyFile(sourcePath: string, suffix: string) {
  return isArchivePath(sourcePath)
    ? readArchiveFile(sourcePath, suffix)
    : readDirectoryFile(sourcePath, suffix);
}

function evaluateLegacyModule<T>(sourceCode: string, filename: string) {
  const compiled = ts.transpileModule(sourceCode, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;

  const moduleRef = { exports: {} as Record<string, unknown> };
  const context = vm.createContext({
    module: moduleRef,
    exports: moduleRef.exports,
    require: (specifier: string) => {
      throw new Error(`Unsupported import "${specifier}" while evaluating ${filename}.`);
    },
    __filename: filename,
    __dirname: path.dirname(filename),
    console,
    process: { env: {} },
    Object,
    Array,
    Math,
    JSON,
    Date,
    String,
    Number,
    Boolean,
  });

  new vm.Script(compiled, { filename }).runInContext(context);
  return moduleRef.exports as T;
}

function inferMainCaseAssetId(item: LegacySimCase) {
  const title = item.title.toLowerCase();

  if (
    item.zones_affected.includes("начальство") ||
    title.includes("директор") ||
    title.includes("управляющ")
  ) {
    return "asset-signal-boss";
  }

  if (
    item.zones_affected.includes("склад") ||
    title.includes("склад") ||
    title.includes("поставк")
  ) {
    return "asset-signal-warehouse";
  }

  if (item.trigger.type === "call" || item.trigger.type === "message") {
    if (
      title.includes("клиент") ||
      title.includes("жалоб") ||
      title.includes("рекламац") ||
      title.includes("возврат")
    ) {
      return "asset-signal-client";
    }

    return "asset-signal-phonecall";
  }

  if (item.trigger.type === "visitor") {
    return "asset-signal-client";
  }

  if (item.trigger.type === "email") {
    return "asset-signal-email";
  }

  return "asset-signal-floor";
}

function assetUrlById(assetId: string | null) {
  const asset = DEFAULT_ASSETS.find((item) => item.id === assetId);
  return asset?.publicUrl || null;
}

function withOptionId(option: LegacyCaseOption, baseId: string) {
  return {
    ...option,
    id: `${baseId}__option_${option.level}`,
  };
}

function mapCompetencies(items: LegacyCompetencyDefinition[]) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: COMPETENCY_CATEGORY_MAP[item.id] || "advanced",
  }));
}

function mapMainCases(items: LegacySimCase[]) {
  return items.map((item, index) => {
    const imageAssetId = inferMainCaseAssetId(item);
    return {
      ...item,
      cycles: item.cycles.map((cycle) => ({
        ...cycle,
        id: `${item.id}__cycle_${cycle.cycle}`,
        options: cycle.options.map((option) =>
          withOptionId(option, `${item.id}__cycle_${cycle.cycle}`),
        ),
      })),
      imageAssetId,
      imageUrl: assetUrlById(imageAssetId),
      timing: null,
      sortOrder: index + 1,
      isActive: true,
    };
  });
}

function mapEmailCases(items: LegacyEmailCase[]) {
  const imageAssetId = "asset-signal-email";
  return items.map((item, index) => ({
    ...item,
    options: item.options.map((option) => withOptionId(option, item.id)),
    imageAssetId,
    imageUrl: assetUrlById(imageAssetId),
    timing: {
      arrivalMinute: item.arrivalMinute,
      reminderIntervalSeconds: DEFAULT_SETTINGS.reminderIntervalSeconds,
    },
    sortOrder: index + 1,
    isActive: true,
  }));
}

function mapMessengerChats(items: LegacyMessengerChat[]) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }));
}

function mapMessengerCases(items: LegacyMessengerCase[]) {
  const imageAssetId = "asset-signal-messenger";
  return items.map((item, index) => ({
    ...item,
    options: item.options.map((option) => withOptionId(option, item.id)),
    imageAssetId,
    imageUrl: assetUrlById(imageAssetId),
    timing: {
      arrivalMinute: item.arrivalMinute,
      reminderIntervalSeconds: DEFAULT_SETTINGS.reminderIntervalSeconds,
    },
    sortOrder: index + 1,
    isActive: true,
  }));
}

function mapVideoCases(items: LegacyVideoCase[]) {
  const imageAssetId = "asset-signal-video";
  return items.map((item, index) => ({
    ...item,
    options: item.options.map((option) => withOptionId(option, item.id)),
    imageAssetId,
    imageUrl: assetUrlById(imageAssetId),
    timing: {
      arrivalMinute: item.arrivalMinute,
      reminderIntervalSeconds: DEFAULT_SETTINGS.reminderIntervalSeconds,
    },
    sortOrder: index + 1,
    isActive: true,
  }));
}

function loadLegacyModules(sourcePath: string) {
  const casesModule = evaluateLegacyModule<{ CASES_DATA: LegacySimCase[] }>(
    readLegacyFile(sourcePath, DATA_FILE_SUFFIXES.cases),
    DATA_FILE_SUFFIXES.cases,
  );
  const emailCasesModule = evaluateLegacyModule<{ EMAIL_CASES: LegacyEmailCase[] }>(
    readLegacyFile(sourcePath, DATA_FILE_SUFFIXES.emailCases),
    DATA_FILE_SUFFIXES.emailCases,
  );
  const messengerCasesModule = evaluateLegacyModule<{
    CHATS: LegacyMessengerChat[];
    MESSENGER_CASES: LegacyMessengerCase[];
  }>(
    readLegacyFile(sourcePath, DATA_FILE_SUFFIXES.messengerCases),
    DATA_FILE_SUFFIXES.messengerCases,
  );
  const videoCasesModule = evaluateLegacyModule<{ VIDEO_CASES: LegacyVideoCase[] }>(
    readLegacyFile(sourcePath, DATA_FILE_SUFFIXES.videoCases),
    DATA_FILE_SUFFIXES.videoCases,
  );
  const competenciesModule = evaluateLegacyModule<{ COMPETENCIES: LegacyCompetencyDefinition[] }>(
    readLegacyFile(sourcePath, DATA_FILE_SUFFIXES.competencies),
    DATA_FILE_SUFFIXES.competencies,
  );

  return {
    cases: casesModule.CASES_DATA || [],
    emailCases: emailCasesModule.EMAIL_CASES || [],
    messengerChats: messengerCasesModule.CHATS || [],
    messengerCases: messengerCasesModule.MESSENGER_CASES || [],
    videoCases: videoCasesModule.VIDEO_CASES || [],
    competencies: competenciesModule.COMPETENCIES || [],
  };
}

function buildBootstrapContent(sourcePath: string): BootstrapContent {
  const legacy = loadLegacyModules(sourcePath);

  return {
    settings: DEFAULT_SETTINGS,
    competencies: mapCompetencies(legacy.competencies),
    assets: DEFAULT_ASSETS,
    cases: mapMainCases(legacy.cases),
    messengerChats: mapMessengerChats(legacy.messengerChats),
    emailCases: mapEmailCases(legacy.emailCases),
    messengerCases: mapMessengerCases(legacy.messengerCases),
    videoCases: mapVideoCases(legacy.videoCases),
  };
}

function main() {
  const sourcePath = process.argv[2];
  const outputPath = process.argv[3] || path.resolve("script/bootstrap-content.json");

  if (!sourcePath) {
    throw new Error(
      "Укажите путь до старого исходника или архива первым аргументом. " +
      'Пример: npm run db:generate-bootstrap -- "C:\\Users\\you\\Downloads\\dns-simcenter-working-source.tar.gz"',
    );
  }

  const resolvedSourcePath = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedSourcePath)) {
    throw new Error(`Legacy source path not found: ${resolvedSourcePath}`);
  }

  const content = buildBootstrapContent(resolvedSourcePath);
  const resolvedOutputPath = path.resolve(outputPath);

  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, JSON.stringify(content, null, 2), "utf-8");

  console.log(
    [
      `bootstrap-content.json created: ${resolvedOutputPath}`,
      `Main cases: ${content.cases.length}`,
      `Email cases: ${content.emailCases.length}`,
      `Messenger cases: ${content.messengerCases.length}`,
      `Video cases: ${content.videoCases.length}`,
      `Messenger chats: ${content.messengerChats.length}`,
      `Competencies: ${content.competencies.length}`,
    ].join("\n"),
  );
}

main();
