import assert from "node:assert/strict";
import { BARS_OPTIONS, barsLevelForScore, buildCaseDossierSummary } from "../client/src/features/admin/cases/case-editor-support";
import type { SimCase } from "../shared/simulation-content";

// BARS_OPTIONS: ровно четыре ступени, значения совпадают с BARS_LEVEL_SCORES
assert.equal(BARS_OPTIONS.length, 4);
assert.deepEqual(BARS_OPTIONS.map((option) => option.score), [0, 1, 3, 5]);
assert.equal(BARS_OPTIONS[0].label, "Не влияет");
assert.equal(BARS_OPTIONS[1].label, "Слабо");
assert.equal(BARS_OPTIONS[2].label, "Средне");
assert.equal(BARS_OPTIONS[3].label, "Сильно");

// barsLevelForScore: точные попадания
assert.equal(barsLevelForScore(0), "none");
assert.equal(barsLevelForScore(1), "weak");
assert.equal(barsLevelForScore(3), "mid");
assert.equal(barsLevelForScore(5), "strong");
// значения вне шкалы BARS (легаси-данные со слайдера 0-5) не приводятся к ближайшему,
// а помечаются как несоответствующие — иначе автопроверка и UI разошлись бы в оценке
assert.equal(barsLevelForScore(2), "off_scale");
assert.equal(barsLevelForScore(4), "off_scale");
assert.equal(barsLevelForScore(undefined), "none");

const emptyDossier: SimCase = {
  id: "C1",
  title: "T",
  description: "D",
  primaryCompetencies: [],
  secondaryCompetencies: [],
  trigger: { type: "message", source: "S", text: "T" },
  zones_affected: [],
  cycles: [],
  imageAssetId: null,
  imageUrl: null,
  audioAssetId: null,
  audioUrl: null,
  sortOrder: 0,
  isActive: true,
};

// пустой паспорт: ни одно поле не заполнено
const summaryEmpty = buildCaseDossierSummary(emptyDossier);
assert.equal(summaryEmpty.filled, 0);
assert.equal(summaryEmpty.total, 4);
assert.equal(summaryEmpty.isComplete, false);
assert.deepEqual(summaryEmpty.missing, ["businessProblem", "hiddenCause", "dataPoints", "falseTrails"]);

// частично заполненный: пробелы не считаются заполнением
const summaryPartial = buildCaseDossierSummary({
  ...emptyDossier,
  businessProblem: "Очередь на кассе растёт",
  hiddenCause: "   ",
  dataPoints: [{ label: "Отчёт по смене" }],
  falseTrails: [],
});
assert.equal(summaryPartial.filled, 2);
assert.equal(summaryPartial.isComplete, false);
assert.deepEqual(summaryPartial.missing, ["hiddenCause", "falseTrails"]);

// полностью заполненный
const summaryFull = buildCaseDossierSummary({
  ...emptyDossier,
  businessProblem: "Очередь растёт",
  hiddenCause: "Не хватает людей на выдаче",
  dataPoints: [{ label: "Отчёт по смене", costToRequest: "2 минуты" }],
  falseTrails: ["Кажется, что виновата касса"],
});
assert.equal(summaryFull.filled, 4);
assert.equal(summaryFull.isComplete, true);
assert.deepEqual(summaryFull.missing, []);

// Сводка в интерфейсе обязана совпадать с механикой: раньше UI считал заполненным
// массив с пустой строкой, а checkDiagnostics — нет, и автор видел «4 из 4» при
// замечаниях от автопроверки.
const blankRows = buildCaseDossierSummary({
  ...emptyDossier,
  businessProblem: "Очередь растёт",
  hiddenCause: "Не хватает людей",
  dataPoints: [{ label: "   " }],
  falseTrails: [""],
});
assert.equal(blankRows.filled, 2);
assert.equal(blankRows.isComplete, false);
assert.deepEqual(blankRows.missing, ["dataPoints", "falseTrails"]);

const invisibleRows = buildCaseDossierSummary({
  ...emptyDossier,
  businessProblem: "Очередь растёт",
  hiddenCause: "Не хватает людей",
  dataPoints: [{ label: "\u200B" }],
  falseTrails: ["\uFEFF"],
});
assert.equal(invisibleRows.isComplete, false, "невидимые символы не считаются заполнением");

// Достаточно одной содержательной строки среди пустых
const mixedRows = buildCaseDossierSummary({
  ...emptyDossier,
  businessProblem: "Очередь растёт",
  hiddenCause: "Не хватает людей",
  dataPoints: [{ label: "  " }, { label: "Отчёт по смене" }],
  falseTrails: ["", "Кажется, виновата касса"],
});
assert.equal(mixedRows.isComplete, true);

console.log("case-editor-support parity checks passed");
