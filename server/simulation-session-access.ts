import crypto from "node:crypto";

export const SIMULATION_TOKEN_HEADER = "x-simulation-token";

export function createSimulationSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSimulationSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifySimulationSessionToken(
  token: string,
  expectedHash: string | null | undefined,
): boolean {
  if (!token || !expectedHash) {
    return false;
  }

  try {
    const actual = Buffer.from(hashSimulationSessionToken(token), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
