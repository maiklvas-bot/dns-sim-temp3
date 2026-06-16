const REDACTED = "[REDACTED]";
const OMITTED_BINARY = "[BINARY CONTENT OMITTED]";
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "currentpassword",
  "newpassword",
  "confirmpassword",
  "csrftoken",
  "sessiontoken",
  "participanttokenhash",
  "xsimulationtoken",
  "sessionsecret",
  "secret",
  "authorization",
  "cookie",
  "setcookie",
  "accesscode",
]);

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[_-]/g, "");
}

export function sanitizeSensitiveData(value: unknown, key = "", depth = 0): unknown {
  const normalizedKey = normalizeKey(key);
  if (SENSITIVE_KEYS.has(normalizedKey)) {
    return REDACTED;
  }
  if (depth > 10) {
    return "[DEPTH LIMIT]";
  }
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (normalizedKey === "data" && value.length > 256) {
      return OMITTED_BINARY;
    }
    return value.length > 20_000 ? `${value.slice(0, 20_000)}...[TRUNCATED]` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 500).map((item) => sanitizeSensitiveData(item, key, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeSensitiveData(entryValue, entryKey, depth + 1),
      ]),
    );
  }
  return String(value);
}
