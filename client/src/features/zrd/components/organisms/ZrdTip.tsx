import type { ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/**
 * Всплывающее пояснение при наведении на строку панели.
 * Portal — чтобы тултип не обрезался overflow:hidden рамки `.zrd-frame`.
 */
export function ZrdTip({ title, value, desc, children }: {
  title: string;
  value?: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipPrimitive.Portal>
        <TooltipContent
          side="top"
          sideOffset={8}
          collisionPadding={12}
          className="max-w-[280px] border-[rgba(255,107,0,0.45)] bg-[#14161b] text-[#e7ecf4] shadow-[0_12px_34px_rgba(0,0,0,0.6)]"
        >
          <div className="text-[13px] font-bold leading-tight text-white">{title}</div>
          {value && <div className="mt-1 text-[12px] font-semibold text-[#FF9A3D]">{value}</div>}
          <div className="mt-1.5 text-[12px] leading-snug text-[#c4ccd8]">{desc}</div>
        </TooltipContent>
      </TooltipPrimitive.Portal>
    </Tooltip>
  );
}
