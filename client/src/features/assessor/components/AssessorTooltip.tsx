import { useState, type ReactNode } from "react";

export function AssessorTooltip({ text, children }: { text: string; children: ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 max-w-[280px] -translate-x-1/2 whitespace-normal rounded-lg border border-[#2a3a4e] bg-[#0f1923] px-3 py-2 text-xs text-[#a5b2c8] shadow-xl">
          {text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#2a3a4e]" />
        </div>
      )}
    </div>
  );
}
