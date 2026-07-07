/**
 * ЗРД v2 — мастер запуска матча из кабинета оценщика (спека §9).
 * Шаги: сценарий/сложность/режим победы → состав стола (4 РРС) → миссии →
 * чёрные лебеди → темп → создать → экран кодов входа + мини-наблюдение.
 */
import { useEffect, useMemo, useState } from "react";
import {
  X, Play, Copy, Check, Eye, Pause, AlertTriangle, Users, Bot, CircleOff, Crown, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Difficulty } from "@shared/zrd/types";
import type { RrsId, ScenarioId, WinMode, MissionMode, SwanFrequency, AiLevel } from "@shared/zrd/match-types";
import { RRS_IDS, RRS_LABEL } from "@shared/zrd/match-types";
import { SCENARIOS, SCENARIO_IDS } from "@shared/zrd/content-scenarios";
import { MISSION_CATALOG } from "@shared/zrd/content-missions";
import { BLACK_SWANS } from "@shared/zrd/content-swans";
import { AI_LEVEL_LABEL } from "../zrd/zrd-player-scenarios";
import {
  createZrdMatch, fetchObserverView, triggerMatchSwan, setMatchPaused,
  type CreatedMatchSeat, type ObserverResponse,
} from "../zrd/zrd-match-api";

type SeatMode = "human" | "ai" | "off";
interface SeatDraft { rrsId: RrsId; mode: SeatMode; name: string; aiLevel: AiLevel }
const CUSTOM_NAME_OPTION = "__custom__";

const SWAN_FREQ_LABEL: Record<SwanFrequency, string> = {
  off: "Выключены",
  rare: "Редко",
  standard: "Стандарт",
  storm: "Шторм",
};

function joinLink(matchId: number, code: string): string {
  return `${window.location.origin}/?id=${matchId}&seat=${code}#/zrd`;
}

/** Оценщик заводит ФИО участников один раз на шаге 1 («Кто проходит оценку»);
 *  здесь — только выбор из уже введённых имён (плюс ручной ввод как запасной путь). */
export function ZrdLaunchWizard({ onClose, knownNames = [] }: { onClose: () => void; knownNames?: string[] }) {
  const [scenario, setScenario] = useState<ScenarioId>("conquest");
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [winMode, setWinMode] = useState<WinMode>("year");
  const [missionMode, setMissionMode] = useState<MissionMode>("auto");
  const [missionIds, setMissionIds] = useState<string[]>(SCENARIOS.conquest.missionIds);
  const [keyMissionId, setKeyMissionId] = useState<string>(SCENARIOS.conquest.keyMissionId);
  const [swanFrequency, setSwanFrequency] = useState<SwanFrequency>("standard");
  const [minutesPerTick, setMinutesPerTick] = useState(6);
  const [seats, setSeats] = useState<SeatDraft[]>(
    RRS_IDS.map((rrsId, i) => ({ rrsId, mode: i === 0 ? "human" : "ai", name: "", aiLevel: 3 as AiLevel })),
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; seats: CreatedMatchSeat[] } | null>(null);
  // по умолчанию — выбор из имён шага 1; «Другое» переключает конкретное место на ручной ввод
  const [customNameSeats, setCustomNameSeats] = useState<Record<number, boolean>>({});

  // выбор сценария подтягивает его дефолты (режим победы, лебеди, авто-миссии)
  const pickScenario = (id: ScenarioId) => {
    const sc = SCENARIOS[id];
    setScenario(id);
    setWinMode(sc.winModeDefault);
    setSwanFrequency(sc.swanFrequencyDefault);
    setMissionIds(sc.missionIds);
    setKeyMissionId(sc.keyMissionId);
  };

  const toggleMission = (id: string) => {
    setMissionIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!next.includes(keyMissionId) && next.length > 0) setKeyMissionId(next[0]);
      return next;
    });
  };

  const updateSeat = (idx: number, patch: Partial<SeatDraft>) =>
    setSeats((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const activeSeats = seats.filter((s) => s.mode !== "off").length;
  const humanSeats = seats.filter((s) => s.mode === "human");
  const canCreate = activeSeats >= 1
    && (missionMode === "auto" || missionIds.length > 0)
    && humanSeats.every((s) => s.name.trim().length > 0);

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const result = await createZrdMatch({
        scenario,
        difficulty,
        winMode,
        missionMode,
        missionIds: missionMode === "manual" ? missionIds : undefined,
        keyMissionId: winMode === "race" ? keyMissionId : undefined,
        swanFrequency,
        minutesPerTick,
        seats: seats.map((s) => ({
          rrsId: s.rrsId,
          controller: s.mode,
          participantName: s.mode === "human" ? s.name.trim() : undefined,
          aiLevel: s.mode === "ai" ? s.aiLevel : undefined,
        })),
      });
      setCreated(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать матч");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(8,12,22,0.7)", backdropFilter: "blur(4px)" }} role="dialog" aria-modal="true" aria-label="Запуск симуляции ЗРД">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border" style={{ background: "#101725", borderColor: "rgba(255,255,255,0.09)" }}>
        <header className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(255,107,0,0.14)", color: "#FF6B00" }}>
            <Play className="h-4 w-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <div className="text-base font-extrabold text-white">Запуск матча ЗРД</div>
            <div className="text-xs text-white/50">
              Институт ЗРД · Покорение новых территорий · 4 квартала (12 месячных тактов) ·{" "}
              <a href="/#/zrd/manual" target="_blank" rel="noreferrer" style={{ color: "#FF6B00", textDecoration: "underline" }}>инструкция к игре</a>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="ml-auto rounded-lg border p-1.5 text-white/60" style={{ borderColor: "rgba(255,255,255,0.12)", cursor: "pointer" }}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {!created ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            {/* Шаг 1 — сценарий, сложность, режим победы */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/45">1 · Сценарий</h3>
              <div className="grid grid-cols-2 gap-2">
                {SCENARIO_IDS.map((id) => {
                  const sc = SCENARIOS[id];
                  const active = scenario === id;
                  return (
                    <button key={id} type="button" onClick={() => pickScenario(id)} aria-pressed={active}
                      className="rounded-xl border p-3 text-left transition-colors"
                      style={active
                        ? { borderColor: "#FF6B00", background: "rgba(255,107,0,0.1)", cursor: "pointer" }
                        : { borderColor: "rgba(255,255,255,0.1)", cursor: "pointer" }}>
                      <div className="text-sm font-bold text-white">{sc.title}</div>
                      <div className="mt-0.5 text-[11px] text-white/50">{sc.tagline}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-white/45">Сложность</div>
                  <div className="flex gap-1" role="group" aria-label="Сложность">
                    {([1, 2, 3, 4, 5] as Difficulty[]).map((l) => (
                      <button key={l} type="button" onClick={() => setDifficulty(l)} aria-pressed={difficulty === l}
                        className="h-8 w-8 rounded-lg border text-sm font-bold"
                        style={difficulty === l
                          ? { borderColor: "#FF6B00", background: "rgba(255,107,0,0.14)", color: "#FF6B00", cursor: "pointer" }
                          : { borderColor: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-white/45">Режим победы</div>
                  <div className="flex gap-1" role="group" aria-label="Режим победы">
                    {([
                      ["year", "По итогам года"],
                      ["race", "Гонка к цели"],
                    ] as [WinMode, string][]).map(([mode, label]) => (
                      <button key={mode} type="button" onClick={() => setWinMode(mode)} aria-pressed={winMode === mode}
                        className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
                        style={winMode === mode
                          ? { borderColor: "#FF6B00", background: "rgba(255,107,0,0.14)", color: "#FF6B00", cursor: "pointer" }
                          : { borderColor: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer" }}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Шаг 2 — состав стола */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/45">2 · Состав стола (4 РРС)</h3>
              <div className="space-y-2">
                {seats.map((seat, i) => {
                  const useCustomInput = knownNames.length === 0 || customNameSeats[i];
                  return (
                  <div key={seat.rrsId} className="flex flex-col gap-1.5 rounded-xl border p-2.5" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-44 text-sm font-bold text-white">{RRS_LABEL[seat.rrsId]}</div>
                      <div className="flex gap-1" role="group" aria-label={`Контроллер ${RRS_LABEL[seat.rrsId]}`}>
                        {([
                          ["human", "Человек", <Users key="h" className="h-3.5 w-3.5" aria-hidden />],
                          ["ai", "ИИ", <Bot key="a" className="h-3.5 w-3.5" aria-hidden />],
                          ["off", "Пусто", <CircleOff key="o" className="h-3.5 w-3.5" aria-hidden />],
                        ] as [SeatMode, string, React.ReactNode][]).map(([mode, label, icon]) => (
                          <button key={mode} type="button" onClick={() => updateSeat(i, { mode })} aria-pressed={seat.mode === mode}
                            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                            style={seat.mode === mode
                              ? { borderColor: "#FF6B00", background: "rgba(255,107,0,0.14)", color: "#FF6B00", cursor: "pointer" }
                              : { borderColor: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer" }}>{icon}{label}</button>
                        ))}
                      </div>
                      {seat.mode === "human" && (
                        useCustomInput ? (
                          <input
                            value={seat.name}
                            onChange={(e) => updateSeat(i, { name: e.target.value })}
                            placeholder="Имя участника"
                            aria-label={`Имя участника ${RRS_LABEL[seat.rrsId]}`}
                            className="min-w-[220px] flex-1 rounded-lg border px-2.5 py-1.5 text-sm text-white"
                            style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)" }}
                          />
                        ) : (
                          <select
                            value={knownNames.includes(seat.name) ? seat.name : ""}
                            onChange={(e) => {
                              if (e.target.value === CUSTOM_NAME_OPTION) {
                                setCustomNameSeats((cur) => ({ ...cur, [i]: true }));
                                updateSeat(i, { name: "" });
                              } else {
                                updateSeat(i, { name: e.target.value });
                              }
                            }}
                            aria-label={`Имя участника ${RRS_LABEL[seat.rrsId]}`}
                            className="min-w-[220px] flex-1 rounded-lg border px-2.5 py-1.5 text-sm text-white"
                            style={{ borderColor: "rgba(255,255,255,0.14)", background: "#131b2b", cursor: "pointer" }}>
                            <option value="" disabled>— выбрать имя участника —</option>
                            {knownNames.map((n) => <option key={n} value={n}>{n}</option>)}
                            <option value={CUSTOM_NAME_OPTION}>Другое (ввести вручную)…</option>
                          </select>
                        )
                      )}
                      {seat.mode === "ai" && (
                        <label className="flex items-center gap-2 text-xs text-white/60">
                          Уровень
                          <select
                            value={seat.aiLevel}
                            onChange={(e) => updateSeat(i, { aiLevel: Number(e.target.value) as AiLevel })}
                            className="rounded-lg border px-2 py-1.5 text-sm text-white"
                            style={{ borderColor: "rgba(255,255,255,0.14)", background: "#131b2b", cursor: "pointer" }}>
                            {([1, 2, 3, 4, 5] as AiLevel[]).map((l) => (
                              <option key={l} value={l}>{l} — {AI_LEVEL_LABEL[l]}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    {/* фигурку и корпоративную почту участник укажет САМ при входе по коду — оценщик задаёт только настройки */}
                    {seat.mode === "human" && (
                      <span className="text-[10px] text-white/40">Фигурку и почту для связи участник укажет сам при входе по коду</span>
                    )}
                  </div>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-white/40">Любые комбинации: соло против ИИ, люди друг против друга, часть столов можно оставить пустыми.</p>
            </section>

            {/* Шаг 3 — миссии */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/45">3 · Миссии</h3>
              <div className="mb-2 flex gap-1" role="group" aria-label="Режим миссий">
                {([["auto", "Автоматически (по сценарию)"], ["manual", "Вручную"]] as [MissionMode, string][]).map(([mode, label]) => (
                  <button key={mode} type="button" onClick={() => setMissionMode(mode)} aria-pressed={missionMode === mode}
                    className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
                    style={missionMode === mode
                      ? { borderColor: "#FF6B00", background: "rgba(255,107,0,0.14)", color: "#FF6B00", cursor: "pointer" }
                      : { borderColor: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer" }}>{label}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {MISSION_CATALOG.map((m) => {
                  const checked = missionIds.includes(m.id);
                  const isKey = winMode === "race" && keyMissionId === m.id;
                  const disabled = missionMode === "auto";
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                      style={{ borderColor: checked ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)", opacity: disabled && !checked ? 0.45 : 1 }}>
                      <input
                        type="checkbox"
                        id={`zrd-m-${m.id}`}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleMission(m.id)}
                        style={{ cursor: disabled ? "default" : "pointer" }}
                      />
                      <label htmlFor={`zrd-m-${m.id}`} className="flex-1 text-xs text-white" style={{ cursor: disabled ? "default" : "pointer" }}>
                        {m.label}
                        <span className="ml-1 text-white/40">до {m.quarterTargets[3]}%</span>
                      </label>
                      {winMode === "race" && checked && (
                        <button type="button" onClick={() => setKeyMissionId(m.id)} aria-pressed={isKey} aria-label={`Ключевая миссия: ${m.label}`}
                          title="Сделать ключевой (гонка)"
                          className="rounded p-0.5"
                          style={{ color: isKey ? "#f0b429" : "rgba(255,255,255,0.25)", cursor: "pointer" }}>
                          <Crown className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {winMode === "race" && <p className="mt-1.5 text-[11px] text-white/40">Режим «Гонка»: побеждает первый, кто выполнит миссию с короной.</p>}
            </section>

            {/* Шаг 4 — чёрные лебеди */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/45">4 · Чёрные лебеди</h3>
              <div className="flex gap-1" role="group" aria-label="Частота чёрных лебедей">
                {(Object.keys(SWAN_FREQ_LABEL) as SwanFrequency[]).map((f) => (
                  <button key={f} type="button" onClick={() => setSwanFrequency(f)} aria-pressed={swanFrequency === f}
                    className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
                    style={swanFrequency === f
                      ? { borderColor: f === "storm" ? "#e85a5a" : "#FF6B00", background: f === "storm" ? "rgba(232,90,90,0.14)" : "rgba(255,107,0,0.14)", color: f === "storm" ? "#e85a5a" : "#FF6B00", cursor: "pointer" }
                      : { borderColor: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer" }}>{SWAN_FREQ_LABEL[f]}</button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-white/40">
                Редкие сильные риски: локальные бьют по одной РРС, глобальные — по всем. Во время матча лебедя можно запустить вручную из наблюдения.
              </p>
            </section>

            {/* Шаг 5 — темп */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/45">5 · Темп партии</h3>
              <label className="flex items-center gap-3 text-sm text-white">
                Минут на такт (месяц)
                <input
                  type="range" min={2} max={15} value={minutesPerTick}
                  onChange={(e) => setMinutesPerTick(Number(e.target.value))}
                  aria-label="Минут на такт"
                  style={{ cursor: "pointer" }}
                />
                <span className="w-28 font-bold" style={{ color: "#FF6B00" }}>{minutesPerTick} мин</span>
              </label>
              <p className="mt-1 text-[11px] text-white/40">12 тактов × {minutesPerTick} мин ≈ {Math.round(12 * minutesPerTick / 60 * 10) / 10} ч игрового времени. Не походившие к дедлайну пропускают ход.</p>
            </section>

            {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(232,90,90,0.14)", color: "#e85a5a" }}>{error}</div>}
          </div>
        ) : (
          <ZrdMatchCodesAndMonitor matchId={created.id} seats={created.seats} />
        )}

        <footer className="flex items-center gap-2 border-t px-5 py-3.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {!created ? (
            <>
              <span className="text-[11px] text-white/40">Активных столов: {activeSeats} · Людей: {humanSeats.length}</span>
              <Button type="button" className="dns-assessor-v2-primary ml-auto" onClick={handleCreate} disabled={!canCreate || creating}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Play className="mr-2 h-4 w-4" aria-hidden />}
                {creating ? "Создаём матч…" : "Создать матч"}
              </Button>
            </>
          ) : (
            <Button type="button" className="dns-assessor-v2-primary ml-auto" onClick={onClose}>Готово</Button>
          )}
        </footer>
      </div>
    </div>
  );
}

/** Экран после создания: коды входа + мини-наблюдение (поллинг observer-view) */
function ZrdMatchCodesAndMonitor({ matchId, seats }: { matchId: number; seats: CreatedMatchSeat[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [obs, setObs] = useState<ObserverResponse | null>(null);
  const [swanId, setSwanId] = useState(BLACK_SWANS[0].id);
  const [swanTarget, setSwanTarget] = useState<RrsId | "all">("all");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchObserverView(matchId);
        if (alive) setObs(data);
      } catch { /* повторим на следующем тике */ }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [matchId]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard недоступен */ }
  };

  const humanSeats = useMemo(() => seats.filter((s) => s.controllerKind === "human"), [seats]);

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/45">Коды входа участников</h3>
        {humanSeats.length === 0 && <p className="text-sm text-white/50">Людей за столом нет — матч играют ИИ. Наблюдайте ниже.</p>}
        <div className="space-y-2">
          {humanSeats.map((s) => (
            <div key={s.seatIdx} className="flex flex-wrap items-center gap-2 rounded-xl border p-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="w-44">
                <div className="text-sm font-bold text-white">{s.participantName}</div>
                <div className="text-[11px] text-white/45">{RRS_LABEL[s.rrsId]}</div>
              </div>
              <code className="rounded-lg px-3 py-1.5 text-lg font-extrabold tracking-[0.2em]" style={{ background: "rgba(255,107,0,0.12)", color: "#FF6B00" }}>{s.accessCode}</code>
              <button type="button" onClick={() => copy(s.accessCode ?? "", `code-${s.seatIdx}`)}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-white/70" style={{ borderColor: "rgba(255,255,255,0.12)", cursor: "pointer" }}>
                {copied === `code-${s.seatIdx}` ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} Код
              </button>
              <button type="button" onClick={() => copy(joinLink(matchId, s.accessCode ?? ""), `link-${s.seatIdx}`)}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-white/70" style={{ borderColor: "rgba(255,255,255,0.12)", cursor: "pointer" }}>
                {copied === `link-${s.seatIdx}` ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} Ссылка
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/45">
          <Eye className="h-3.5 w-3.5" aria-hidden /> Наблюдение
          {obs && <span className="ml-auto text-[11px] font-normal normal-case text-white/40">Кв {obs.observer.quarter} · Месяц {obs.observer.tick}/12 · {obs.status === "completed" ? "завершён" : obs.paused ? "пауза" : "идёт"}</span>}
        </h3>
        {!obs ? (
          <p className="text-sm text-white/50">Загружаем состояние…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {obs.observer.seats.map((s) => (
                <div key={s.seatIdx} className="rounded-xl border p-2.5" style={{ borderColor: "rgba(255,255,255,0.1)", opacity: s.controllerKind === "off" ? 0.45 : 1 }}>
                  <div className="text-[11px] font-bold text-white">{RRS_LABEL[s.rrsId as RrsId]}</div>
                  <div className="text-[10px] text-white/45">{s.name}{s.controllerKind !== "off" && (s.passed ? " · ход сделан" : " · ходит")}</div>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-center">
                    {([["Продажи", s.kpi.sales_growth], ["Сервис", s.kpi.service_level], ["Охват", s.kpi.market_coverage]] as [string, number][]).map(([l, v]) => (
                      <div key={l}>
                        <div className="text-sm font-extrabold" style={{ color: "#FF6B00" }}>{v}%</div>
                        <div className="text-[9px] text-white/40">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {obs.status !== "completed" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#e85a5a" }}>
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Лебедь вручную
                </span>
                <select value={swanId} onChange={(e) => setSwanId(e.target.value)} aria-label="Чёрный лебедь"
                  className="rounded-lg border px-2 py-1.5 text-xs text-white" style={{ borderColor: "rgba(255,255,255,0.14)", background: "#131b2b", cursor: "pointer" }}>
                  {BLACK_SWANS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <select value={swanTarget} onChange={(e) => setSwanTarget(e.target.value as RrsId | "all")} aria-label="Цель лебедя"
                  className="rounded-lg border px-2 py-1.5 text-xs text-white" style={{ borderColor: "rgba(255,255,255,0.14)", background: "#131b2b", cursor: "pointer" }}>
                  <option value="all">Все РРС</option>
                  {RRS_IDS.map((r) => <option key={r} value={r}>{RRS_LABEL[r]}</option>)}
                </select>
                <button type="button"
                  onClick={async () => {
                    setActionMsg(null);
                    try { await triggerMatchSwan(matchId, swanId, swanTarget); setActionMsg("Лебедь запущен"); }
                    catch (e) { setActionMsg(e instanceof Error ? e.message : "Не удалось запустить"); }
                  }}
                  className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: "rgba(232,90,90,0.5)", color: "#e85a5a", cursor: "pointer" }}>
                  Запустить
                </button>
                <button type="button"
                  onClick={async () => {
                    setActionMsg(null);
                    try { await setMatchPaused(matchId, !obs.paused); setActionMsg(obs.paused ? "Возобновлено" : "Пауза"); }
                    catch (e) { setActionMsg(e instanceof Error ? e.message : "Не удалось переключить"); }
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-white/80" style={{ borderColor: "rgba(255,255,255,0.14)", cursor: "pointer" }}>
                  {obs.paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
                  {obs.paused ? "Возобновить" : "Пауза"}
                </button>
                {actionMsg && <span className="text-[11px] text-white/50">{actionMsg}</span>}
              </div>
            )}

            {obs.status === "completed" && obs.results.length > 0 && (
              <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-white/45">Итоги</div>
                {obs.results.map((r) => {
                  const seat = obs.observer.seats.find((s) => s.seatIdx === r.seatIdx);
                  return (
                    <div key={r.seatIdx} className="flex items-center gap-2 py-0.5 text-sm text-white">
                      {r.isWinner && <Crown className="h-4 w-4" style={{ color: "#f0b429" }} aria-hidden />}
                      <span className="font-semibold">{seat ? RRS_LABEL[seat.rrsId as RrsId] : `Место ${r.seatIdx}`}</span>
                      <span className="text-white/50">{seat?.name}</span>
                      <span className="ml-auto font-extrabold" style={{ color: "#FF6B00" }}>ТР {r.tr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
