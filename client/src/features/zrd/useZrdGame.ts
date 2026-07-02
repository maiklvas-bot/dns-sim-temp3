/** ЗРД — хук состояния партии (Фаза 4). Хранит публичное состояние, диспатчит ходы. */
import { useCallback, useEffect, useState } from "react";
import type { PublicZrdState } from "@shared/zrd/engine";
import type { TurnIntent } from "@shared/zrd/types";
import {
  createZrdSession, fetchZrdSession, sendZrdIntent,
  ZrdIntentError, type CreateZrdInput, type ZrdResultView,
} from "./zrd-api";

const STORAGE_KEY = "zrd.session";

interface StoredSession { id: number; token: string | null }

function loadStored(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch { return null; }
}
function saveStored(s: StoredSession | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/** Извлекает id+token из URL. Поддерживает `/?id=1&token=abc#/zrd` и `#/zrd?id=1&token=abc`. */
function readUrlParams(): StoredSession | null {
  const search = window.location.search.startsWith("?") ? window.location.search.slice(1) : "";
  const hash = window.location.hash;
  const hashQ = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const params = new URLSearchParams(search);
  if (hashQ) new URLSearchParams(hashQ).forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
  const id = Number(params.get("id"));
  if (!id) return null;
  return { id, token: params.get("token") };
}

export interface ZrdGameApi {
  sessionId: number | null;
  token: string | null;
  state: PublicZrdState | null;
  result: ZrdResultView | null;
  loading: boolean;
  error: string | null;
  rejected: string | null;
  start: (input: CreateZrdInput) => Promise<void>;
  dispatch: (intent: TurnIntent) => Promise<void>;
  reload: () => Promise<void>;
  leave: () => void;
}

export function useZrdGame(): ZrdGameApi {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<PublicZrdState | null>(null);
  const [result, setResult] = useState<ZrdResultView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  const loadSession = useCallback(async (id: number, tok: string | null, silent = false) => {
    setLoading(true); setError(null);
    try {
      const data = await fetchZrdSession(id, tok);
      setSessionId(id); setToken(tok); setState(data.state);
      setResult(data.result);
      saveStored({ id, token: tok });
    } catch (e) {
      // авто-восстановление неудачно (истёкшая/чужая сессия) — тихо чистим и показываем лобби
      if (silent) { saveStored(null); }
      else { setError(e instanceof Error ? e.message : "Ошибка загрузки"); }
    } finally { setLoading(false); }
  }, []);

  // авто-восстановление из URL или sessionStorage (тихо, без пугающего баннера)
  useEffect(() => {
    const fromUrl = readUrlParams();
    const stored = fromUrl ?? loadStored();
    if (stored) void loadSession(stored.id, stored.token, true);
  }, [loadSession]);

  const start = useCallback(async (input: CreateZrdInput) => {
    setLoading(true); setError(null); setRejected(null);
    try {
      const res = await createZrdSession(input);
      setSessionId(res.id); setToken(res.sessionToken); setState(res.state); setResult(null);
      saveStored({ id: res.id, token: res.sessionToken });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать партию");
    } finally { setLoading(false); }
  }, []);

  const dispatch = useCallback(async (intent: TurnIntent) => {
    if (!sessionId) return;
    setRejected(null);
    try {
      const res = await sendZrdIntent(sessionId, intent, token);
      setState(res.state);
      if (res.result) setResult(res.result);
    } catch (e) {
      if (e instanceof ZrdIntentError) setRejected(e.code);
      else setError(e instanceof Error ? e.message : "Ошибка хода");
    }
  }, [sessionId, token]);

  const reload = useCallback(async () => {
    if (sessionId) await loadSession(sessionId, token);
  }, [sessionId, token, loadSession]);

  const leave = useCallback(() => {
    setSessionId(null); setToken(null); setState(null); setResult(null); setError(null);
    saveStored(null);
  }, []);

  return { sessionId, token, state, result, loading, error, rejected, start, dispatch, reload, leave };
}
