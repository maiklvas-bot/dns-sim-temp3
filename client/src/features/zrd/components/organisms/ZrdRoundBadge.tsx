import { useEffect, useRef, useState } from "react";

/** Живые часы (реальное время сессии). */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Перекидной календарь: при смене значения новая «страница» переворачивается сверху, предыдущая растворяется. */
function RoundFlip({ text }: { text: string }) {
  const [pages, setPages] = useState<{ cur: string; prev: string | null }>({ cur: text, prev: null });
  const prevRef = useRef(text);
  useEffect(() => {
    if (prevRef.current !== text) {
      const old = prevRef.current;
      prevRef.current = text;
      setPages({ cur: text, prev: old });
      const t = window.setTimeout(() => setPages({ cur: text, prev: null }), 620);
      return () => window.clearTimeout(t);
    }
  }, [text]);
  const flipping = pages.prev != null;
  return (
    <span className="zrd-round__val">
      <span key={pages.cur} className={`zrd-round__page${flipping ? " zrd-round__page--in" : ""}`}>{pages.cur}</span>
      {pages.prev != null && <span className="zrd-round__page zrd-round__page--out">{pages.prev}</span>}
    </span>
  );
}

/**
 * Бейдж календаря матча в шапке: часы + «Кв Q/4 · Мес M» (перекидной) + таймер дедлайна такта.
 * Дедлайн приходит с сервера; по истечении непоходившие пропускают месяц.
 */
export function ZrdRoundBadge({ quarter, tick, deadlineAt, paused }: { quarter: number; tick: number; deadlineAt: string | null; paused: boolean }) {
  const now = useClock();
  let timer: string | null = null;
  let urgent = false;
  if (paused) {
    timer = "пауза";
  } else if (deadlineAt) {
    const left = Math.max(0, Math.floor((Date.parse(deadlineAt) - now.getTime()) / 1000));
    timer = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
    urgent = left <= 60;
  }
  return (
    <div className="zrd-round-badge">
      <span className="zrd-round-badge__dt">
        {pad(now.getHours())}:{pad(now.getMinutes())} · {pad(now.getDate())}.{pad(now.getMonth() + 1)}.{now.getFullYear()}
        {timer && (
          <span style={{ marginLeft: 8, fontWeight: 700, color: urgent ? "#e85a5a" : "#FF6B00" }}>
            ⏱ {timer}
          </span>
        )}
      </span>
      <div className="zrd-round-badge__pill">
        <span className="zrd-round-badge__label">Кв {quarter}/4</span>
        <RoundFlip text={`Мес ${pad(tick)}/12`} />
      </div>
    </div>
  );
}
