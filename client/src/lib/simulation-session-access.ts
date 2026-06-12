const SIMULATION_CREDENTIAL_KEY = "dns-simcenter.simulation-session";
const SIMULATION_TOKEN_HEADER = "X-Simulation-Token";

interface SimulationSessionCredential {
  sessionId: number;
  token: string;
}

function getSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function readSimulationSessionCredential(): SimulationSessionCredential | null {
  const storage = getSessionStorage();
  const raw = storage?.getItem(SIMULATION_CREDENTIAL_KEY);
  if (!raw) {
    return null;
  }

  try {
    const credential = JSON.parse(raw) as Partial<SimulationSessionCredential>;
    if (!Number.isSafeInteger(credential.sessionId) || typeof credential.token !== "string" || !credential.token) {
      storage?.removeItem(SIMULATION_CREDENTIAL_KEY);
      return null;
    }
    return credential as SimulationSessionCredential;
  } catch {
    storage?.removeItem(SIMULATION_CREDENTIAL_KEY);
    return null;
  }
}

export function setSimulationSessionCredential(sessionId: number, token: string) {
  if (!Number.isSafeInteger(sessionId) || !token) {
    throw new Error("Invalid simulation session credential");
  }

  getSessionStorage()?.setItem(
    SIMULATION_CREDENTIAL_KEY,
    JSON.stringify({ sessionId, token } satisfies SimulationSessionCredential),
  );
}

export function getSimulationSessionToken(sessionId: number): string | null {
  const credential = readSimulationSessionCredential();
  return credential?.sessionId === sessionId ? credential.token : null;
}

export function buildSimulationAccessHeaders(sessionId: number): Record<string, string> {
  const token = getSimulationSessionToken(sessionId);
  return token ? { [SIMULATION_TOKEN_HEADER]: token } : {};
}

export function clearSimulationSessionCredential() {
  getSessionStorage()?.removeItem(SIMULATION_CREDENTIAL_KEY);
}
