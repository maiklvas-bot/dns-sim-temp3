import type { IncomingMessage } from "node:http";
import type { LiveSimulationSessionState } from "@shared/live-session";
import { parseStaffUpgradeSession } from "./staff-session";
import type { StaffPrincipal } from "./staff-storage";

export type LiveSocketContext =
  | { liveSessionId: string; role: "student" }
  | { liveSessionId: string; role: "assessor"; staff: StaffPrincipal };

type AuthorizationResult =
  | { ok: true; context: LiveSocketContext }
  | { ok: false; status: 401 | 403 | 404 };

function normalizeAccessCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function authorizeLiveSocket(
  request: IncomingMessage,
  getSession: (liveSessionId: string) => LiveSimulationSessionState | null,
): Promise<AuthorizationResult> {
  const targetUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const liveSessionId = targetUrl.searchParams.get("liveSessionId") || "";
  const role = targetUrl.searchParams.get("role");
  const session = liveSessionId ? getSession(liveSessionId) : null;
  if (!session || (role !== "student" && role !== "assessor")) {
    return { ok: false, status: 404 };
  }

  if (role === "student") {
    const accessCode = normalizeAccessCode(targetUrl.searchParams.get("accessCode") || "");
    if (!accessCode) {
      return { ok: false, status: 401 };
    }
    if (accessCode !== session.config.accessCode) {
      return { ok: false, status: 403 };
    }
    return { ok: true, context: { liveSessionId, role } };
  }

  const staff = await parseStaffUpgradeSession(request);
  if (!staff) {
    return { ok: false, status: 401 };
  }
  return { ok: true, context: { liveSessionId, role, staff } };
}
