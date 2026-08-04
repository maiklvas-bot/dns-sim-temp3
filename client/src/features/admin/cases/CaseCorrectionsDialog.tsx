import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CaseCorrection, SimCase } from "@shared/simulation-content";
import { validateCase } from "@shared/case-validation";

/**
 * Что исправлено в кейсе-дубле относительно оригинала.
 *
 * Экран отвечает на один вопрос: почему исправленному кейсу можно верить
 * больше, чем исходному. Поэтому показывает не «исправлено 6 замечаний», а
 * каждую правку целиком — что было, что стало и какое методическое правило
 * этого потребовало.
 */

const CHECK_LABELS: Record<CaseCorrection["check"], string> = {
  bars_conformance: "Уровни BARS",
  antigaming: "Антигейминг",
  diagnostics: "Диагностика",
  effect_reality: "Реальность эффектов",
  content: "Логика кейса",
};

/** Правка смысла — не следствие автопроверки, и это стоит различать глазом. */
function checkTone(check: CaseCorrection["check"]): string {
  return check === "content"
    ? "border-[#8ec5ff]/40 bg-[#8ec5ff]/10 text-[#8ec5ff]"
    : "border-[#f68b1f]/40 bg-[#f68b1f]/10 text-[#ffb27a]";
}

export function CaseCorrectionsDialog({
  open,
  onOpenChange,
  correctedCase,
  originalCase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  correctedCase: SimCase;
  originalCase: SimCase | null;
}) {
  const corrections = correctedCase.corrections || [];
  const originalIssues = originalCase ? validateCase(originalCase) : [];
  const correctedIssues = validateCase(correctedCase);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dns-admin-shell max-h-[88vh] w-[min(96vw,60rem)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">Что исправлено в этом кейсе</DialogTitle>
        </DialogHeader>

        <div className="mt-1 text-sm leading-relaxed text-[#b8c7df]">
          Это исправленный дубль кейса{" "}
          <b className="text-white">{originalCase?.title || correctedCase.correctionOfCaseId}</b>. Оригинал остался
          нетронутым и продолжает работать как прежде — здесь показано только то, что изменено в копии.
        </div>

        {/* Итог одной строкой: сколько замечаний было и сколько осталось. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#3b5878] bg-[#101826] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8aa2c4]">Было в оригинале</div>
            <div className="mt-1 text-2xl font-bold text-[#ffb27a]">{originalIssues.length}</div>
            <div className="text-xs text-[#8aa2c4]">замечаний автопроверки</div>
          </div>
          <div className="rounded-xl border border-[#54d28c]/40 bg-[#54d28c]/8 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8aa2c4]">Стало в исправлении</div>
            <div className="mt-1 text-2xl font-bold text-[#54d28c]">{correctedIssues.length}</div>
            <div className="text-xs text-[#8aa2c4]">замечаний автопроверки</div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {corrections.length === 0 && (
            <div className="rounded-xl border border-[#3b5878] bg-[#101826] p-4 text-sm text-[#b8c7df]">
              Журнал правок пуст.
            </div>
          )}

          {corrections.map((item, index) => (
            <div key={`${item.check}-${index}`} className="rounded-xl border border-[#2a3a4e] bg-[#101826]/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${checkTone(item.check)}`}>
                  {CHECK_LABELS[item.check]}
                </span>
                <span className="text-xs text-[#8aa2c4]">{item.scope}</span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-[#ffb27a]/30 bg-[#f68b1f]/8 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffb27a]">Было</div>
                  <div className="mt-1.5 text-[13px] leading-relaxed text-[#cbd8ef]">{item.was}</div>
                </div>
                <div className="rounded-lg border border-[#54d28c]/30 bg-[#54d28c]/8 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#54d28c]">Стало</div>
                  <div className="mt-1.5 text-[13px] leading-relaxed text-[#cbd8ef]">{item.became}</div>
                </div>
              </div>

              <div className="mt-3 text-[13px] leading-relaxed text-[#b8c7df]">
                <b className="text-[#8ec5ff]">Почему так вернее:</b> {item.why}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
