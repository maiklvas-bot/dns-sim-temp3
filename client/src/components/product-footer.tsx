import { cn } from "@/lib/utils";

/**
 * Авторская планка продукта — одна строка по центру внизу основного экрана.
 * Версия продукта (системная инфо) — мелким текстом в правом нижнем углу.
 * Использовать на основных экранах: авторизация, администратор, оценщик, симуляция.
 *
 * className может переопределять позиционирование (напр. "fixed inset-x-0 bottom-0").
 * Используем cn (tailwind-merge), чтобы переданный position корректно перекрывал базовый relative.
 */
export function ProductFooter({
  version = "Product UI v4.1",
  className = "",
}: {
  version?: string;
  className?: string;
}) {
  return (
    <div className={cn("dns-product-footer relative z-10 mt-6 flex items-center justify-center px-4 py-3", className)}>
      <span className="text-center text-[11px] leading-none text-muted-foreground/70">
        Developed by MV &amp; Alo72.&nbsp;&nbsp;Copyright © 2026 DNS Retail LLC. All rights reserved.
      </span>
      {version ? (
        <span className="pointer-events-none absolute bottom-2 right-4 hidden text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50 sm:block">
          {version}
        </span>
      ) : null}
    </div>
  );
}
