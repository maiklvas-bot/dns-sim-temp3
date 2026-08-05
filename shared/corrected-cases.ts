import type { SimCase } from "./simulation-content";
import data from "./corrected-cases-data.json";

/**
 * Кейсы-исправления: пересобранные дубли кейсов, не проходивших автопроверку.
 *
 * Оригинал остаётся нетронутым — дубль ничего в нём не отменяет. Дубль обязан
 * пройти все проверки чисто и обязан объяснить каждую правку в `corrections`:
 * что было, что стало и какое правило этого требует. Иначе исправление
 * неотличимо от «система что-то поменяла», а именно непрозрачность оценки и
 * была причиной, по которой симуляции не верили.
 */
export type CorrectedCase = SimCase & {
  correctionOfCaseId: string;
  corrections: NonNullable<SimCase["corrections"]>;
};

/**
 * В данных описан только смысл кейса. Оформление (медиа, тайминг, порядок) и
 * принятые замечания к исправлению не относятся: их значения одинаковы у всех
 * дублей и проставляются здесь.
 */
type CorrectedCaseSource = Omit<
  CorrectedCase,
  "imageAssetId" | "imageUrl" | "audioAssetId" | "audioUrl" | "timing" | "sortOrder" | "isActive" | "acceptedIssues"
>;

const sources = (data as { corrected: CorrectedCaseSource[] }).corrected;

export const CORRECTED_CASES: ReadonlyArray<CorrectedCase> = sources.map((source) => ({
  ...source,
  imageAssetId: null,
  imageUrl: null,
  audioAssetId: null,
  audioUrl: null,
  timing: null,
  sortOrder: 0,
  // Исправление не участвует в прохождении, пока человек его не включит.
  isActive: false,
  // Принятых замечаний у исправления быть не может: оно проходит проверку начисто.
  acceptedIssues: [],
}));

export function findCorrectedCase(originalCaseId: string): CorrectedCase | undefined {
  return CORRECTED_CASES.find((item) => item.correctionOfCaseId === originalCaseId);
}
