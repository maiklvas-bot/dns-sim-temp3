import type { CompetencyDefinition } from "@shared/simulation-content";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { competencyCategoryLabel } from "@/data/competencies";

/**
 * Полная справка по компетенциям для автора кейса: что такое роль компетенции,
 * как проявление вообще попадает в оценку, что произойдёт с результатом при
 * разной разметке. Открывается по клику на заголовок «Компетенции кейса».
 */
export function CompetencyGuideDialog({
  open,
  onOpenChange,
  competencies,
  themeClass,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  competencies: CompetencyDefinition[];
  themeClass: string;
}) {
  const byCategory = competencies.reduce<Record<string, CompetencyDefinition[]>>((acc, competency) => {
    const key = competency.category || "other";
    acc[key] = acc[key] || [];
    acc[key].push(competency);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`dns-product-shell dns-admin-shell ${themeClass} flex h-[90vh] max-h-[90vh] w-[94vw] max-w-[900px] flex-col gap-0 overflow-hidden p-0`}
      >
        <DialogHeader className="space-y-0.5 border-b border-border px-5 py-3.5 text-left">
          <DialogTitle className="text-[15px]">Компетенции кейса — как это работает</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Что вы размечаете, как это превращается в оценку сотрудника и к чему приводят ошибки разметки.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 custom-scroll">
          <section className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
            <h3 className="text-sm font-semibold text-white">Зачем вообще размечать компетенции</h3>
            <div className="mt-2 space-y-2 text-[12px] leading-relaxed text-[#b8c7df]">
              <p>
                Симуляция не оценивает «правильность» ответа сама по себе. Она смотрит, <b>какое поведение</b> человек
                выбрал, и складывает из этих выборов профиль: где сильно, где провал. Чтобы это стало возможно, каждый
                вариант ответа должен быть заранее привязан к компетенциям.
              </p>
              <p>
                Компетенции кейса на этапе «Замысел» — это <b>рамка</b>: какие качества вы вообще собираетесь смотреть в
                этой ситуации. Дальше на этапе «Решения» вы для каждого варианта указываете, насколько сильно он эти
                качества проявляет. Без рамки разметка вариантов превращается в набор случайных галочек.
              </p>
              <p className="text-[#ffd36e]">
                Это и есть ответ на вопрос «почему мы должны верить оценке»: она не выведена алгоритмом, она собрана из
                ваших собственных решений о том, что считать сильным поведением.
              </p>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#4a9eff]/40 bg-[#4a9eff]/8 p-3">
              <div className="text-xs font-semibold text-[#b7d9ff]">Первичная</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-[#b8c7df]">
                То, ради чего кейс существует. Даёт основной вес в итоговой оценке. Если по ней у человека провал —
                это видно в отчёте как главный вывод по кейсу.
              </div>
              <div className="mt-2 text-[11px] text-[#8aa2c4]">
                <b>Сколько:</b> одна-две на кейс. Три и больше — кейс расфокусирован.
              </div>
            </div>
            <div className="rounded-xl border border-[#00d4aa]/40 bg-[#00d4aa]/8 p-3">
              <div className="text-xs font-semibold text-[#8ff5de]">Вторичная</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-[#b8c7df]">
                Проявится попутно. Добавляет дополнительный вес, но не определяет вывод по кейсу. Нужна там, где
                качество реально видно в ситуации, но проверять его специально вы не собирались.
              </div>
              <div className="mt-2 text-[11px] text-[#8aa2c4]">
                <b>Сколько:</b> сколько честно проявляется, обычно одна-три.
              </div>
            </div>
            <div className="rounded-xl border border-[#243244] bg-[#0d1522]/70 p-3">
              <div className="text-xs font-semibold text-[#9aabc6]">Нет</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-[#b8c7df]">
                В этом кейсе не оценивается. Это нормальное и частое состояние: один кейс не может проверять
                четырнадцать качеств сразу.
              </div>
              <div className="mt-2 text-[11px] text-[#8aa2c4]">
                <b>Сколько:</b> большинство списка.
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
            <h3 className="text-sm font-semibold text-white">Как проявление попадает в оценку</h3>
            <ol className="mt-2 space-y-2 text-[12px] leading-relaxed text-[#b8c7df]">
              <li>
                <b className="text-[#8ec5ff]">1.</b> Здесь вы отмечаете компетенцию первичной или вторичной — задаёте,
                что кейс смотрит.
              </li>
              <li>
                <b className="text-[#8ec5ff]">2.</b> На этапе «Решения» у каждого варианта ответа выставляете уровень
                проявления: слабо, средне или сильно. За каждым уровнем стоит описанное поведение, одинаковое во всех
                кейсах — поэтому оценки разных кейсов можно складывать.
              </li>
              <li>
                <b className="text-[#8ec5ff]">3.</b> Участник выбирает вариант — уровень уходит в его профиль.
              </li>
              <li>
                <b className="text-[#8ec5ff]">4.</b> По всем пройденным кейсам собирается итог: где человек устойчиво
                силён, где проседает. Вес первичных выше, поэтому кейс отвечает именно за то, ради чего создан.
              </li>
            </ol>
          </section>

          <section className="rounded-xl border border-[#ffb27a]/35 bg-[#FF6B00]/8 p-4">
            <h3 className="text-sm font-semibold text-[#ffb27a]">Что ломается при неаккуратной разметке</h3>
            <div className="mt-2 space-y-2.5 text-[12px] leading-relaxed text-[#b8c7df]">
              <p>
                <b>Отметить первичными половину списка.</b> Кейс перестаёт что-либо проверять: любой ответ задевает всё
                сразу, и объяснить сотруднику его результат невозможно. Самая частая ошибка.
              </p>
              <p>
                <b>Разметить компетенцию, которой в вариантах нет.</b> Вы объявили, что смотрите «Делегирование», но ни
                один вариант ответа его не проявляет — компетенция остаётся без данных и в отчёте выглядит как пробел.
              </p>
              <p>
                <b>Сделать «лучший» вариант сильным сразу по всем.</b> Тогда правильный ответ виден по форме: чем выше
                вариант в списке, тем выше всё. Участник выберет последний, не думая, — и кейс измерит его
                сообразительность, а не управленческое качество. Автопроверка ловит это отдельным замечанием.
              </p>
              <p>
                <b>Смешать «что человек сделал» и «насколько он хорош».</b> Уровень — это не оценка личности, а
                описание конкретного поведения в конкретной ситуации. Один и тот же человек может быть сильным по
                планированию и слабым по коммуникации в одном и том же ответе — это нормальный профиль.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
            <h3 className="text-sm font-semibold text-white">Разобранный пример</h3>
            <div className="mt-2 text-[12px] leading-relaxed text-[#b8c7df]">
              Кейс «Очередь на кассе в час пик». Первичные — <b>Планирование</b> и <b>Принятие решений</b>: ситуация
              про то, как человек распоряжается ограниченным ресурсом под давлением. Вторичная —{" "}
              <b>Коммуникация</b>: она проявится, когда придётся снимать сотрудника с приёмки. Всё остальное — «Нет».
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-[#223245] bg-[#0d1522]/75 px-3 py-2 text-[12px] text-[#b8c7df]">
                «Встать на кассу самому» — Планирование <b className="text-[#ffd36e]">слабо</b>, Принятие решений{" "}
                <b className="text-[#ffd36e]">средне</b>, Коммуникация <b className="text-[#8aa2c4]">не влияет</b>.
                <div className="mt-1 text-[11px] text-[#8aa2c4]">
                  Проблему снял, но заместитель управляющего выключил себя из управления сменой.
                </div>
              </div>
              <div className="rounded-lg border border-[#223245] bg-[#0d1522]/75 px-3 py-2 text-[12px] text-[#b8c7df]">
                «Снять сотрудника с приёмки, предупредив кладовщика о сдвиге» — Планирование{" "}
                <b className="text-[#7fffd4]">сильно</b>, Принятие решений <b className="text-[#7fffd4]">сильно</b>,
                Коммуникация <b className="text-[#7fffd4]">сильно</b>.
              </div>
              <div className="rounded-lg border border-[#223245] bg-[#0d1522]/75 px-3 py-2 text-[12px] text-[#b8c7df]">
                «Написать в чат руководителю и ждать указаний» — Планирование{" "}
                <b className="text-[#ffd36e]">слабо</b>, Принятие решений <b className="text-[#ffd36e]">слабо</b>,
                Коммуникация <b className="text-[#7fffd4]">сильно</b>.
                <div className="mt-1 text-[11px] text-[#8aa2c4]">
                  Обратите внимание: этот вариант слабый по фокусу кейса, но сильный по коммуникации. Именно так и
                  выглядит профиль вместо лестницы.
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
            <h3 className="text-sm font-semibold text-white">Компетенции в этой системе</h3>
            <div className="mt-1 text-[11px] text-[#8aa2c4]">
              Список закреплён профилем должности — в кейсе он не редактируется, только размечается.
            </div>
            <div className="mt-3 space-y-3">
              {Object.entries(byCategory).map(([category, items]) => (
                <div key={category}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7d9bc9]">
                    {competencyCategoryLabel(category)}
                  </div>
                  <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
                    {items.map((competency) => (
                      <div
                        key={competency.id}
                        className="rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2"
                      >
                        <div className="text-[12px] font-semibold text-white">{competency.name}</div>
                        {competency.description && (
                          <div className="mt-0.5 text-[11px] leading-relaxed text-[#8aa2c4]">
                            {competency.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
