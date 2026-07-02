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

/** Компактный бейдж раунда в шапке: живые часы/дата + оранжевая плашка «Раунд XX/24» (перекидной календарь). */
export function ZrdRoundBadge({ round, total }: { round: number; total: number }) {
  const now = useClock();
  return (
    <div className="zrd-round-badge">
      <span className="zrd-round-badge__dt">
        {pad(now.getHours())}:{pad(now.getMinutes())} · {pad(now.getDate())}.{pad(now.getMonth() + 1)}.{now.getFullYear()}
      </span>
      <div className="zrd-round-badge__pill">
        <span className="zrd-round-badge__label">Раунд</span>
        <RoundFlip text={`${pad(round)}/${pad(total)}`} />
      </div>
    </div>
  );
}
