import assert from "node:assert/strict";
import {
  buildSimulationAccessHeaders,
  clearSimulationSessionCredential,
  getSimulationSessionToken,
  setSimulationSessionCredential,
} from "../client/src/lib/simulation-session-access";
import {
  persistSimulationState,
  readPersistedSimulationDraft,
} from "../client/src/features/simulation-engine/persistence/simulation-draft-storage";

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

const sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { sessionStorage },
});

clearSimulationSessionCredential();
setSimulationSessionCredential(12, "participant-token");

assert.equal(getSimulationSessionToken(12), "participant-token");
assert.equal(getSimulationSessionToken(13), null);
assert.deepEqual(buildSimulationAccessHeaders(12), {
  "X-Simulation-Token": "participant-token",
});
assert.deepEqual(buildSimulationAccessHeaders(13), {});

persistSimulationState(
  { sessionId: 12, isRunning: true, isPaused: false, isCompleted: false, decisions: [] },
  "student",
  null,
  { persistedAnswerCount: 0, persistedMetricCount: 0, completedSessionKey: null },
);
assert.equal(readPersistedSimulationDraft("student", null)?.state.sessionId, 12);

clearSimulationSessionCredential();
assert.equal(getSimulationSessionToken(12), null);
assert.equal(readPersistedSimulationDraft("student", null), null);

console.log("Client session access checks passed: participant credentials remain session-scoped and gate draft recovery.");
