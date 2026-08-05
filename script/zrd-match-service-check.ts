/**
 * ЗРД v2 — проверка сервиса матча на временной БД (SQLITE_PATH выставляется до импортов).
 * Сценарий: создать матч (2 human + 1 ai + 1 off) → вход по кодам → ходы людей →
 * ИИ отвечает → такты идут → финал → результаты по обоим human-местам.
 * Запуск: npx tsx script/zrd-match-service-check.ts
 */
import os from "os";
import path from "path";
process.env.SQLITE_PATH = path.join(os.tmpdir(), `zrd-match-service-${Date.now()}.db`);

async function main() {
  const { sqlite } = await import("../server/db");
  const { runMigrations } = await import("../server/migrations");
  runMigrations(sqlite);
  const { zrdMatchService } = await import("../server/zrd-match-service");
  const { RRS_IDS } = await import("../shared/zrd/match-types");
  const { getMatchCard } = await import("../shared/zrd/content-decks");
  type SeatIntent = import("../shared/zrd/match-types").SeatIntent;
  type ZrdSeatView = import("../shared/zrd/match-types").ZrdSeatView;

  let failures = 0;
  const check = (name: string, ok: boolean, detail = "") => {
    if (ok) console.log(`  ok  ${name}`);
    else { failures++; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
  };

  const created = zrdMatchService.createMatch({
    evaluatorName: "Оценщик",
    evaluatorAccountId: null,
    scenario: "conquest",
    difficulty: 3,
    winMode: "year",
    missionMode: "auto",
    swanFrequency: "standard",
    minutesPerTick: 6,
    seed: 4242,
    seats: [
      { rrsId: RRS_IDS[0], controller: "human", participantName: "Анна" },
      { rrsId: RRS_IDS[1], controller: "human", participantName: "Борис" },
      { rrsId: RRS_IDS[2], controller: "ai", aiLevel: 4 },
      { rrsId: RRS_IDS[3], controller: "off" },
    ],
  });
  const matchId = created.match.id;
  check("матч создан", matchId > 0);
  const humanSeats = created.seats.filter((s) => s.controllerKind === "human");
  check("у human-мест есть коды", humanSeats.length === 2 && humanSeats.every((s) => (s.accessCode ?? "").length === 6));
  check("у ИИ/off кодов нет", created.seats.filter((s) => s.controllerKind !== "human").every((s) => s.accessCode == null));

  // вход по кодам
  const joinA = zrdMatchService.joinSeat(humanSeats[0].accessCode!);
  const joinB = zrdMatchService.joinSeat(humanSeats[1].accessCode!);
  check("вход по коду A", joinA?.matchId === matchId && joinA.seatIdx === 0);
  check("вход по коду B", joinB?.matchId === matchId && joinB.seatIdx === 1);
  check("неверный код отклонён", zrdMatchService.joinSeat("ZZZZZZ") === null);
  check("токен A валиден", zrdMatchService.verifySeatToken(matchId, 0, joinA!.token));
  check("чужой токен не подходит", !zrdMatchService.verifySeatToken(matchId, 1, joinA!.token));

  // ИИ уже сходил в такте 1 (создание прогоняет ИИ-места)
  const obs0 = zrdMatchService.getObserverView(matchId);
  check("observer доступен", Boolean(obs0));
  check("ИИ-место уже спасовало в такте 1", obs0!.observer.seats[2].passed === true);

  // политика для человека: первая доступная карта / стандарт / пас
  const humanIntent = (view: ZrdSeatView): SeatIntent => {
    if (view.you.pendingEvent) {
      const opt = view.you.pendingEvent.options.find((o) =>
        !o.cost || Object.entries(o.cost).every(([k, v]) => (view.you.resources as Record<string, number>)[k] >= (v ?? 0)),
      ) ?? view.you.pendingEvent.options[0];
      return { kind: "eventChoice", optionId: opt.id };
    }
    if (view.you.actionsLeft > 0) {
      for (const id of view.you.hand) {
        const c = getMatchCard(id);
        if (!c) continue;
        const afford = Object.entries(c.cost).every(([k, v]) => (view.you.resources as Record<string, number>)[k] >= (v ?? 0));
        const cond = !c.condition
          || ((!c.condition.minMetric || Object.entries(c.condition.minMetric).every(([k, v]) => (view.you.metrics as Record<string, number>)[k] >= (v ?? 0)))
            && (!c.condition.minResource || Object.entries(c.condition.minResource).every(([k, v]) => (view.you.resources as Record<string, number>)[k] >= (v ?? 0))));
        if (afford && cond) return { kind: "playCard", cardId: id };
      }
      if (view.you.resources.capital >= 4) return { kind: "standard", action: "promo" };
    }
    return { kind: "pass" };
  };

  // полный прогон: оба человека ходят до конца матча
  let guard = 0;
  let versionSeen = 0;
  while (guard++ < 400) {
    const v = zrdMatchService.getVersion(matchId);
    if (!v || v.status === "completed") break;
    versionSeen = Math.max(versionSeen, v.version);
    for (const seatIdx of [0, 1]) {
      let inner = 0;
      for (;;) {
        const sv = zrdMatchService.getSeatView(matchId, seatIdx);
        if (!sv || sv.view.matchEnded || sv.view.you.passed || inner++ > 40) break;
        const intent = humanIntent(sv.view);
        const res = zrdMatchService.applyIntent(matchId, seatIdx, intent);
        if (!res.ok) {
          const p = zrdMatchService.applyIntent(matchId, seatIdx, { kind: "pass" });
          if (!p.ok) break;
        }
        if (intent.kind === "pass") break;
      }
    }
  }

  const final = zrdMatchService.getObserverView(matchId);
  check("матч завершён", final?.status === "completed", final?.status);
  check("такты шли (тик > 1)", (final?.observer.tick ?? 0) > 1, `tick=${final?.observer.tick}`);
  check("версия состояния росла", (final?.version ?? 0) > versionSeen || (final?.version ?? 0) > 2, `v=${final?.version}`);
  check("результаты по 3 активным местам", (final?.results.length ?? 0) === 3, `${final?.results.length}`);
  const humanResults = final?.results.filter((r) => r.seatIdx <= 1) ?? [];
  check("компетенции у human-мест: 12 ключей 0..5", humanResults.length === 2 && humanResults.every((r) => {
    const vals = Object.values(r.competencies);
    return vals.length === 12 && vals.every((v) => typeof v === "number" && v >= 0 && v <= 5);
  }));
  check("seat-view после финала содержит outcomes", Boolean(zrdMatchService.getSeatView(matchId, 0)?.view.outcomes));

  // пауза и ручной лебедь на незавершённом матче
  const created2 = zrdMatchService.createMatch({
    evaluatorName: "Оценщик", evaluatorAccountId: null, scenario: "crisis", difficulty: 2,
    winMode: "year", missionMode: "auto", swanFrequency: "off", minutesPerTick: 6, seed: 777,
    seats: [
      { rrsId: RRS_IDS[0], controller: "human", participantName: "Вера" },
      { rrsId: RRS_IDS[1], controller: "ai", aiLevel: 2 },
      { rrsId: RRS_IDS[2], controller: "off" },
      { rrsId: RRS_IDS[3], controller: "off" },
    ],
  });
  const m2 = created2.match.id;
  const swan = zrdMatchService.triggerSwan(m2, "kiberataka", "all");
  check("ручной лебедь запущен", swan.ok === true);
  const swanDup = zrdMatchService.triggerSwan(m2, "kiberataka", "all");
  check("повторный лебедь отклонён", !swanDup.ok && swanDup.error === "SWAN_ALREADY_ACTIVE");
  const obs2 = zrdMatchService.getObserverView(m2);
  check("лебедь виден в observer", (obs2?.observer.activeSwans.length ?? 0) === 1);
  check("пауза включается", zrdMatchService.setPaused(m2, true).ok);
  const paused = zrdMatchService.applyIntent(m2, 0, { kind: "pass" });
  check("ход в паузе отклонён", !paused.ok && paused.error === "PAUSED");
  check("пауза снимается", zrdMatchService.setPaused(m2, false).ok);

  // выбор фигурки + своя корпоративная почта (участник вводит сам, не оценщик)
  const mascotRes = zrdMatchService.setMascot(m2, 0, "captain", "vera@dns-shop.ru");
  check("фигурка + почта приняты", mascotRes.ok === true);
  const seatAfterMascot = zrdMatchService.getSeatView(m2, 0);
  const ctrl = seatAfterMascot?.view.you.controller;
  check("почта сохранена в состоянии места", Boolean(ctrl && ctrl.kind === "human" && ctrl.email === "vera@dns-shop.ru"));
  check("маскот выбран", seatAfterMascot?.view.you.mascotId === "captain" && seatAfterMascot?.view.you.mascotChosen === true);

  // ── областные РРС (ЧБО2/СВО1): профили экономики + выбор РРС самими игроками ──
  const { initMatch, chooseSeatRrs } = await import("../shared/zrd/match-engine");
  const { SCENARIOS } = await import("../shared/zrd/content-scenarios");
  const cfg3 = {
    scenario: "conquest" as const, difficulty: 3 as const, winMode: "year" as const,
    missionMode: "auto" as const, missionIds: SCENARIOS.conquest.missionIds,
    keyMissionId: SCENARIOS.conquest.keyMissionId, swanFrequency: "off" as const,
    minutesPerTick: 6, seed: 999,
    seats: [
      { rrsId: "tmn" as const, controller: { kind: "human" as const, name: "Один" } },
      { rrsId: "ekb" as const, controller: { kind: "human" as const, name: "Два" } },
      { rrsId: "svo1" as const, controller: { kind: "ai" as const, level: 3 as const } },
      { rrsId: "chbo2" as const, controller: { kind: "ai" as const, level: 3 as const } },
    ],
  };
  const st3 = initMatch(cfg3);
  check("2 человека: РРС людей не закреплены (выберут сами)", st3.seats[0].rrsChosen === false && st3.seats[1].rrsChosen === false);
  check("РРС ИИ закреплены сразу", st3.seats[2].rrsChosen === true && st3.seats[3].rrsChosen === true);
  check("профиль СВО1 применён (капитал +6)", st3.seats[2].resources.capital === st3.seats[0].resources.capital + 6);
  check("профиль СВО1: доход выше на 1", st3.seats[2].incomeMonthly === st3.seats[0].incomeMonthly + 1);
  check("профиль ЧБО2: охват выше на 3", st3.seats[3].metrics.coverage === st3.seats[0].metrics.coverage + 3);
  check("профиль ЧБО2: доход ниже на 1", st3.seats[3].incomeMonthly === st3.seats[0].incomeMonthly - 1);
  // игрок 1 забирает РРС игрока 2 → провизорные свопаются
  const pick1 = chooseSeatRrs(st3, 0, "ekb");
  check("выбор чужой провизорной РРС свопает места", pick1.ok && st3.seats[0].rrsId === "ekb" && st3.seats[1].rrsId === "tmn");
  check("выбравший закреплён, второй — ещё нет", st3.seats[0].rrsChosen === true && st3.seats[1].rrsChosen === false);
  const pickTaken = chooseSeatRrs(st3, 1, "svo1");
  check("занятую ИИ РРС забрать нельзя", !pickTaken.ok && pickTaken.error === "RRS_TAKEN");
  const pick2 = chooseSeatRrs(st3, 1, "tmn");
  check("второй игрок закрепляет оставшуюся", pick2.ok && st3.seats[1].rrsChosen === true);

  // сервисный слой: своп синхронизирует rrsId в строках мест БД
  const created4 = zrdMatchService.createMatch({
    evaluatorName: "Оценщик", evaluatorAccountId: null, scenario: "conquest", difficulty: 3,
    winMode: "year", missionMode: "auto", swanFrequency: "off", minutesPerTick: 6, seed: 1000,
    seats: [
      { rrsId: "tmn", controller: "human", participantName: "А" },
      { rrsId: "chbo2", controller: "human", participantName: "Б" },
      { rrsId: "ekb", controller: "off" },
      { rrsId: "perm", controller: "off" },
    ],
  });
  const m4 = created4.match.id;
  const svc = zrdMatchService.chooseRrs(m4, 0, "chbo2");
  check("сервис: выбор РРС проходит", svc.ok === true && (svc.ok ? svc.view.you.rrsId === "chbo2" : false));
  const listed4 = zrdMatchService.listMatches().find((m) => m.id === m4);
  check("сервис: своп отражён в строках мест", listed4?.seats[0].rrsId === "chbo2" && listed4?.seats[1].rrsId === "tmn");
  check("сервис: профиль ЧБО2 применился выбравшему",
    svc.ok ? svc.view.you.metrics.coverage > 0 && svc.view.you.incomeMonthly >= 0 : false);

  // подключение игроков к ЗАПУЩЕННОЙ сессии: ИИ → человек (перехват) и пусто → человек (поздний вход)
  const att1 = zrdMatchService.attachHuman(m2, 1, "Перехватчик"); // место 1 = ИИ
  check("подключение на место ИИ", att1.ok === true && (att1.ok ? att1.accessCode.length === 6 : false));
  if (att1.ok) {
    const joined = zrdMatchService.joinSeat(att1.accessCode);
    check("вход по коду подключённого", joined?.matchId === m2 && joined.seatIdx === 1 && joined.participantName === "Перехватчик");
    const sv = zrdMatchService.getSeatView(m2, 1);
    check("место ИИ стало человеком (живое состояние)", sv?.view.you.controller.kind === "human" && sv.view.you.resources.capital > 0);
    check("подключённый выбирает фигурку сам", sv?.view.you.mascotChosen === false);
  }
  const att2 = zrdMatchService.attachHuman(m2, 2, "Поздний"); // место 2 = пусто
  check("подключение на пустое место", att2.ok === true);
  if (att2.ok) {
    const sv2 = zrdMatchService.getSeatView(m2, 2);
    check("пустое место активировано (стартовые ресурсы и колода)",
      sv2 != null && sv2.view.you.resources.capital > 0 && Object.values(sv2.view.you.deckCounts).reduce((a, b) => a + b, 0) > 0);
    check("поздний игрок ждёт следующий месяц", sv2?.view.you.passed === true);
  }
  const attTaken = zrdMatchService.attachHuman(m2, 0, "Дубль"); // место 0 уже человек
  check("занятое место отклонено", !attTaken.ok && attTaken.error === "SEAT_TAKEN");

  // листинг матчей для панели «Активные сессии» оценщика (код выдан → матч должен быть виден)
  const list = zrdMatchService.listMatches();
  const listedM1 = list.find((m) => m.id === matchId);
  const listedM2 = list.find((m) => m.id === m2);
  check("листинг содержит оба матча", Boolean(listedM1 && listedM2));
  check("листинг: завершённый матч помечен completed", listedM1?.status === "completed");
  check("листинг: коды и имена мест на месте", listedM2?.seats.some((s) => s.accessCode && s.participantName === "Вера") ?? false);

  // «Гонка» с настраиваемой целью финиша: цель ниже стартового KPI efficiency (база 40) → матч
  // должен завершиться сразу же (тик 1), а не по встроенному порогу ключевой миссии.
  const raceCustom = zrdMatchService.createMatch({
    evaluatorName: "Оценщик", evaluatorAccountId: null, scenario: "efficiency", difficulty: 3,
    winMode: "race", missionMode: "auto", swanFrequency: "off", minutesPerTick: 6, seed: 555,
    raceTargetKpi: "efficiency", raceTargetValue: 35,
    seats: [
      { rrsId: RRS_IDS[0], controller: "human", participantName: "Гонщик" },
      { rrsId: RRS_IDS[1], controller: "off" },
      { rrsId: RRS_IDS[2], controller: "off" },
      { rrsId: RRS_IDS[3], controller: "off" },
    ],
  });
  zrdMatchService.applyIntent(raceCustom.match.id, 0, { kind: "pass" });
  const raceView = zrdMatchService.getSeatView(raceCustom.match.id, 0);
  check("гонка с своей целью: матч завершён сразу (цель ниже стартового KPI)", raceView?.view.matchEnded === true, `tick=${raceView?.view.tick}`);
  check("гонка с своей целью: победитель определён", (raceView?.view.winnerSeat ?? null) === 0);

  if (failures > 0) { console.error(`\n${failures} проверок провалено`); process.exit(1); }
  console.log("\nВсе проверки сервиса матча пройдены.");
}

main().catch((e) => { console.error(e); process.exit(1); });
