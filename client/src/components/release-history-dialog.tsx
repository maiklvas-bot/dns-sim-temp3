import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RELEASE_HISTORY, type ChangeKind } from "@/data/release-history";

/**
 * История изменений продукта для пользователя: что появилось, что изменилось,
 * какие проблемы решены и какие остались открытыми. Открывается по клику на
 * номер версии в подвале кабинета.
 */

const KIND_LABEL: Record<ChangeKind, string> = {
  added: "Появилось",
  changed: "Изменилось",
  fixed: "Исправлено",
};

const KIND_STYLE: Record<ChangeKind, string> = {
  added: "border-[#54d28c]/45 bg-[#54d28c]/10 text-[#8ff5de]",
  changed: "border-[#8ec5ff]/45 bg-[#4a9eff]/10 text-[#b7d9ff]",
  fixed: "border-[#ffb27a]/45 bg-[#f68b1f]/10 text-[#ffd9bf]",
};

export function ReleaseHistoryDialog({
  open,
  onOpenChange,
  themeClass,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  themeClass: string;
}) {
  const [activeVersion, setActiveVersion] = useState(RELEASE_HISTORY[0]?.version || "");
  const release = RELEASE_HISTORY.find((item) => item.version === activeVersion) || RELEASE_HISTORY[0];

  if (!release) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`dns-product-shell dns-admin-shell ${themeClass} flex h-[90vh] max-h-[90vh] w-[94vw] max-w-[1000px] flex-col gap-0 overflow-hidden p-0`}
      >
        <DialogHeader className="space-y-0.5 border-b border-border px-5 py-3.5 text-left">
          <DialogTitle className="text-[15px]">История изменений продукта</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Что менялось на экранах, какие задачи это закрывало и что осталось открытым. Без кода.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* Слева — версии, справа — содержание выбранной. */}
          <div className="w-[13rem] shrink-0 overflow-y-auto border-r border-border p-3 custom-scroll">
            {RELEASE_HISTORY.map((item) => (
              <button
                key={item.version}
                type="button"
                onClick={() => setActiveVersion(item.version)}
                className={`mb-1.5 w-full rounded-lg px-3 py-2 text-left transition ${
                  item.version === release.version
                    ? "bg-[#f68b1f]/15 text-white ring-1 ring-[#f68b1f]"
                    : "text-[#8aa2c4] hover:bg-[#6fa0ff]/10"
                }`}
              >
                <div className="text-[13px] font-bold">v{item.version}</div>
                <div className="mt-0.5 text-[11px] opacity-80">{item.date}</div>
                <div className="mt-1 text-[11px] leading-snug">{item.title}</div>
              </button>
            ))}
          </div>

          <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-5 custom-scroll">
            <div>
              <div className="text-[15px] font-bold text-white">
                v{release.version} · {release.title}
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-[#8aa2c4]">{release.scope}</div>
            </div>

            <div className="space-y-2">
              {release.changes.map((change, index) => (
                <div key={`${release.version}-change-${index}`} className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${KIND_STYLE[change.kind]}`}>
                      {KIND_LABEL[change.kind]}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8fa8cf]">
                      {change.area}
                    </span>
                  </div>
                  <div className="mt-2 text-[13px] leading-relaxed text-[#dbe2f0]">{change.what}</div>
                  {change.before && (
                    <div className="mt-2 border-l-2 border-[#3b5878] pl-2.5 text-[12px] leading-relaxed text-[#8aa2c4]">
                      <b className="text-[#8fa8cf]">Было:</b> {change.before}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <div className="text-[13px] font-bold text-white">Какие задачи закрывал релиз</div>
              <div className="mt-2 space-y-2">
                {release.problems.map((problem, index) => (
                  <div
                    key={`${release.version}-problem-${index}`}
                    className={`rounded-xl border p-3 ${
                      problem.solved
                        ? "border-[#54d28c]/35 bg-[#54d28c]/8"
                        : "border-[#ffb27a]/35 bg-[#f68b1f]/8"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[13px] font-semibold text-white">{problem.title}</div>
                      <div
                        className={`shrink-0 text-[11px] font-semibold ${
                          problem.solved ? "text-[#54d28c]" : "text-[#ffb27a]"
                        }`}
                      >
                        {problem.solved ? "решено" : "открыто"}
                      </div>
                    </div>
                    <div className="mt-1.5 text-[12px] leading-relaxed text-[#8aa2c4]">{problem.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
