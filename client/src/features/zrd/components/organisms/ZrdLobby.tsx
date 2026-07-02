import { useState } from "react";
import { Play, Info } from "lucide-react";
import type { Difficulty } from "@shared/zrd/types";
import { DIFFICULTY_CONFIGS } from "@shared/zrd/content";
import { ZRD_RRS, getRrsById } from "@shared/zrd/regions";
import type { CreateZrdInput } from "../../zrd-api";

const LEVELS: Difficulty[] = [1, 2, 3, 4, 5];

export function ZrdLobby({ onStart, loading, error }: { onStart: (input: CreateZrdInput) => void; loading: boolean; error: string | null }) {
  const [name, setName] = useState("Игрок");
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [rrsId, setRrsId] = useState(ZRD_RRS[0].id);
  const cfg = DIFFICULTY_CONFIGS[difficulty];

  return (
    <div className="zrd-panel mx-auto max-w-lg p-6">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#FF6B00" }}>Симуляция ЗРД</div>
      <h1 className="mb-1 text-2xl font-extrabold" style={{ color: "var(--zrd-text)" }}>Покорение новых территорий</h1>
      <p className="mb-5 text-sm" style={{ color: "var(--zrd-text-dim)" }}>
        Развейте торговый регион за 4 квартала: открывайте точки, вкладывайтесь в команду и технологии,
        реагируйте на кризисы. Соперник — компьютер.
      </p>

      <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: "var(--zrd-text-dim)" }} htmlFor="zrd-name">Имя игрока</label>
      <input id="zrd-name" value={name} onChange={(e) => setName(e.target.value)} className="mb-4 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--zrd-border)", background: "var(--zrd-surface-2)", color: "var(--zrd-text)" }} />

      <div className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--zrd-text-dim)" }}>Сложность</div>
      <div className="mb-2 flex gap-2" role="group" aria-label="Уровень сложности">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setDifficulty(l)}
            aria-pressed={difficulty === l}
            className="flex-1 rounded-lg border py-2 text-sm font-bold transition-colors"
            style={difficulty === l
              ? { borderColor: "#FF6B00", background: "rgba(255,107,0,0.14)", color: "#FF6B00", cursor: "pointer" }
              : { borderColor: "var(--zrd-border)", color: "var(--zrd-text)", cursor: "pointer" }}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="mb-4 text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>
        Старт капитала {cfg.startResources.capital}, доход {cfg.startProd.capital}/кв, {cfg.actionsPerQuarter} действия/квартал,
        наказание событий ×{cfg.penaltyMultiplier}.
      </p>

      <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: "var(--zrd-text-dim)" }} htmlFor="zrd-region">РРС (Дивизион Урал)</label>
      <select
        id="zrd-region"
        value={rrsId}
        onChange={(e) => setRrsId(e.target.value)}
        className="mb-5 w-full rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--zrd-border)", background: "var(--zrd-surface-2)", color: "var(--zrd-text)", cursor: "pointer" }}
      >
        {ZRD_RRS.map((r) => (
          <option key={r.id} value={r.id}>{r.name} · рекоменд. сложность {r.difficultyHint}</option>
        ))}
      </select>

      {error && (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(232,90,90,0.14)", color: "#e85a5a" }}>{error}</div>
      )}

      <button
        type="button"
        onClick={() => onStart({ participantName: name, difficulty, region: getRrsById(rrsId)?.name ?? null, quarters: 4 })}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-base font-bold text-white transition-opacity disabled:opacity-60"
        style={{ background: "#FF6B00", cursor: loading ? "wait" : "pointer" }}
      >
        <Play className="h-5 w-5" aria-hidden /> {loading ? "Создаём партию…" : "Начать партию"}
      </button>

      <div className="mt-4 flex items-start gap-2 text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        <span>Обычно партию настраивает оценщик и выдаёт ссылку для входа. Этот экран — быстрый старт для входа и демонстрации (требуется вход сотрудника).</span>
      </div>
    </div>
  );
}
