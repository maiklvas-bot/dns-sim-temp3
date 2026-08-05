import assert from "node:assert/strict";
import { CORRECTED_CASES } from "../shared/corrected-cases";
import { validateCase } from "../shared/case-validation";
import { contentStorage } from "../server/content-storage";

/**
 * Контракт кейсов-исправлений.
 *
 * Смысл исправления в том, что дефект действительно устранён и что автору
 * видно, какой именно. Поэтому проверяется и результат (дубль чист), и
 * объяснение (журнал покрывает каждый тип замечаний оригинала).
 */

const originals = new Map(
  (contentStorage.getPublicContent(true).cases as { id: string }[]).map((item) => [item.id, item]),
);

assert.ok(CORRECTED_CASES.length > 0, "должен быть хотя бы один кейс-исправление");

for (const corrected of CORRECTED_CASES) {
  const label = corrected.id;

  // 1. Дубль ссылается на существующий оригинал и не подменяет его.
  const original = originals.get(corrected.correctionOfCaseId);
  assert.ok(original, `${label}: оригинал ${corrected.correctionOfCaseId} не найден среди кейсов`);
  assert.notEqual(corrected.id, corrected.correctionOfCaseId, `${label}: дубль не может иметь id оригинала`);
  assert.ok(
    corrected.title.trim().endsWith("— исправление"),
    `${label}: название исправленного кейса должно заканчиваться на «— исправление»`,
  );

  // 2. Дубль проходит автопроверку начисто — иначе это не исправление.
  const issues = validateCase(corrected);
  assert.deepEqual(
    issues.map((issue) => `${issue.check}: ${issue.message}`),
    [],
    `${label}: исправленный кейс обязан проходить автопроверку без замечаний`,
  );

  // 3. Журнал объясняет каждый тип замечаний, который был у оригинала.
  const originalIssues = validateCase(original as Parameters<typeof validateCase>[0]);
  const originalChecks = new Set(originalIssues.map((issue) => issue.check));
  const explainedChecks = new Set(corrected.corrections.map((item) => item.check));
  for (const check of originalChecks) {
    assert.ok(
      explainedChecks.has(check),
      `${label}: в журнале нет объяснения по проверке "${check}", хотя оригинал её не проходил`,
    );
  }

  // 4. Каждая запись журнала заполнена содержательно: пустое «было/стало» ничего не объясняет.
  assert.ok(corrected.corrections.length > 0, `${label}: журнал исправлений пуст`);
  corrected.corrections.forEach((item, index) => {
    // scope — короткая метка места («Паспорт кейса»), от неё объяснения не требуется.
    assert.ok(
      typeof item.scope === "string" && item.scope.trim().length >= 6,
      `${label}: запись журнала №${index + 1}, поле "scope" — не указано место правки`,
    );
    for (const [field, value] of Object.entries({ was: item.was, became: item.became, why: item.why })) {
      assert.ok(
        typeof value === "string" && value.trim().length >= 20,
        `${label}: запись журнала №${index + 1}, поле "${field}" — слишком короткое, чтобы что-то объяснить`,
      );
    }
    assert.notEqual(
      item.was.trim(),
      item.became.trim(),
      `${label}: запись журнала №${index + 1} — «было» и «стало» совпадают, правки нет`,
    );
  });

  // 5. Паспорт заполнен: ради него исправление во многом и делалось.
  assert.ok((corrected.businessProblem || "").trim().length > 0, `${label}: не заполнена бизнес-проблема`);
  assert.ok((corrected.hiddenCause || "").trim().length > 0, `${label}: не заполнена скрытая причина`);
  assert.ok((corrected.dataPoints || []).length > 0, `${label}: нет данных для запроса`);
  assert.ok((corrected.falseTrails || []).length > 0, `${label}: нет ложных следов`);

  // 6. Оригинал не тронут: он и должен оставаться таким, каким был.
  assert.ok(
    originalIssues.length > 0,
    `${label}: у оригинала ${corrected.correctionOfCaseId} нет замечаний — исправлять нечего`,
  );
}

// 7. Один оригинал — одно исправление, иначе непонятно, какое из них показывать.
const byOriginal = new Map<string, number>();
for (const corrected of CORRECTED_CASES) {
  byOriginal.set(corrected.correctionOfCaseId, (byOriginal.get(corrected.correctionOfCaseId) || 0) + 1);
}
for (const [originalId, count] of byOriginal) {
  assert.equal(count, 1, `у кейса ${originalId} больше одного исправления (${count})`);
}

console.log(`corrected-cases parity checks passed (${CORRECTED_CASES.length} исправленных кейсов)`);
