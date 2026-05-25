const EMPTY_SUMMARY = "Сформулировать решение по ситуации";

function cleanClause(value: string): string {
  return value
    .replace(/[«»"]/g, "")
    .replace(/\[[^\]]+\]/g, "сотрудник")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIntro(value: string): string {
  return value.replace(
    /^(немедленно|сразу|быстро|кратко|подробно|параллельно|приоритизировать за \d+ секунд|за \d+ минут|за \d+ минуты)\s*:?\s*/i,
    ""
  );
}

export function summarizeOptionText(text: string): string {
  const normalized = normalizeIntro(cleanClause(text));
  if (!normalized) {
    return EMPTY_SUMMARY;
  }

  const clauses = normalized
    .split(/(?<=[.!?;])\s+|:\s+|\s—\s/)
    .map((part) => cleanClause(part))
    .filter(Boolean);

  const summary = clauses.slice(0, 2).join(". ") || normalized;
  if (summary.length <= 150) {
    return summary;
  }

  return `${summary.slice(0, 147).trimEnd()}...`;
}
