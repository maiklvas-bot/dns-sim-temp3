import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Всплывающая карточка: подсказка, поповер, тултип.
 *
 * Рендерится порталом в body с `position: fixed`. Так она не зависит от
 * `overflow` и `transform` родителей — а в кабинете почти каждая панель
 * обрезает содержимое, чтобы не было лишних полос прокрутки. Всплывашка,
 * положенная внутрь такой панели, обрезается её краем, и `z-index` не
 * помогает: он не действует поперёк overflow.
 *
 * Позиция подстраивается под края окна: у правого края карточка сдвигается
 * влево, у нижнего — раскрывается вверх.
 */
export function FloatingCard({
  anchor,
  width = 288,
  gap = 12,
  children,
  className = "",
}: {
  /** Точка привязки в координатах окна — обычно позиция курсора или кнопки. */
  anchor: { x: number; y: number };
  width?: number;
  gap?: number;
  children: ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const measure = () => {
      const height = card.offsetHeight;
      const margin = 8;

      let left = anchor.x + gap;
      if (left + width + margin > window.innerWidth) {
        left = Math.max(margin, anchor.x - width - gap);
      }

      let top = anchor.y + gap;
      if (top + height + margin > window.innerHeight) {
        top = Math.max(margin, anchor.y - height - gap);
      }

      setPosition({ left, top });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [anchor.x, anchor.y, gap, width]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={cardRef}
      className={`dns-floating-card pointer-events-none fixed z-[80] rounded-xl border border-[#3b5878] bg-[#101826] p-3 shadow-[0_18px_45px_rgba(0,0,0,0.5)] ${className}`}
      style={{
        width,
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        // До первого замера карточка не должна мигать в углу экрана.
        visibility: position ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
