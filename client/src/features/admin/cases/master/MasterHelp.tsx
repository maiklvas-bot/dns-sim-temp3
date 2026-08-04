import { useState } from "react";
import { FloatingCard } from "@/components/floating-card";
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
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  return (
    <span className="dns-master-help inline-flex">
      <button
        type="button"
        onClick={(event) => {
          if (anchor) {
            setAnchor(null);
            return;
          }
          // Привязываемся к самой кнопке в координатах окна: карточка в портале.
          const box = event.currentTarget.getBoundingClientRect();
          setAnchor({ x: box.left, y: box.bottom });
        }}
        aria-expanded={Boolean(anchor)}
        aria-label={`Что такое «${topic.title}»`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#3b5878] text-[#8ec5ff] transition hover:border-[#6fa0ff] hover:bg-[#6fa0ff]/10"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {anchor && (
        <>
          {/* Клик мимо закрывает окно — иначе подсказки копятся на экране. */}
          <span className="fixed inset-0 z-[70]" onClick={() => setAnchor(null)} aria-hidden="true" />
          <FloatingCard anchor={anchor} width={396} className="text-left">
            <span className="block text-[13px] font-semibold text-white">{topic.title}</span>
            <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[#b8c7df]">{topic.what}</span>

            {topic.who && (
              <span className="mt-2 block text-[12px] leading-relaxed text-[#8aa2c4]">
                <b className="text-[#8ec5ff]">Кто заполняет:</b> {topic.who}
              </span>
            )}

            {topic.example && (
              <span className="mt-2 block rounded-lg border border-[#54d28c]/30 bg-[#54d28c]/8 px-2.5 py-2 text-[12px] leading-relaxed text-[#b8c7df]">
                <b className="text-[#54d28c]">Пример:</b> {topic.example}
              </span>
            )}

            {topic.mistake && (
              <span className="mt-2 block rounded-lg border border-[#ffb27a]/30 bg-[#f68b1f]/8 px-2.5 py-2 text-[12px] leading-relaxed text-[#b8c7df]">
                <b className="text-[#ffb27a]">Частая ошибка:</b> {topic.mistake}
              </span>
            )}
          </FloatingCard>
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
