import { useEffect, useMemo, useRef, useState } from "react";
import type { MascotId, ZrdSeatView } from "@shared/zrd/match-types";
import { MASCOT_IDS } from "@shared/zrd/match-types";
import { getMatchCard } from "@shared/zrd/content-decks";
import { MASCOT_VISUAL } from "../../zrd-mascots";
import { checkPlayable } from "../../zrd-match-board";

const IDLE_MS = 10_000;

type Target = "decks" | "pass" | "event";

/**
 * Помощник-маскот (фигурка, которой НИКТО не играет): если игрок 10 секунд не кликает,
 * а матч ждёт его действий — появляется с подсказкой и стрелкой на зону взаимодействия.
 * Любой клик/клавиша прячет помощника и перезапускает таймер простоя.
 */
export function ZrdHelperMascot({ view }: { view: ZrdSeatView }) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  // что подсказывать: событие → колоды → завершение месяца (по состоянию хода)
  const hint = useMemo((): { target: Target; text: string } | null => {
    if (view.matchEnded || view.you.passed) return null;
    if (view.you.pendingEvent) {
      return { target: "event", text: "Матч ждёт вашего решения — выберите реакцию на событие квартала" };
    }
    if (view.you.actionsLeft <= 0) {
      return { target: "pass", text: "Действия месяца закончились — нажмите «Завершить месяц»" };
    }
    const anyPlayable = view.you.hand.some((id) => {
      const c = getMatchCard(id);
      return c ? checkPlayable(view.you, c).ok : false;
    });
    if (anyPlayable) {
      return { target: "decks", text: "Наведите на колоду справа: кликните карту и нажмите «Разыграть»" };
    }
    return { target: "pass", text: "Подходящих карт сейчас нет — завершите месяц кнопкой внизу" };
  }, [view]);

  useEffect(() => {
    const reset = () => {
      setVisible(false);
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setVisible(true), IDLE_MS);
    };
    reset();
    const evs: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "wheel"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      evs.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  if (!visible || !hint) return null;

  // свободная фигурка: не занятая ни вами, ни соперниками
  const used = new Set<MascotId | undefined>([view.you.mascotId, ...view.others.map((o) => o.mascotId)]);
  const freeId = MASCOT_IDS.find((id) => !used.has(id)) ?? "dispatcher";
  const m = MASCOT_VISUAL[freeId] ?? MASCOT_VISUAL.dispatcher;

  return (
    <>
      <div className="zrd-helper" role="status">
        <img src={m.figure} alt="" draggable={false} />
        <div className="zrd-helper__bubble">
          <strong>{m.name} подсказывает</strong>
          <span>{hint.text}</span>
        </div>
      </div>
      <div className={`zrd-helper__arrow zrd-helper__arrow--${hint.target}`} aria-hidden>➜</div>
    </>
  );
}
