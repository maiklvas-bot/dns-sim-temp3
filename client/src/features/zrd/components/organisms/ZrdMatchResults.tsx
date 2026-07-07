import { Crown, LogOut, Medal } from "lucide-react";
import type { ZrdSeatView } from "@shared/zrd/match-types";
import { RRS_LABEL } from "@shared/zrd/match-types";
import { getMission } from "@shared/zrd/content-missions";

/** Итоги матча: таблица 4 мест (ТР, миссии, победитель), своё место выделено. */
export function ZrdMatchResults({ view, onLeave }: { view: ZrdSeatView; onLeave: () => void }) {
  const outcomes = view.outcomes ?? [];
  const names = new Map<number, string>();
  names.set(view.seatIdx, view.you.controller.kind === "human" ? view.you.controller.name : RRS_LABEL[view.you.rrsId]);
  for (const o of view.others) names.set(o.seatIdx, o.name);
  const rrsBySeat = new Map<number, string>();
  rrsBySeat.set(view.seatIdx, RRS_LABEL[view.you.rrsId]);
  for (const o of view.others) rrsBySeat.set(o.seatIdx, RRS_LABEL[o.rrsId]);

  const rows = outcomes
    .map((o, seatIdx) => ({ o, seatIdx }))
    .filter(({ o }) => o.tr > 0 || (view.winnerSeat === null ? true : true))
    .sort((a, b) => b.o.tr - a.o.tr);

  const youWon = view.winnerSeat === view.seatIdx;

  return (
    <div className="zrd-panel mx-auto max-w-2xl p-6">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#FF6B00" }}>Матч завершён</div>
      <h1 className="mb-1 text-2xl font-extrabold" style={{ color: "var(--zrd-text)" }}>
        {view.winnerSeat == null
          ? "Ничья — даже тай-брейк не разделил лидеров"
          : youWon ? "Победа! Ваша РРС — лучшая в дивизионе" : `Победитель: ${rrsBySeat.get(view.winnerSeat) ?? "—"}`}
      </h1>
      <p className="mb-5 text-sm" style={{ color: "var(--zrd-text-dim)" }}>
        {view.winMode === "race"
          ? "Режим «Гонка к цели»: побеждает первый, выполнивший ключевую миссию; при равенстве — эффективность (ресурсы, затем ходы)."
          : "Режим «По итогам года»: побеждает наибольший Торговый рейтинг; при равенстве — эффективность (ресурсы, затем ходы)."}
      </p>

      <div className="space-y-2">
        {rows.map(({ o, seatIdx }, i) => {
          const isYou = seatIdx === view.seatIdx;
          const isWinner = view.winnerSeat === seatIdx;
          const missions = o.missionsCompleted.map((id) => getMission(id)?.label ?? id);
          return (
            <div key={seatIdx} className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: isYou ? "#FF6B00" : "var(--zrd-border)", background: isYou ? "rgba(255,107,0,0.07)" : undefined }}>
              <span className="w-6 text-center text-lg font-extrabold" style={{ color: "var(--zrd-text-dim)" }}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--zrd-text)" }}>
                  {isWinner && <Crown className="h-4 w-4" style={{ color: "#f0b429" }} aria-hidden />}
                  {rrsBySeat.get(seatIdx)}{isYou ? " · вы" : ""}
                  {o.raceWinner && <Medal className="h-4 w-4" style={{ color: "#f0b429" }} aria-hidden />}
                </div>
                <div className="truncate text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>
                  {names.get(seatIdx)}{missions.length > 0 ? ` · миссии: ${missions.join(", ")}` : " · миссии не закрыты"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold" style={{ color: "#FF6B00" }}>{o.tr}</div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--zrd-text-dim)" }}>ТР</div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>
        Профиль 12 компетенций по каждому участнику формируется автоматически и доступен оценщику в наблюдении матча.
      </p>

      <button
        type="button"
        onClick={onLeave}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold"
        style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text)", cursor: "pointer" }}
      >
        <LogOut className="h-4 w-4" aria-hidden /> Выйти из матча
      </button>
    </div>
  );
}
