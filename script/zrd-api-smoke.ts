/**
 * ЗРД — интеграционный smoke-тест Фазы 3 (persistence + движок + скоринг + AI-оппонент).
 * Прогоняет полный цикл solo-vs-AI через серверный сервис на временной БД.
 * Запуск: SQLITE_PATH=./tmp/zrd-smoke.db npx tsx script/zrd-api-smoke.ts
 */
import { sqlite } from "../server/db";
import { runMigrations } from "../server/migrations";
import { zrdService } from "../server/zrd-service";
import { zrdStorage } from "../server/zrd-storage";
import { hashSimulationSessionToken } from "../server/simulation-session-access";
import { chooseIntent } from "../shared/zrd/ai";
import type { ZrdState, TurnIntent } from "../shared/zrd/types";
import { COMPETENCY_KEYS } from "../shared/zrd/types";

runMigrations(sqlite);

let failures = 0;
function check(name: string, cond: boolean, info = "") {
  console.log(`${cond ? "  ✅" : "  ❌"} ${name}${info ? " — " + info : ""}`);
  if (!cond) failures++;
}

function loadState(id: number): ZrdState {
  return JSON.parse(zrdStorage.getSession(id)!.stateJson) as ZrdState;
}

function fallback(state: ZrdState): TurnIntent {
  if (state.phase === "setup") return { kind: "declareStrategy", strategy: "service" };
  if (state.phase === "research") return { kind: "keepCards", cardIds: [] };
  if (state.phase === "event" && state.pendingEvent) {
    const free = state.pendingEvent.options.find((o) => !o.cost || Object.values(o.cost).every((v) => !v)) ?? state.pendingEvent.options[0];
    return { kind: "eventChoice", optionId: free.id };
  }
  return { kind: "pass" };
}

console.log("\n=== ЗРД API smoke (Фаза 3) ===\n");

// 1. Создание партии
const game = zrdService.createGame({
  participantName: "Тест Участник",
  evaluatorName: "Тест Оценщик",
  evaluatorAccountId: null,
  difficulty: 3,
  region: "RRS-EKB",
  seed: 12345,
  quarters: 4,
});
const id = game.session.id;
check("партия создана (id)", id > 0, `id=${id}`);
check("выдан код доступа", /^[A-Z0-9]{6}$/.test(game.accessCode), game.accessCode);
check("токен хешируется в сессию", hashSimulationSessionToken(game.token) === game.session.participantTokenHash);
check("публичное состояние без колоды", !("deck" in (game.state as any)) && "deckRemaining" in (game.state as any));

// 2. Отклонение невалидного хода (нельзя сыграть несуществующую карту в фазе setup/research)
const bad = zrdService.applyPlayerIntent(id, { kind: "playCard", cardId: "nonexistent" });
check("невалидный ход отклонён", bad.ok === false, (bad as any).error);

// 3. Прогон партии до конца «руками игрока» через сервис
let guard = 0;
let finalRes: ReturnType<typeof zrdService.applyPlayerIntent> | null = null;
while (guard++ < 500) {
  const session = zrdStorage.getSession(id)!;
  if (session.status === "completed") break;
  const state = loadState(id);
  let intent = chooseIntent(state, { style: "balanced", strategy: "service" });
  let res = zrdService.applyPlayerIntent(id, intent);
  if (!res.ok) res = zrdService.applyPlayerIntent(id, fallback(state));
  if (res.ok) finalRes = res;
}
const finishedSession = zrdStorage.getSession(id)!;
check("партия завершилась (status=completed)", finishedSession.status === "completed", finishedSession.status);
check("есть completedAt", Boolean(finishedSession.completedAt));

// 4. Лог ходов записан
const turns = zrdStorage.getTurns(id);
check("ходы записаны в zrd_turns", turns.length > 0, `${turns.length} ходов`);
check("seq монотонно растёт", turns.every((t, i) => t.seq === i + 1));

// 5. Результат: ТР, победитель, 12 компетенций
const details = zrdStorage.getSessionDetails(id);
const result = details?.result as any;
check("результат записан", Boolean(result));
check("ТР игрока > 0", result?.tr > 0, `ТР=${result?.tr}`);
check("посчитан ТР AI-оппонента", typeof result?.aiTr === "number", `aiTr=${result?.aiTr}`);
check("победитель определён", ["player", "ai", "draw"].includes(result?.winner), result?.winner);
check("12 компетенций в результате", result && COMPETENCY_KEYS.every((k) => typeof result.competencies[k] === "number"),
  result ? `${Object.keys(result.competencies).length} ключей` : "");
check("финальные метрики S/N/O", result && ["sales", "nps", "coverage"].every((k) => typeof result.finalMetrics[k] === "number"));

// 6. Идемпотентность: повторный ход после конца отклоняется
const afterEnd = zrdService.applyPlayerIntent(id, { kind: "pass" });
check("ход после конца отклонён (GAME_ENDED)", afterEnd.ok === false && (afterEnd as any).error === "GAME_ENDED");

// 7. Публичная выдача завершённой сессии содержит результат
const pub = zrdService.getPublicSession(id);
check("getPublicSession отдаёт результат", Boolean(pub?.result) && pub?.status === "completed");

console.log(`\n=== Итог: ${failures === 0 ? "ВСЕ ПРОВЕРКИ ПРОШЛИ ✅" : failures + " проверок упало ❌"} ===\n`);
sqlite.close();
process.exit(failures === 0 ? 0 : 1);
