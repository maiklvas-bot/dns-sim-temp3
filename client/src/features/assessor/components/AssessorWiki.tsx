import type React from "react";
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, BookOpen,
  ChevronDown, ChevronUp, ClipboardCheck, Gauge, GitBranch, Info, ListChecks, Map,
  MousePointerClick, Settings2, Shield, SlidersHorizontal, Target, UserCheck,
} from "lucide-react";

type AssessorWikiFocus =
  | "entry"
  | "wizard"
  | "participant"
  | "difficulty"
  | "mode"
  | "advanced"
  | "cases"
  | "channels"
  | "metrics"
  | "sessions";

const ASSESSOR_WIKI_BLOCKS: Array<{
  id: string;
  focus: AssessorWikiFocus;
  title: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  controls: string[];
  dynamics: Array<{ type: "up" | "down" | "neutral"; text: string }>;
}> = [
  {
    id: "entry",
    focus: "entry",
    title: "Вход в WIKI оценщика",
    label: "Большая кнопка вверху кабинета",
    icon: BookOpen,
    summary: "Отдельная точка входа в инструкцию. Оценщик может открыть методику до запуска, не ломая текущий мастер настройки.",
    controls: [
      "Открыть WIKI - перейти к подробной карте настройки.",
      "Вернуться к настройке - снова показать обычный мастер оценщика.",
    ],
    dynamics: [
      { type: "neutral", text: "На оценку не влияет. Это навигационный и обучающий элемент." },
      { type: "up", text: "Снижает риск неверной настройки, потому что объясняет зависимость до запуска." },
    ],
  },
  {
    id: "wizard",
    focus: "wizard",
    title: "Мастер настройки",
    label: "3 шага: участник, сложность, запуск",
    icon: ListChecks,
    summary: "Главный сценарий оценщика. Он ведет от ввода людей к выбору нагрузки и финальному запуску live-сессии.",
    controls: [
      "Шаг 1 фиксирует, кого оцениваем и кто проводит оценку.",
      "Шаг 2 задает базовую сложность, режим и стартовый контекст магазина.",
      "Шаг 3 проверяет итоговую конфигурацию и открывает расширенные настройки.",
    ],
    dynamics: [
      { type: "up", text: "Последовательное прохождение снижает шанс забыть обязательные поля и получить неполный отчет." },
      { type: "down", text: "Если менять только расширенные параметры, можно сузить доказательную базу по компетенциям." },
    ],
  },
  {
    id: "participant",
    focus: "participant",
    title: "Участник и тип симуляции",
    label: "ФИО, роль и сценарная роль",
    icon: UserCheck,
    summary: "Блок отвечает за идентификацию оценки и будущий профиль прохождения. Сейчас активна базовая симуляция участника.",
    controls: [
      "ФИО оценщика попадает в сессию и итоговый отчет.",
      "ФИО участника связывает live-сессию, результат и PDF/экспорт.",
      "Тип симуляции определяет сценарную роль. Недоступные роли показаны как будущие режимы.",
    ],
    dynamics: [
      { type: "neutral", text: "ФИО не меняют баллы компетенций, но влияют на корректность отчета и поиск результата." },
      { type: "up", text: "Когда будут активны новые роли, выбор роли изменит набор ситуаций и проверяемые управленческие контексты." },
    ],
  },
  {
    id: "difficulty",
    focus: "difficulty",
    title: "Сложность",
    label: "Количество ситуаций, каналы и время",
    icon: Shield,
    summary: "Сложность задает стартовый профиль испытания: сколько кейсов будет, какие каналы включены и сколько времени заложено.",
    controls: [
      "Легкий уровень - меньше ситуаций и только базовые сигналы.",
      "Средний уровень - рабочая нагрузка с несколькими каналами.",
      "Сложный уровень - максимум ситуаций, каналов и управленческого давления.",
    ],
    dynamics: [
      { type: "up", text: "Повышение сложности увеличивает число решений и ширину проверки компетенций." },
      { type: "down", text: "Понижение сложности уменьшает нагрузку, но может снизить видимость компетенций, которые проявляются только в сложных кейсах." },
    ],
  },
  {
    id: "mode",
    focus: "mode",
    title: "Рекомендованный и экспертный режим",
    label: "Автосборка или ручная настройка",
    icon: Gauge,
    summary: "Рекомендованный режим собирает сценарий автоматически. Экспертный режим открывает ручные уровни влияния: кейсы, каналы, стартовые метрики и скорость тренировки.",
    controls: [
      "Рекомендованный - оценщик выбирает смысл оценки, система подбирает состав.",
      "Экспертный - методист вручную меняет доказательную базу и нагрузку.",
      "Тренировочная скорость доступна только внутри экспертных настроек.",
    ],
    dynamics: [
      { type: "up", text: "Рекомендованный режим снижает риск случайной ошибки: параметры связаны с выбранной сложностью." },
      { type: "down", text: "Экспертный режим дает полный контроль, но требует проверить все поля: пустые кейсы, каналы или метрики блокируют запуск." },
    ],
  },
  {
    id: "advanced",
    focus: "advanced",
    title: "Расширенные настройки",
    label: "Ручной контроль сценария",
    icon: Settings2,
    summary: "Свернутый блок для опытного оценщика. Он меняет доказательную базу оценки: кейсы, каналы, события и стартовые метрики.",
    controls: [
      "Открыть блок - показать ручной выбор ситуаций, каналов и метрик.",
      "Закрыть блок - оставить автоматический профиль по выбранной сложности.",
    ],
    dynamics: [
      { type: "up", text: "Расширенные настройки полезны для целевой проверки конкретной зоны компетенций." },
      { type: "down", text: "Чрезмерное сужение сценария может сделать итоговый профиль менее репрезентативным." },
    ],
  },
  {
    id: "cases",
    focus: "cases",
    title: "Выбор ситуаций",
    label: "Автоподбор, ручной выбор, повтор кейсов",
    icon: Target,
    summary: "Ситуации являются основной доказательной базой. В каждом кейсе есть варианты решений, метрики и оценки компетенций.",
    controls: [
      "Автоподбор выбирает число ситуаций по сложности.",
      "Ручной выбор оставляет только отмеченные кейсы.",
      "Повтор по циклу разрешает повторять ситуации, если сценарий идет дольше набора кейсов.",
    ],
    dynamics: [
      { type: "up", text: "Добавление кейсов увеличивает количество наблюдений и устойчивость оценки." },
      { type: "down", text: "Исключение кейса убирает его вклад. Например, если убрать кейсы на делегирование, влияние на компетенцию делегирования снизится или исчезнет." },
    ],
  },
  {
    id: "channels",
    focus: "channels",
    title: "Каналы и события",
    label: "Звонки, почта, мессенджер, видео",
    icon: SlidersHorizontal,
    summary: "Каналы управляют тем, откуда приходят сигналы. События внутри каналов добавляют отдельные управленческие развилки.",
    controls: [
      "Включить канал - добавить тип сигналов в симуляцию.",
      "Отключить канал - убрать этот поток сигналов.",
      "Выбор событий - оставить конкретные письма, сообщения или видеообращения.",
    ],
    dynamics: [
      { type: "up", text: "Больше каналов повышают многозадачность и проверяют переключение внимания." },
      { type: "down", text: "Отключение почты или мессенджера снижает число письменных управленческих развилок и их вклад в компетенции." },
    ],
  },
  {
    id: "metrics",
    focus: "metrics",
    title: "Стартовые метрики магазина",
    label: "Начальное состояние подразделения",
    icon: Activity,
    summary: "Метрики задают фон смены: нагрузку, настроение команды, клиентскую оценку, склад, скорость выдачи и выручку.",
    controls: [
      "Готовые состояния задают быстрый профиль нагрузки от спокойного до критического.",
      "Ручные поля позволяют тонко настроить начальные значения.",
      "Эти показатели затем меняются решениями участника.",
    ],
    dynamics: [
      { type: "up", text: "Более высокий стартовый стресс делает последствия решений заметнее в динамике магазина." },
      { type: "down", text: "Если задать слишком спокойный старт, часть управленческих ошибок будет визуально менее заметна по метрикам." },
    ],
  },
  {
    id: "sessions",
    focus: "sessions",
    title: "Текущие симуляции",
    label: "Наблюдение, прогресс, результаты",
    icon: ClipboardCheck,
    summary: "Оценщик видит активные и завершенные live-сессии, может открыть наблюдение или перейти к результатам.",
    controls: [
      "Наблюдать - открыть текущую симуляцию без вмешательства в решения участника.",
      "Результаты - перейти к отчету завершенной сессии.",
      "Следующий с копией - подготовить нового испытуемого с теми же настройками.",
      "Пустая настройка - начать новую карточку без переноса параметров.",
      "Удалить - убрать live-сессию из текущего списка.",
    ],
    dynamics: [
      { type: "neutral", text: "Наблюдение не меняет баллы: оно только показывает ход прохождения." },
      { type: "down", text: "Удаление незавершенной live-сессии может прервать доступ к ее текущему состоянию." },
    ],
  },
];

const WIKI_PROCESS_STEPS = [
  { lane: "Оценщик", title: "Вводит участников", note: "ФИО связывают сессию и отчет." },
  { lane: "Оценщик", title: "Выбирает сложность", note: "Зависимость: кейсы, каналы, время." },
  { lane: "Оценщик", title: "Настраивает сценарий", note: "Зависимость: покрытие компетенций." },
  { lane: "Система", title: "Создает live-сессию", note: "Код получает участник." },
  { lane: "Участник", title: "Проходит симуляцию", note: "Решения меняют метрики и оценки." },
  { lane: "Система", title: "Считает результат", note: "Компетенции, средний балл, динамика." },
  { lane: "Оценщик", title: "Разбирает отчет", note: "Решения, сильные зоны, ИПР." },
] as const;

function WikiScreenshot({ focus, label }: { focus: AssessorWikiFocus; label: string }) {
  const cards: Array<{ focus: AssessorWikiFocus; title: string; note: string }> = [
    { focus: "participant", title: "Участник", note: "ФИО и роль" },
    { focus: "difficulty", title: "Сценарий", note: "уровень нагрузки" },
    { focus: "mode", title: "Режим", note: "авто / эксперт" },
    { focus: "advanced", title: "Расширенно", note: "ручные параметры" },
    { focus: "cases", title: "Кейсы", note: "состав оценки" },
    { focus: "channels", title: "Каналы", note: "почта, чат, видео" },
    { focus: "metrics", title: "Метрики", note: "старт магазина" },
    { focus: "sessions", title: "Результаты", note: "сессии и отчеты" },
  ];

  return (
    <div className={`dns-assessor-wiki-shot dns-assessor-wiki-shot--${focus}`} aria-label={`Скриншот: ${label}`}>
      <div className="dns-assessor-wiki-shot-top">
        <span>Панель оценщика</span>
        <span>live-сессия</span>
      </div>
      <div className="dns-assessor-wiki-shot-entry">WIKI оценщика</div>
      <div className="dns-assessor-wiki-shot-steps">
        <span>1. Люди</span>
        <span>2. Сценарий</span>
        <span>3. Запуск</span>
      </div>
      <div className="dns-assessor-wiki-shot-grid">
        {cards.map((card) => {
          const active = focus === card.focus;
          const overview = focus === "entry" || focus === "wizard";
          return (
            <div
              key={card.focus}
              className={`dns-assessor-wiki-shot-card dns-assessor-wiki-shot-card--${card.focus} ${
                active ? "dns-assessor-wiki-shot-card--focus" : overview ? "dns-assessor-wiki-shot-card--overview" : "dns-assessor-wiki-shot-card--dim"
              }`}
            >
              <strong>{card.title}</strong>
              <span>{card.note}</span>
            </div>
          );
        })}
      </div>
      <div className="dns-assessor-wiki-shot-highlight" aria-hidden="true" />
      <div className="dns-assessor-wiki-shot-callout">{label}</div>
    </div>
  );
}

export function AssessorWiki({
  onBack,
  processOpen,
  onToggleProcess,
}: {
  onBack: () => void;
  processOpen: boolean;
  onToggleProcess: () => void;
}) {
  return (
    <div className="dns-assessor-wiki space-y-5">
      <section className="dns-assessor-wiki-hero">
        <div>
          <div className="dns-assessor-wiki-kicker">WIKI оценщика</div>
          <h2>Как настроить и провести симуляцию</h2>
          <p>
            Эта страница объясняет каждый блок меню оценщика: что он меняет, как влияет на сценарий,
            где возникает зависимость и какой результат увидит заказчик в отчете.
          </p>
        </div>
        <button type="button" onClick={onBack} className="dns-assessor-wiki-back">
          <ArrowLeft className="h-4 w-4" />
          Вернуться к настройке
        </button>
      </section>

      <section className="dns-assessor-wiki-summary">
        <div>
          <MousePointerClick className="h-5 w-5" />
          <span>1. Оценщик задает рамки</span>
        </div>
        <div>
          <GitBranch className="h-5 w-5" />
          <span>2. Система строит сценарий</span>
        </div>
        <div>
          <Activity className="h-5 w-5" />
          <span>3. Участник принимает решения</span>
        </div>
        <div>
          <ClipboardCheck className="h-5 w-5" />
          <span>4. Отчет показывает доказательства</span>
        </div>
      </section>

      <section className="dns-assessor-wiki-note">
        <Info className="h-5 w-5" />
        <div>
          <h3>Главный принцип оценки</h3>
          <p>
            Итог не должен быть "ощущением оценщика". Он строится из решений участника:
            выбранные кейсы и каналы дают ситуации, решения меняют метрики магазина и формируют
            вклад в компетенции, а отчет собирает это в понятную картину.
          </p>
        </div>
      </section>

      <section className="dns-assessor-wiki-grid">
        {ASSESSOR_WIKI_BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <article key={block.id} className="dns-assessor-wiki-card">
              <div className="dns-assessor-wiki-card-head">
                <div className="dns-assessor-wiki-icon">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3>{block.title}</h3>
                  <p>{block.label}</p>
                </div>
              </div>
              <WikiScreenshot focus={block.focus} label={block.label} />
              <p className="dns-assessor-wiki-card-summary">{block.summary}</p>
              <div className="dns-assessor-wiki-columns">
                <div>
                  <h4>Как менять</h4>
                  <ul>
                    {block.controls.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Динамика</h4>
                  <ul>
                    {block.dynamics.map((item) => (
                      <li key={item.text} className={`dns-assessor-wiki-dynamic dns-assessor-wiki-dynamic--${item.type}`}>
                        {item.type === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
                        {item.type === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
                        {item.type === "neutral" && <Info className="h-3.5 w-3.5" />}
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="dns-assessor-wiki-process">
        <button type="button" onClick={onToggleProcess} className="dns-assessor-wiki-process-toggle">
          <div>
            <div className="dns-assessor-wiki-kicker">Процесс оценки</div>
            <h3>BPMN-схема настройки и прохождения симуляции</h3>
            <p>Большой блок для сотрудника без погружения в механику: от настройки до отчета.</p>
          </div>
          {processOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {processOpen && (
          <div className="dns-assessor-bpmn">
            <div className="dns-assessor-bpmn-lanes">
              <span>Оценщик</span>
              <span>Система</span>
              <span>Участник</span>
            </div>
            <div className="dns-assessor-bpmn-flow">
              {WIKI_PROCESS_STEPS.map((step, index) => (
                <div key={`${step.lane}-${step.title}`} className="dns-assessor-bpmn-node">
                  <div className="dns-assessor-bpmn-lane">{step.lane}</div>
                  <div className="dns-assessor-bpmn-title">{step.title}</div>
                  <div className="dns-assessor-bpmn-note">{step.note}</div>
                  {index < WIKI_PROCESS_STEPS.length - 1 && <ArrowRight className="dns-assessor-bpmn-arrow h-4 w-4" />}
                </div>
              ))}
            </div>
            <div className="dns-assessor-bpmn-dependencies">
              <div>
                <Target className="h-4 w-4" />
                Сложность и ручной выбор определяют, какие компетенции реально проверяются.
              </div>
              <div>
                <SlidersHorizontal className="h-4 w-4" />
                Каналы и события определяют поток сигналов и управленческую нагрузку.
              </div>
              <div>
                <BarChart3 className="h-4 w-4" />
                Стартовые метрики задают исходный контекст, а решения участника двигают показатели вверх или вниз.
              </div>
              <div>
                <Map className="h-4 w-4" />
                Итоговый отчет связывает решения, метрики и компетенции в доказательный результат.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
