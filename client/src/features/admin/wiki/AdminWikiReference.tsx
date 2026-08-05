import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Info, Lightbulb, Sparkles } from "lucide-react";
import { WIKI_THEORY } from "./wiki-theory";
import { WikiDiagram, type WikiDiagramId } from "./WikiDiagrams";

/**
 * Справочник администратора. Раньше вся вики вываливалась одной длинной
 * сеткой из тринадцати карточек — читать её подряд никто не станет.
 *
 * Теперь это два уровня: слева меню разделов, справа содержание выбранного.
 * Первый раздел — теория симуляции: зачем она, откуда взялась оценка, как
 * устроен кейс и какие риски механики чем закрыты.
 */

type Dynamic = { type: "up" | "down" | "neutral"; text: string };

export interface WikiBlock {
  id: string;
  title: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  controls: string[];
  dynamics: Dynamic[];
  example: string;
}

interface ProcessStep {
  lane: string;
  title: string;
  note: string;
}

type Selection = { kind: "theory"; id: string } | { kind: "block"; id: string } | { kind: "process" };

/**
 * Высота, которая реально осталась под колонки — от их верхней кромки до низа окна.
 *
 * Раньше здесь стояло `calc(100dvh - 19rem)`: вычитаемое подобрано на глаз под
 * шапку кабинета и заголовок справочника. На другом окне шапка занимает больше,
 * и низ колонок уезжал за экран. Меряем фактическую позицию, а не угадываем.
 */
function useAvailableHeight(ref: React.RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const top = element.getBoundingClientRect().top;
      const BOTTOM_GAP = 16;
      setHeight(Math.max(320, window.innerHeight - top - BOTTOM_GAP));
    };

    measure();
    window.addEventListener("resize", measure);
    // Шапка меняет высоту при переносе строк — следим и за ней, а не только за окном.
    const observer = new ResizeObserver(measure);
    if (element.parentElement) observer.observe(element.parentElement);

    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [ref]);

  return height;
}

export function AdminWikiReference({
  onBack,
  blocks,
  processSteps,
  Shot,
}: {
  onBack: () => void;
  blocks: WikiBlock[];
  processSteps: ProcessStep[];
  Shot: React.ComponentType<{ id: string }>;
}) {
  const [selection, setSelection] = useState<Selection>({ kind: "theory", id: WIKI_THEORY[0]?.id || "" });
  // Состав раздела прячется под «+», но раздел, который открыт сейчас, показывает
  // его сразу — включая тот, что открыт при первом заходе.
  const [expandedKeys, setExpandedKeys] = useState<string[]>([`theory-${WIKI_THEORY[0]?.id || ""}`]);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const columnsHeight = useAvailableHeight(columnsRef);

  const selectionKey = (candidate: Selection) =>
    `${candidate.kind}-${"id" in candidate ? candidate.id : "process"}`;

  const openSection = (next: Selection) => {
    setSelection(next);
    // Открытый раздел сразу показывает свой состав: раньше подразделы были
    // спрятаны под «+», и о том, что внутри вообще что-то есть, догадаться
    // было нельзя.
    setExpandedKeys((keys) => {
      const key = selectionKey(next);
      return keys.includes(key) ? keys : [...keys, key];
    });
    // Новый раздел должен открыться с начала, а не с той позиции, где стоял предыдущий.
    contentRef.current?.scrollTo({ top: 0 });
  };

  /** Прокрутка правой колонки к подразделу — левое дерево при этом не двигается. */
  const scrollToPart = (partId: string) => {
    const target = contentRef.current?.querySelector(`#${CSS.escape(partId)}`);
    if (!target || !contentRef.current) return;
    const offset = target.getBoundingClientRect().top - contentRef.current.getBoundingClientRect().top;
    contentRef.current.scrollBy({ top: offset - 8, behavior: "smooth" });
  };

  const isActive = (candidate: Selection) =>
    selection.kind === candidate.kind
    && (candidate.kind === "process" || ("id" in candidate && "id" in selection && selection.id === candidate.id));

  const menuButton = (
    candidate: Selection,
    title: string,
    subtitle?: string,
    /** Состав раздела: показывается под ним, когда раздел открыт. */
    parts: { id: string; title: string }[] = [],
  ) => {
    const key = selectionKey(candidate);
    const active = isActive(candidate);
    const expanded = expandedKeys.includes(key);
    const hasDetails = Boolean(subtitle) || parts.length > 0;

    return (
      <div key={key} className="mb-0.5">
        <div
          className={`flex items-center gap-1 rounded-lg pr-1 transition ${
            active ? "bg-[#f68b1f]/15 text-white ring-1 ring-[#f68b1f]" : "text-[#8aa2c4] hover:bg-[#6fa0ff]/10"
          }`}
        >
          <button
            type="button"
            onClick={() => openSection(candidate)}
            className="min-w-0 flex-1 px-2.5 py-1.5 text-left"
          >
            <span className="block truncate text-[13px] font-semibold leading-snug" title={title}>
              {title}
            </span>
          </button>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpandedKeys((keys) => (expanded ? keys.filter((item) => item !== key) : [...keys, key]))}
              aria-expanded={expanded}
              aria-label={expanded ? `Свернуть состав: ${title}` : `Что в разделе: ${title}`}
              className="flex h-5 w-5 flex-none items-center justify-center rounded border border-[#3b5878] text-[11px] leading-none opacity-70 transition hover:opacity-100"
            >
              {expanded ? "−" : "+"}
            </button>
          )}
        </div>
        {expanded && hasDetails && (
          <div className="mb-1 ml-2.5 mt-1 border-l border-[#3b5878] pl-2.5">
            {subtitle && (
              <div className="text-[11.5px] leading-snug text-[#8fa8cf]">{subtitle}</div>
            )}
            {parts.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {parts.map((part) => (
                  <li key={part.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!active) openSection(candidate);
                        // Переход к подразделу после отрисовки нового содержимого.
                        window.requestAnimationFrame(() => scrollToPart(part.id));
                      }}
                      className="block w-full truncate rounded px-1 py-0.5 text-left text-[11.5px] leading-snug text-[#a7bcda] transition hover:bg-[#6fa0ff]/10 hover:text-white"
                      title={part.title}
                    >
                      {part.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  /** Устойчивый идентификатор подраздела: по нему идёт прокрутка правой колонки. */
  const partId = (sectionId: string, index: number) => `wiki-part-${sectionId}-${index}`;

  return (
    <div className="dns-admin-wiki-reference space-y-4">
      <section className="dns-assessor-wiki-hero">
        <div>
          <div className="dns-assessor-wiki-kicker">Справочник</div>
          <h2>Симуляция: теория и устройство кабинета</h2>
          <p>
            Слева — разделы. Начните с теории, если нужно объяснить, зачем симуляция и почему её
            оценке можно верить. Дальше — разбор каждого экрана кабинета.
          </p>
        </div>
        <button type="button" onClick={onBack} className="dns-assessor-wiki-back">
          <ArrowLeft className="h-4 w-4" />
          Вернуться в кабинет
        </button>
      </section>

      {/* Колонки прокручиваются каждая сама: раньше страница ехала целиком,
          и при открытии длинного раздела дерево уезжало вверх вместе с ним. */}
      <div
        ref={columnsRef}
        style={columnsHeight ? { height: columnsHeight } : undefined}
        className="grid gap-4 lg:grid-cols-[17.5rem,minmax(0,1fr)]"
      >
        <nav className="dns-admin-wiki-menu min-h-0 overflow-y-auto rounded-xl border border-[#243244] bg-[#101826]/70 p-3 custom-scroll">
          <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa8cf]">
            <Lightbulb className="h-3.5 w-3.5" />
            Теория симуляции
          </div>
          {WIKI_THEORY.map((section) =>
            menuButton(
              { kind: "theory", id: section.id },
              section.title,
              section.lead,
              section.blocks.map((block, index) => ({ id: partId(section.id, index), title: block.heading })),
            ),
          )}

          <div className="mb-2 mt-4 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa8cf]">
            <BookOpen className="h-3.5 w-3.5" />
            Экраны кабинета
          </div>
          {blocks.map((block) =>
            menuButton({ kind: "block", id: block.id }, block.title, block.label, [
              { id: partId(block.id, 0), title: "Как менять" },
              { id: partId(block.id, 1), title: "К чему это приводит" },
              { id: partId(block.id, 2), title: "Пример" },
            ]),
          )}

          <div className="mt-4">
            {menuButton({ kind: "process" }, "Процесс целиком", "От сборки контента до анализа результата")}
          </div>
        </nav>

        <div ref={contentRef} className="dns-admin-wiki-content min-h-0 min-w-0 overflow-y-auto pr-1 custom-scroll">
          {selection.kind === "theory" && <TheoryView sectionId={selection.id} />}
          {selection.kind === "block" && <BlockView blocks={blocks} blockId={selection.id} Shot={Shot} />}
          {selection.kind === "process" && <ProcessView steps={processSteps} />}
        </div>
      </div>
    </div>
  );
}

function TheoryView({ sectionId }: { sectionId: string }) {
  const section = WIKI_THEORY.find((item) => item.id === sectionId) || WIKI_THEORY[0];
  if (!section) return null;

  return (
    <article className="space-y-4">
      <header className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <h3 className="text-[17px] font-bold text-white">{section.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#8aa2c4]">{section.lead}</p>
      </header>

      {section.blocks.map((block, index) => (
        <section
          key={block.heading}
          id={`wiki-part-${section.id}-${index}`}
          className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4"
        >
          <h4 className="text-[14px] font-bold text-white">{block.heading}</h4>
          {block.diagram && (
            <div className="mt-3">
              <WikiDiagram id={block.diagram as WikiDiagramId} />
            </div>
          )}
          <div className="mt-3 space-y-2">
            {block.body.map((paragraph, index) => (
              <p key={`${block.heading}-${index}`} className="text-[13px] leading-relaxed text-[#dbe2f0]">
                {paragraph}
              </p>
            ))}
          </div>
          {block.example && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#54d28c]/30 bg-[#54d28c]/8 px-3 py-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-[#54d28c]" />
              <div className="text-[12.5px] leading-relaxed text-[#dbe2f0]">
                <b className="text-[#54d28c]">Пример:</b> {block.example}
              </div>
            </div>
          )}
        </section>
      ))}

      {section.sources && section.sources.length > 0 && (
        <section className="rounded-xl border border-[#4a9eff]/35 bg-[#4a9eff]/8 p-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#b7d9ff]">
            <Info className="h-3.5 w-3.5" />
            Матчасть, на которой это построено
          </div>
          <ul className="mt-2 space-y-1">
            {section.sources.map((source) => (
              <li key={source} className="text-[12.5px] leading-relaxed text-[#dbe2f0]">
                · {source}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function BlockView({
  blocks,
  blockId,
  Shot,
}: {
  blocks: WikiBlock[];
  blockId: string;
  Shot: React.ComponentType<{ id: string }>;
}) {
  const block = blocks.find((item) => item.id === blockId) || blocks[0];
  if (!block) return null;
  const Icon = block.icon;

  return (
    <article className="space-y-4">
      <header className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-[#3b5878] text-[#8ec5ff]">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-bold text-white">{block.title}</h3>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#8aa2c4]">{block.label}</p>
          </div>
        </div>
        <div className="mt-3">
          <Shot id={block.id} />
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-[#dbe2f0]">{block.summary}</p>
      </header>

      <section id={`wiki-part-${block.id}-0`} className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <h4 className="text-[14px] font-bold text-white">Как менять</h4>
        <ul className="mt-2 space-y-1.5">
          {block.controls.map((item) => (
            <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-[#dbe2f0]">
              <span className="text-[#8fa8cf]">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id={`wiki-part-${block.id}-1`} className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <h4 className="text-[14px] font-bold text-white">К чему это приводит</h4>
        <div className="mt-2 space-y-2">
          {block.dynamics.map((item) => (
            <div
              key={item.text}
              className={`rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${
                item.type === "up"
                  ? "border-[#54d28c]/35 bg-[#54d28c]/8 text-[#dbe2f0]"
                  : item.type === "down"
                    ? "border-[#ffb27a]/35 bg-[#f68b1f]/8 text-[#dbe2f0]"
                    : "border-[#4a9eff]/30 bg-[#4a9eff]/8 text-[#dbe2f0]"
              }`}
            >
              {item.text}
            </div>
          ))}
        </div>
      </section>

      <section id={`wiki-part-${block.id}-2`} className="flex items-start gap-2 rounded-xl border border-[#54d28c]/30 bg-[#54d28c]/8 p-4">
        <Sparkles className="mt-0.5 h-4 w-4 flex-none text-[#54d28c]" />
        <div className="text-[13px] leading-relaxed text-[#dbe2f0]">
          <b className="text-[#54d28c]">Пример:</b> {block.example}
        </div>
      </section>
    </article>
  );
}

function ProcessView({ steps }: { steps: ProcessStep[] }) {
  return (
    <article className="space-y-4">
      <header className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <h3 className="text-[17px] font-bold text-white">Процесс целиком</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#8aa2c4]">
          Кто что делает: администратор собирает контент, система строит сценарий, оценщик запускает,
          участник проходит, результат возвращается в настройку.
        </p>
      </header>

      <section className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={`${step.lane}-${step.title}`} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md border border-[#3b5878] text-[11px] font-bold text-[#8ec5ff]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-full border border-[#3b5878] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8fa8cf]">
                    {step.lane}
                  </span>
                  <span className="text-[13px] font-semibold text-white">{step.title}</span>
                </div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-[#8aa2c4]">{step.note}</div>
              </div>
              {index < steps.length - 1 && <ArrowRight className="mt-3 h-3.5 w-3.5 flex-none text-[#8fa8cf] opacity-50" />}
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
