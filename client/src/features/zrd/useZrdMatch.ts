/**
 * ЗРД v2 — хук состояния матча на клиенте игрока (мультидевайс).
 * Вход: ?id=<matchId>&seat=<КОД>#/zrd (код обменивается на seat-токен) или ручной ввод кода.
 * Синхронизация: лёгкий поллинг /version каждые 3 с → при росте версии перезабор seat-view.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MascotId, SeatIntent, ZrdSeatView } from "@shared/zrd/match-types";
import {
  joinZrdMatch, fetchSeatView, fetchMatchVersion, sendSeatIntent, setZrdMascot, ZrdMatchIntentError,
  type SeatViewResponse,
} from "./zrd-match-api";

const STORAGE_KEY = "zrd.match.seat";
const POLL_MS = 3000;

interface StoredSeat { matchId: number; seatIdx: number; token: string }

function loadStored(): StoredSeat | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSeat) : null;
  } catch { return null; }
}
function saveStored(s: StoredSeat | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * Сохранить место, полученное вне борда (вход по коду с первого экрана /student):
 * useZrdMatch подхватит его из sessionStorage при открытии /#/zrd.
 */
export function storeZrdSeat(matchId: number, seatIdx: number, token: string): void {
  saveStored({ matchId, seatIdx, token });
}

/** Извлекает id+код места из URL: `/?id=1&seat=AB23CD#/zrd` или `#/zrd?id=1&seat=AB23CD`. */
function readUrlJoin(): { matchId: number; code: string } | null {
  const search = window.location.search.startsWith("?") ? window.location.search.slice(1) : "";
  const hash = window.location.hash;
  const hashQ = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const params = new URLSearchParams(search);
  if (hashQ) new URLSearchParams(hashQ).forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
  const matchId = Number(params.get("id"));
  const code = params.get("seat");
  if (!matchId || !code) return null;
  return { matchId, code };
}

export interface ZrdMatchApi {
  view: ZrdSeatView | null;
  deadlineAt: string | null;
  paused: boolean;
  loading: boolean;
  error: string | null;
  rejected: string | null;
  joinByCode: (code: string) => Promise<void>;
  adoptSeat: (matchId: number, seatIdx: number, token: string) => Promise<void>;
  dispatch: (intent: SeatIntent) => Promise<void>;
  chooseMascot: (mascotId: MascotId) => Promise<void>;
  leave: () => void;
}

export function useZrdMatch(): ZrdMatchApi {
  const [seat, setSeat] = useState<StoredSeat | null>(null);
  const [view, setView] = useState<ZrdSeatView | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const versionRef = useRef(-1);

  const applyResponse = useCallback((data: SeatViewResponse) => {
    versionRef.current = data.version;
    setView(data.view);
    setDeadlineAt(data.deadlineAt);
    setPaused(data.paused);
  }, []);

  const loadView = useCallback(async (s: StoredSeat, silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const data = await fetchSeatView(s.matchId, s.seatIdx, s.token);
      setSeat(s);
      saveStored(s);
      applyResponse(data);
    } catch (e) {
      if (silent) saveStored(null);
      else setError(e instanceof Error ? e.message : "Не удалось загрузить матч");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applyResponse]);

  const joinByCode = useCallback(async (code: string) => {
    setLoading(true); setError(null);
    try {
      const joined = await joinZrdMatch(code);
      await loadView({ matchId: joined.matchId, seatIdx: joined.seatIdx, token: joined.token });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Код не найден");
      setLoading(false);
    }
  }, [loadView]);

  /** сесть за место, созданное в этой же сессии (демо-матч оценщика) */
  const adoptSeat = useCallback(async (matchId: number, seatIdx: number, token: string) => {
    await loadView({ matchId, seatIdx, token });
  }, [loadView]);

  // авто-вход: код из URL (обменивается на токен) или сохранённое место
  useEffect(() => {
    const url = readUrlJoin();
    if (url) { void joinByCode(url.code); return; }
    const stored = loadStored();
    if (stored) void loadView(stored, true);
  }, [joinByCode, loadView]);

  // поллинг версии: другие игроки/ИИ/дедлайны двигают матч без наших действий
  useEffect(() => {
    if (!seat || view?.matchEnded) return;
    const t = setInterval(async () => {
      try {
        const v = await fetchMatchVersion(seat.matchId, seat.seatIdx, seat.token);
        setPaused(v.paused);
        setDeadlineAt(v.deadlineAt);
        if (v.version !== versionRef.current) {
          const data = await fetchSeatView(seat.matchId, seat.seatIdx, seat.token);
          applyResponse(data);
        }
      } catch { /* сеть мигнула — следующий тик */ }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [seat, view?.matchEnded, applyResponse]);

  const dispatch = useCallback(async (intent: SeatIntent) => {
    if (!seat) return;
    setRejected(null);
    try {
      const res = await sendSeatIntent(seat.matchId, seat.seatIdx, intent, seat.token);
      versionRef.current = res.version;
      setView(res.view);
    } catch (e) {
      if (e instanceof ZrdMatchIntentError) setRejected(e.code);
      else setError(e instanceof Error ? e.message : "Ошибка хода");
    }
  }, [seat]);

  /** выбор фигурки игроком при входе (до выбора борд показывает экран выбора) */
  const chooseMascot = useCallback(async (mascotId: MascotId) => {
    if (!seat) return;
    try {
      const res = await setZrdMascot(seat.matchId, seat.seatIdx, mascotId, seat.token);
      versionRef.current = res.version;
      setView(res.view);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выбрать фигурку");
    }
  }, [seat]);

  const leave = useCallback(() => {
    setSeat(null); setView(null); setError(null); setRejected(null);
    versionRef.current = -1;
    saveStored(null);
  }, []);

  return { view, deadlineAt, paused, loading, error, rejected, joinByCode, adoptSeat, dispatch, chooseMascot, leave };
}
