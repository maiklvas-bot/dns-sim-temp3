import { useState } from "react";
import { HelpCircle } from "lucide-react";

export interface HelpTopic {
  /** Заголовок окна — вопрос автора, а не название поля. */
  title: string;
  /** Что это и зачем. Простым языком, без терминов системы. */
  what: string;
  /** Кто и когда это заполняет. */
  who?: string;
  /** Готовый пример — то, что можно прочитать и повторить. */
  example?: string;
  /** Типичная ошибка и во что она выливается на оценке. */
  mistake?: string;
}

/**
 * Обучающий слой мастера: знак вопроса у блока, по клику — окно с объяснением.
 * Открывается по месту и не уводит автора со страницы.
 */
export function MasterHelp({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="dns-master-help relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Что такое «${topic.title}»`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#3b5878] text-[#8ec5ff] transition hover:border-[#6fa0ff] hover:bg-[#6fa0ff]/10"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          {/* Клик мимо закрывает окно — иначе подсказки копятся на экране. */}
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <span className="dns-master-help-popover absolute left-0 top-7 z-50 block w-[min(26rem,80vw)] rounded-xl border border-[#3b5878] bg-[#101826] p-3 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
            <span className="block text-[12px] font-semibold text-white">{topic.title}</span>
            <span className="mt-1.5 block text-[12px] leading-relaxed text-[#b8c7df]">{topic.what}</span>

            {topic.who && (
              <span className="mt-2 block text-[11px] leading-relaxed text-[#8aa2c4]">
                <b className="text-[#8ec5ff]">Кто заполняет:</b> {topic.who}
              </span>
            )}

            {topic.example && (
              <span className="mt-2 block rounded-lg border border-[#54d28c]/30 bg-[#54d28c]/8 px-2.5 py-2 text-[11px] leading-relaxed text-[#b8c7df]">
                <b className="text-[#54d28c]">Пример:</b> {topic.example}
              </span>
            )}

            {topic.mistake && (
              <span className="mt-2 block rounded-lg border border-[#ffb27a]/30 bg-[#FF6B00]/8 px-2.5 py-2 text-[11px] leading-relaxed text-[#b8c7df]">
                <b className="text-[#ffb27a]">Частая ошибка:</b> {topic.mistake}
              </span>
            )}
          </span>
        </>
      )}
    </span>
  );
}

/** Заголовок блока с подсказкой рядом — один и тот же приём на всех этапах. */
export function MasterFieldLabel({ label, topic }: { label: string; topic: HelpTopic }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5">
      <span className="text-xs font-semibold text-[#8fa8cf]">{label}</span>
      <MasterHelp topic={topic} />
    </span>
  );
}
