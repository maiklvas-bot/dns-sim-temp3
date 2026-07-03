import { useState } from "react";
import { useLocation } from "wouter";
import { Play, Info, KeyRound, BookOpen } from "lucide-react";
import { RRS_IDS } from "@shared/zrd/match-types";
import { createZrdMatch, joinZrdMatch } from "../../zrd-match-api";

interface Props {
  onJoinCode: (code: string) => void;
  onAdoptSeat: (matchId: number, seatIdx: number, token: string) => void;
  loading: boolean;
  error: string | null;
}

/**
 * Лобби матча: вход по коду места (выдаёт оценщик) — основной путь.
 * Демо-матч (1 человек + 3 ИИ) — быстрый старт для сотрудников (нужен вход staff).
 */
export function ZrdLobby({ onJoinCode, onAdoptSeat, loading, error }: Props) {
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const startDemo = async () => {
    setDemoBusy(true); setDemoError(null);
    try {
      const created = await createZrdMatch({
        scenario: "conquest",
        difficulty: 3,
        winMode: "year",
        missionMode: "auto",
        swanFrequency: "standard",
        minutesPerTick: 6,
        seats: RRS_IDS.map((rrsId, i) => (i === 0
          ? { rrsId, controller: "human" as const, participantName: "Демо-игрок" }
          : { rrsId, controller: "ai" as const, aiLevel: 3 as const })),
      });
      const humanSeat = created.seats.find((s) => s.controllerKind === "human");
      if (!humanSeat?.accessCode) throw new Error("Код места не получен");
      const joined = await joinZrdMatch(humanSeat.accessCode);
      onAdoptSeat(joined.matchId, joined.seatIdx, joined.token);
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : "Не удалось создать демо-матч (нужен вход сотрудника)");
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="zrd-panel mx-auto max-w-lg p-6">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#FF6B00" }}>Симуляция ЗРД</div>
      <h1 className="mb-1 text-2xl font-extrabold" style={{ color: "var(--zrd-text)" }}>Покорение новых территорий</h1>
      <p className="mb-5 text-sm" style={{ color: "var(--zrd-text-dim)" }}>
        Матч 4 РРС Дивизиона Урал: 4 квартала × 3 месячных такта. За столом — люди и ИИ-управленцы;
        миссии, чёрные лебеди и личные колоды карт. Настраивает и запускает оценщик.
      </p>

      <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: "var(--zrd-text-dim)" }} htmlFor="zrd-code">
        Код входа (выдаёт оценщик)
      </label>
      <div className="mb-3 flex gap-2">
        <input
          id="zrd-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="AB23CD"
          className="flex-1 rounded-lg border px-3 py-2 text-lg font-extrabold tracking-[0.25em]"
          style={{ borderColor: "var(--zrd-border)", background: "var(--zrd-surface-2)", color: "var(--zrd-text)" }}
        />
        <button
          type="button"
          onClick={() => onJoinCode(code.trim())}
          disabled={loading || code.trim().length !== 6}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-50"
          style={{ background: "#FF6B00", cursor: loading ? "wait" : "pointer" }}
        >
          <KeyRound className="h-4 w-4" aria-hidden /> {loading ? "Входим…" : "Войти"}
        </button>
      </div>

      {(error || demoError) && (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(232,90,90,0.14)", color: "#e85a5a" }}>
          {error || demoError}
        </div>
      )}

      <div className="my-4 flex items-center gap-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--zrd-text-dim)" }}>
        <span className="h-px flex-1" style={{ background: "var(--zrd-border)" }} />
        или
        <span className="h-px flex-1" style={{ background: "var(--zrd-border)" }} />
      </div>

      <button
        type="button"
        onClick={startDemo}
        disabled={demoBusy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-base font-bold transition-opacity disabled:opacity-60"
        style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text)", cursor: demoBusy ? "wait" : "pointer" }}
      >
        <Play className="h-5 w-5" aria-hidden /> {demoBusy ? "Создаём демо-матч…" : "Демо-матч: я против 3 ИИ"}
      </button>

      <button
        type="button"
        onClick={() => navigate("/zrd/manual")}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-bold"
        style={{ borderColor: "rgba(255,107,0,0.4)", color: "#FF6B00", cursor: "pointer" }}
      >
        <BookOpen className="h-4 w-4" aria-hidden /> Инструкция к игре (правила, интерфейс, компетенции)
      </button>

      <div className="mt-4 flex items-start gap-2 text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        <span>Боевые партии настраивает оценщик в своём кабинете (карточка «ЗРД») и раздаёт коды/ссылки.
        Демо-матч доступен сотрудникам после служебного входа.</span>
      </div>
    </div>
  );
}
