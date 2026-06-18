import type React from "react";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, BookOpen,
  CalendarClock, ChevronDown, ChevronUp, ClipboardCheck, GitBranch, Info, LayoutGrid,
  ListChecks, Map, MousePointerClick, Radio, Settings2, SlidersHorizontal, Sparkles,
  Target, Workflow,
} from "lucide-react";

type Dynamic = { type: "up" | "down" | "neutral"; text: string };

const ADMIN_WIKI_BLOCKS: Array<{
  id: string;
  title: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  controls: string[];
  dynamics: Dynamic[];
  example: string;
}> = [
  {
    id: "dashboard",
    title: "Кабинет · обзор",
    label: "Стартовый экран: KPI, готовность, профиль компетенций",
    icon: LayoutGrid,
    summary: "Сводка готовности симуляции к запуску. Показывает, сколько кейсов и прохождений есть, средний балл и что нужно проверить перед запуском.",
    controls: [
      "KPI-плитки — число кейсов, завершённых прохождений, средний балл, готовность.",
      "«Что проверить до запуска» — чеклист с переходами в нужный раздел по кнопке «Открыть».",
      "Радар «Профиль компетенций» — НАДО (ожидаемый профиль) и ФАКТ (средний результат).",
    ],
    dynamics: [
      { type: "neutral", text: "Сам обзор ничего не меняет — это навигация и контроль готовности." },
      { type: "up", text: "Снижает риск запустить симуляцию с пустыми кейсами или без медиа." },
    ],
    example: "Готовность 80% и пункт «Кейсы без циклов: 2» → жми «Открыть», добавь циклы, и готовность станет 100%.",
  },
  {
    id: "rail",
    title: "Рабочий центр · навигация",
    label: "Левый рейл: Кабинет, Кейсы, Каналы, Расписание, Результаты, Сравнение, Настройки",
    icon: Workflow,
    summary: "Разделяет два уровня настройки: «под капотом» (механика симуляции) и «на поверхности» (контент кейсов и каналов). Каждый раздел отвечает за свою часть сценария.",
    controls: [
      "Клик по разделу переключает рабочую область справа.",
      "Внизу — профиль администратора, Wiki и История изменений.",
    ],
    dynamics: [
      { type: "neutral", text: "Навигация на оценку не влияет." },
      { type: "up", text: "Логичный порядок разделов помогает не забыть шаг настройки." },
    ],
    example: "Сначала «Кейсы» (что произойдёт) → «Каналы» (параллельная нагрузка) → «Расписание» (тайминги) → «Настройки» (веса).",
  },
  {
    id: "cases",
    title: "Кейсы · библиотека",
    label: "Список кейсов сеткой + кнопка «Новый»",
    icon: ClipboardCheck,
    summary: "Библиотека управленческих ситуаций. Каждый кейс — это сигнал, контекст, циклы развития и варианты ответа. Клик по кейсу открывает окно редактора.",
    controls: [
      "«Новый» — мастер создания кейса (4 шага: контекст, сигнал, первый цикл, тайминги).",
      "Стрелки ↑↓ — порядок показа кейса.",
      "Клик по карточке — открыть редактор кейса в отдельном окне.",
    ],
    dynamics: [
      { type: "up", text: "Больше проработанных кейсов → шире доказательная база по компетенциям." },
      { type: "down", text: "Кейс без циклов нельзя пройти — он не даёт вклада в оценку." },
    ],
    example: "Кейс «Конфликт в зоне выдачи» проверяет эмпатию и деэскалацию: сигнал → 3 цикла → варианты ответа с баллами.",
  },
  {
    id: "editor-card",
    title: "Редактор · Карточка кейса",
    label: "Название, описание, тайминг, медиа, компетенции",
    icon: ListChecks,
    summary: "Базовые свойства кейса. Здесь задаётся, что проверяет кейс (основные/вторичные компетенции), медиа по умолчанию и тайминг хода симуляции.",
    controls: [
      "Компетенции кейса — основные (главный фокус) и вторичные (дополнительное наблюдение).",
      "Медиа по умолчанию — fallback-изображение и озвучка, если у цикла нет своих.",
      "Тайминг — мин/макс интервал, срок решения, повтор напоминания.",
    ],
    dynamics: [
      { type: "up", text: "Точно заданные основные компетенции делают оценку прозрачной." },
      { type: "down", text: "Если компетенции не выбраны — вклад кейса в профиль почти не объясняется." },
    ],
    example: "Основные: «Эмпатия», «Деэскалация»; вторичная: «Регламент». Тайминг: интервал 45–90 сек, решение 180 сек.",
  },
  {
    id: "cycles",
    title: "Редактор · Циклы (степпер)",
    label: "Номера циклов слева, один цикл — одно окно",
    icon: GitBranch,
    summary: "Цикл — этап развития ситуации внутри кейса. Простой кейс = 1 сценарий-ответ; кейс с циклами = ветвление. Степпер слева показывает структуру целиком.",
    controls: [
      "Номера 1·2·3 на левой грани — переключение между циклами.",
      "«+ Цикл» — добавить этап (простой кейс превращается в кейс с циклами).",
      "Ситуация, тип и текст сигнала, медиа цикла, зоны магазина, «Финальный цикл».",
    ],
    dynamics: [
      { type: "up", text: "Ветвление по циклам делает сценарий живым и проверяет реакцию в развитии." },
      { type: "down", text: "Лишние пустые циклы без вариантов ответа удлиняют прохождение без пользы." },
    ],
    example: "Цикл 1 — клиент жалуется; ответ A ведёт к Циклу 2 (эскалация), ответ B завершает кейс (финальный цикл).",
  },
  {
    id: "options",
    title: "Редактор · Варианты ответа",
    label: "Аккордеон вариантов: текст, балл, влияние на компетенции, переход",
    icon: SlidersHorizontal,
    summary: "Варианты ответа формируют фактический вклад кейса в результат. Каждый вариант даёт балл, усиливает компетенции и может вести к следующему циклу.",
    controls: [
      "Текст варианта (видит участник) и балл (+/−).",
      "Влияние на компетенции — ползунки силы по каждой компетенции.",
      "«После ответа запустить» — связь ответа с конкретным циклом.",
      "Статус: «Активен» показывается участнику; «Скрыт»/«Черновик» — нет.",
    ],
    dynamics: [
      { type: "up", text: "Чёткий эталонный ответ с весами компетенций даёт честный балл." },
      { type: "down", text: "Вариант без верного эталона в цикле → балл за цикл не учитывается." },
    ],
    example: "Ответ «Признать эмоцию, уточнить причину»: +10, Эмпатия ×1.4, Деэскалация ×1.2 → переход к Циклу 3.",
  },
  {
    id: "impact",
    title: "Редактор · Влияние выбранного кейса",
    label: "Правая панель: бары компетенций, обновляется в моменте",
    icon: Target,
    summary: "Показывает, как настройка кейса влияет на профиль компетенций. Синий — базовый профиль выбранного кейса (статичен), бирюзовый — фактический вклад с учётом веса.",
    controls: [
      "Бары по компетенциям: «Профиль кейса» (синий) и «Регулируемый вклад» (бирюзовый).",
      "Предпросмотр логики «ответ → цикл» без запуска сессии.",
      "«Что исправить до запуска» — замечания по кейсу.",
    ],
    dynamics: [
      { type: "neutral", text: "При весе 100% синий и бирюзовый совпадают." },
      { type: "down", text: "Снижая вес кейса, видно, как падает его фактический вклад." },
    ],
    example: "Эмпатия: профиль 3.3 / вклад 3.3 при весе 100%; снизишь вес до 60% — вклад упадёт до ~2.0.",
  },
  {
    id: "channels",
    title: "Каналы · почта, мессенджер, видео",
    label: "Параллельные сигналы вне основного кейса",
    icon: Radio,
    summary: "Каналы добавляют параллельную нагрузку: письма, сообщения и видеообращения приходят по расписанию и проверяют реакцию участника вне основного кейса.",
    controls: [
      "Вкладки Почта / Мессенджер / Видео — отдельные списки сигналов.",
      "Редактор сигнала: отправитель, тема/текст, тайминг прихода, варианты ответа.",
      "Минута прихода, срок решения, повтор напоминания.",
    ],
    dynamics: [
      { type: "up", text: "Каналы создают многозадачность — проверяют приоритизацию и стрессоустойчивость." },
      { type: "down", text: "Слишком плотный поток сигналов перегружает и искажает оценку." },
    ],
    example: "Письмо «Жалоба клиента» приходит на 5-й минуте, срок решения 300 сек, повтор напоминания 3 сек.",
  },
  {
    id: "schedule",
    title: "Расписание · ритм симуляции",
    label: "Кейсы по сложности, минуты, тайминги",
    icon: CalendarClock,
    summary: "Задаёт темп появления событий: какие кейсы идут на лёгком/среднем/сложном, сколько минут на кейс и минимальную длительность симуляции.",
    controls: [
      "Порядок и тайминги поступления кейсов и каналов.",
      "Автораспределение времени или ручная настройка интервалов.",
    ],
    dynamics: [
      { type: "up", text: "Сбалансированный ритм держит нагрузку реалистичной." },
      { type: "down", text: "Слишком частые события для «лёгкого» уровня делают его несоразмерно сложным." },
    ],
    example: "Лёгкий — только звонки, ~20 минут; Сложный — все каналы, видео, ~60 минут.",
  },
  {
    id: "results",
    title: "Результаты · отчёты прохождений",
    label: "Список сессий, отчёт, экспорт PDF",
    icon: BarChart3,
    summary: "Завершённые прохождения с итоговой оценкой: общий балл, ответы, сильные компетенции, зоны роста и динамика. Отсюда формируется отчёт для заказчика.",
    controls: [
      "Фильтр по статусу/участнику.",
      "Деталь результата: баллы, ответы, профиль компетенций НАДО/ФАКТ.",
      "Скачать PDF / Удалить результат.",
    ],
    dynamics: [
      { type: "neutral", text: "Просмотр результата ничего не меняет в оценке." },
      { type: "up", text: "Чем больше завершённых прохождений, тем надёжнее средний профиль ФАКТ." },
    ],
    example: "Результат #131231: общий балл 3.8, сильная зона «Бизнес-процессы», зона роста «Контроль».",
  },
  {
    id: "comparison",
    title: "Сравнение · профили рядом",
    label: "Таблица прохождений, выводы, риски, вопросы",
    icon: Sparkles,
    summary: "Сопоставление нескольких участников: карточки прохождений, оценка компетенций, сильные/слабые зоны, риски и готовые вопросы руководителю.",
    controls: [
      "Выбор сотрудников для сравнения (карточки прохождений).",
      "Таблица оценки компетенций по всем выбранным.",
      "Блоки «Риски» и «Вопросы руководителю» выровнены по уровню у всех.",
    ],
    dynamics: [
      { type: "up", text: "Сравнение помогает выбрать кандидата и спланировать развитие группы." },
      { type: "neutral", text: "Сравнение не меняет результаты — только агрегирует их." },
    ],
    example: "Три студента рядом: у одного лидер по «Основы менеджмента», у другого слабая зона «Контроль».",
  },
  {
    id: "settings",
    title: "Настройки · параметры симуляции",
    label: "Системные параметры, веса, влияние времени",
    icon: Settings2,
    summary: "«Под капотом»: глобальные параметры хода симуляции, веса кейсов в итоговой оценке и влияние времени на результат.",
    controls: [
      "Системные параметры (интервалы, повторы, минимумы).",
      "Веса кейсов — регулируемый вклад каждого кейса в профиль.",
      "Влияние времени на итоговую оценку (вкл/выкл).",
    ],
    dynamics: [
      { type: "up", text: "Балансировка весов выравнивает вклад кейсов под цель оценки." },
      { type: "down", text: "Сумма весов компетенций ≠ 100% искажает итоговый профиль." },
    ],
    example: "Снизишь вес лёгкого кейса до 50% — его влияние на средний балл уменьшится вдвое.",
  },
  {
    id: "feedback",
    title: "Обратная связь, Wiki, История",
    label: "Кнопки в шапке: ОС разработчику, эта Wiki, аудит изменений",
    icon: BookOpen,
    summary: "Служебные элементы шапки: форма обратной связи разработчику, эта Wiki и история изменений конфигурации.",
    controls: [
      "«Обратная связь» — форма для ошибки/идеи/вопроса (отправка в разработке).",
      "«Wiki» — открыть эту инструкцию.",
      "«История» — аудит изменений настроек.",
    ],
    dynamics: [
      { type: "neutral", text: "На оценку не влияют — это поддержка и обучение." },
      { type: "up", text: "История помогает откатить случайное изменение настройки." },
    ],
    example: "Заметил ошибку в кейсе → «Обратная связь» → опиши проблему, разработчик получит её (когда подключат отправку).",
  },
];

const ADMIN_PROCESS_STEPS = [
  { lane: "Админ", title: "Готовит кейсы", note: "Сигнал, циклы, варианты, компетенции." },
  { lane: "Админ", title: "Настраивает каналы", note: "Почта, чат, видео — параллельная нагрузка." },
  { lane: "Админ", title: "Задаёт ритм и веса", note: "Расписание и вклад кейсов." },
  { lane: "Система", title: "Собирает сценарий", note: "Кейсы + каналы + тайминги → симуляция." },
  { lane: "Оценщик", title: "Запускает прохождение", note: "Выбирает кейсы и сложность." },
  { lane: "Участник", title: "Принимает решения", note: "Ответы меняют метрики и компетенции." },
  { lane: "Система", title: "Считает результат", note: "Профиль НАДО/ФАКТ, средний балл." },
  { lane: "Админ", title: "Анализирует и правит", note: "Результаты, сравнение, балансировка весов." },
];

// Мини-мокап интерфейса для каждого блока (как WikiScreenshot у оценщика) —
// узнаваемая иллюстрация именно этого элемента с подсветкой акцентом.
const O = "rgba(255,107,0,0.9)";   // акцент
const T = "rgba(0,212,170,0.9)";   // teal
const B = "rgba(74,158,255,0.85)"; // blue
function Bar({ w, c }: { w: string; c: string }) {
  return <div style={{ height: 6, width: w, background: c, borderRadius: 4 }} />;
}
function Box({ children, hl, className = "" }: { children?: React.ReactNode; hl?: boolean; className?: string }) {
  return (
    <div className={`rounded-md ${className}`} style={{ background: hl ? "rgba(255,107,0,0.16)" : "rgba(255,255,255,0.05)", border: hl ? `1px solid ${O}` : "1px solid rgba(255,255,255,0.09)" }}>{children}</div>
  );
}

// Подпись внутри мокапа
function L({ children, c = "rgba(226,232,240,0.85)", s = 7.5, b = false }: { children: React.ReactNode; c?: string; s?: number; b?: boolean }) {
  return <span style={{ fontSize: s, color: c, fontWeight: b ? 800 : 600, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{children}</span>;
}
const MUT = "rgba(148,163,184,0.85)";

function AdminWikiShot({ id }: { id: string }) {
  let inner: React.ReactNode = null;
  if (id === "dashboard") {
    inner = (
      <div className="flex h-full flex-col gap-1">
        <div className="grid grid-cols-4 gap-1">
          {[["17", "Кейсов", O], ["16", "Прохожд.", T], ["3.8", "Балл", B], ["100%", "Готов.", "rgba(255,193,7,0.9)"]].map(([v, t, c], i) => (
            <Box key={i} hl={i === 0} className="flex flex-col justify-center px-1 py-0.5"><L s={9.5} b c={c}>{v}</L><L s={6} c={MUT}>{t}</L></Box>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-1">
          <Box className="flex flex-col justify-center gap-0.5 p-1"><L s={6.5} b c={O}>Что проверить</L><L s={6} c={MUT}>✓ Циклы 17/17</L><L s={6} c={MUT}>✓ Компетенций 14</L></Box>
          <Box className="flex flex-col items-center justify-center gap-0.5"><div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${B}` }} /><L s={6} c={MUT}>НАДО / ФАКТ</L></Box>
        </div>
      </div>
    );
  } else if (id === "rail") {
    inner = <div className="flex h-full flex-col justify-center gap-1">{["Кабинет", "Кейсы", "Каналы", "Расписание", "Результаты"].map((t, i) => <Box key={t} hl={i === 1} className="flex items-center gap-1.5 px-2 py-0.5"><div style={{ width: 6, height: 6, borderRadius: 2, background: i === 1 ? O : MUT }} /><L s={7.5} c={i === 1 ? "#fff" : MUT}>{t}</L></Box>)}</div>;
  } else if (id === "cases") {
    inner = <div className="grid h-full grid-cols-2 gap-1">{[["Конфликт в зоне выдачи", "CASE-04"], ["Двойная нагрузка", "CASE-05"], ["Брак на выдаче", "CASE-06"], ["Инвентаризация", "CASE-07"]].map(([t, c], i) => <Box key={i} hl={i === 0} className="flex flex-col justify-center px-1.5 py-0.5"><L s={7}>{t}</L><L s={6} c={MUT}>{c}</L></Box>)}</div>;
  } else if (id === "editor-card") {
    inner = <div className="flex h-full flex-col gap-1"><div><L s={6} c={MUT}>Название кейса</L><Box className="mt-0.5 px-1.5 py-0.5"><L s={7}>Конфликт в зоне выдачи</L></Box></div><div className="flex-1"><L s={6} c={MUT}>Компетенции</L><div className="mt-0.5 flex flex-wrap gap-1">{[["Эмпатия", T], ["Деэскалация", T], ["Регламент", MUT]].map(([t, c], i) => <span key={i} style={{ fontSize: 6.5, padding: "1px 5px", borderRadius: 8, color: "#fff", background: `${(c as string).replace("0.85", "0.22").replace("0.9", "0.22")}`, border: `1px solid ${c}` }}>{t}</span>)}</div></div></div>;
  } else if (id === "cycles") {
    inner = <div className="flex h-full gap-1.5"><div className="flex flex-none flex-col gap-1">{[1, 2, 3].map((n) => <div key={n} className="flex items-center justify-center" style={{ width: 17, height: 17, borderRadius: 5, fontSize: 8, fontWeight: 800, color: n === 1 ? "#fff" : MUT, background: n === 1 ? O : "rgba(255,255,255,0.06)", border: `1px solid ${n === 1 ? O : "rgba(255,255,255,0.12)"}` }}>{n}</div>)}<div style={{ width: 17, height: 17, borderRadius: 5, border: `1px dashed ${O}`, color: O, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>+</div></div><Box hl className="flex-1 p-1.5"><L s={7} b>Цикл 1</L><L s={6.5} c={MUT}>Клиент повышает голос. Сигнал: посетитель…</L></Box></div>;
  } else if (id === "options") {
    inner = <div className="flex h-full flex-col justify-center gap-1">{[["A", "Признать эмоцию, уточнить", "+10", T], ["B", "Предложить компенсацию", "+4", "rgba(255,193,7,0.9)"], ["C", "Позвать старшего", "−6", "rgba(255,68,68,0.9)"]].map(([l, t, s, c], i) => <Box key={l} hl={i === 0} className="flex items-center gap-1.5 px-1.5 py-1"><div style={{ width: 13, height: 13, borderRadius: 4, background: c, color: "#0d1117", fontSize: 7.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{l}</div><L s={6.5}>{t}</L><span className="ml-auto" style={{ fontSize: 7, fontWeight: 800, color: c }}>{s}</span></Box>)}</div>;
  } else if (id === "impact") {
    inner = <div className="flex h-full flex-col justify-center gap-1">{[["Эмпатия", 3.3], ["Деэскалация", 3.0], ["Скорость", 2.4], ["Регламент", 2.8]].map(([t, v], i) => <div key={t as string} className="flex items-center gap-1"><L s={6} c={MUT} >{t}</L><div className="ml-auto flex w-1/2 flex-col gap-0.5"><Bar w={`${(v as number) * 20}%`} c={B} /><Bar w={`${(v as number) * 18}%`} c={T} /></div><span style={{ fontSize: 6.5, fontWeight: 800, color: "#e2e8f0", width: 14, textAlign: "right" }}>{v as number}</span></div>)}</div>;
  } else if (id === "channels") {
    inner = <div className="flex h-full flex-col gap-1"><div className="flex gap-1">{["Почта", "Мессенджер", "Видео"].map((t, i) => <span key={t} style={{ fontSize: 6.5, padding: "2px 6px", borderRadius: 5, color: i === 0 ? "#fff" : MUT, background: i === 0 ? "rgba(0,212,170,0.18)" : "transparent", border: `1px solid ${i === 0 ? T : "rgba(255,255,255,0.12)"}` }}>{t}</span>)}</div><div className="flex flex-1 flex-col gap-1">{["Жалоба клиента на грубость", "Запрос: сверхурочная работа"].map((t, i) => <Box key={i} hl={i === 0} className="flex items-center px-1.5 py-0.5"><L s={6.5}>{t}</L></Box>)}</div></div>;
  } else if (id === "schedule") {
    inner = <div className="flex h-full flex-col justify-center gap-1">{[["Лёгкий", "~20 мин · звонки", T], ["Средний", "~40 мин · +чат", "rgba(255,193,7,0.9)"], ["Сложный", "~60 мин · все каналы", "rgba(255,68,68,0.9)"]].map(([t, d, c], i) => <Box key={i} className="flex items-center gap-1.5 px-1.5 py-1"><span style={{ fontSize: 6.5, padding: "1px 6px", borderRadius: 8, color: "#0d1117", fontWeight: 800, background: c }}>{t}</span><L s={6.5} c={MUT}>{d}</L></Box>)}</div>;
  } else if (id === "results") {
    inner = <div className="flex h-full flex-col justify-center gap-1">{[["131231", "Смирнов О.", 3.8], ["7", "Иванов И.", 2.7], ["4", "Петров П.", 1.8]].map(([code, name, v], i) => <Box key={code as string} hl={i === 0} className="flex items-center gap-1.5 px-1.5 py-1"><L s={6.5} c={MUT}>#{code}</L><L s={6.5}>{name}</L><strong className="ml-auto" style={{ fontSize: 8, color: getScoreC(v as number) }}>{(v as number).toFixed(1)}</strong></Box>)}</div>;
  } else if (id === "comparison") {
    inner = <div className="grid h-full grid-cols-3 gap-1">{[["Смирнов", 3.8, T], ["Иванов", 2.7, B], ["Петров", 1.8, O]].map(([n, v, c], i) => <div key={i} className="flex flex-col gap-1"><Box className="flex flex-col items-center justify-center gap-0.5 py-1"><L s={6.5} b>{n}</L><strong style={{ fontSize: 9, color: c as string }}>{(v as number).toFixed(1)}</strong></Box><Box className="flex flex-1 flex-col justify-center gap-0.5 p-1"><L s={5.5} c={MUT}>Риски</L><Bar w="70%" c="rgba(255,68,68,0.5)" /></Box></div>)}</div>;
  } else if (id === "settings") {
    inner = <div className="flex h-full flex-col justify-center gap-1.5"><div className="grid grid-cols-2 gap-1.5">{[["Мин. интервал", "45"], ["Срок решения", "180"]].map(([t, v], i) => <div key={i}><L s={6} c={MUT}>{t}</L><Box className="mt-0.5 flex items-center px-1.5 py-0.5"><L s={7.5} b>{v}</L></Box></div>)}</div><Box hl className="flex items-center gap-1.5 px-1.5 py-1.5"><L s={6.5}>Вес кейса в оценке</L><div className="ml-auto flex items-center"><div style={{ width: 26, height: 5, borderRadius: 4, background: "rgba(255,255,255,0.12)" }} /><div style={{ width: 10, height: 10, borderRadius: "50%", background: O, marginLeft: -4 }} /></div><L s={6.5} b c={O}>100%</L></Box></div>;
  } else {
    inner = <div className="flex h-full items-center gap-1">{["Светлая", "История", "Wiki", "Обратная связь"].map((t, i) => <span key={t} style={{ fontSize: 6.5, padding: "3px 6px", borderRadius: 5, color: i === 3 ? "#fff" : MUT, background: i === 3 ? "rgba(74,158,255,0.18)" : "rgba(255,255,255,0.05)", border: `1px solid ${i === 3 ? B : "rgba(255,255,255,0.1)"}` }}>{t}</span>)}<span className="ml-auto" style={{ fontSize: 6, color: "rgba(148,163,184,0.6)" }}>v4.1</span></div>;
  }
  return <div className="dns-admin-wiki-shot" aria-hidden="true">{inner}</div>;
}

function getScoreC(v: number) {
  return v >= 3.5 ? "#00d4aa" : v >= 2.5 ? "#ffc107" : "#ff6b6b";
}

export function AdminWiki({ onBack }: { onBack: () => void }) {
  return (
    <div className="dns-assessor-wiki dns-admin-wiki space-y-5">
      <section className="dns-assessor-wiki-hero">
        <div>
          <div className="dns-assessor-wiki-kicker">WIKI администратора</div>
          <h2>Как устроено меню администратора</h2>
          <p>
            Эта страница объясняет каждый элемент кабинета администратора: что он делает, как менять,
            как влияет на сценарий и оценку, и какой результат это даёт — с живыми примерами.
          </p>
        </div>
        <button type="button" onClick={onBack} className="dns-assessor-wiki-back">
          <ArrowLeft className="h-4 w-4" />
          Вернуться в кабинет
        </button>
      </section>

      <section className="dns-assessor-wiki-summary">
        <div><MousePointerClick className="h-5 w-5" /><span>1. Админ собирает контент</span></div>
        <div><GitBranch className="h-5 w-5" /><span>2. Система строит сценарий</span></div>
        <div><BarChart3 className="h-5 w-5" /><span>3. Прохождение даёт данные</span></div>
        <div><ClipboardCheck className="h-5 w-5" /><span>4. Анализ и балансировка</span></div>
      </section>

      <section className="dns-assessor-wiki-note">
        <Info className="h-5 w-5" />
        <div>
          <h3>Главный принцип</h3>
          <p>
            Кейсы и каналы задают ситуации, варианты ответа дают вклад в компетенции и баллы,
            а веса и тайминги балансируют итог. Всё, что вы настраиваете слева, в моменте видно
            в правой панели «Влияние» — настраивайте, опираясь на неё.
          </p>
        </div>
      </section>

      <section className="dns-assessor-wiki-grid">
        {ADMIN_WIKI_BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <article key={block.id} className="dns-assessor-wiki-card">
              <div className="dns-assessor-wiki-card-head">
                <div className="dns-assessor-wiki-icon"><Icon className="h-5 w-5" /></div>
                <div>
                  <h3>{block.title}</h3>
                  <p>{block.label}</p>
                </div>
              </div>
              <AdminWikiShot id={block.id} />
              <p className="dns-assessor-wiki-card-summary">{block.summary}</p>
              <div className="dns-admin-wiki-example">
                <Sparkles className="h-3.5 w-3.5" />
                <span><b>Пример:</b> {block.example}</span>
              </div>
              <div className="dns-assessor-wiki-columns">
                <div>
                  <h4>Как менять</h4>
                  <ul>{block.controls.map((item) => <li key={item}>{item}</li>)}</ul>
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
        <div className="dns-assessor-wiki-process-toggle" style={{ cursor: "default" }}>
          <div>
            <div className="dns-assessor-wiki-kicker">Процесс администрирования</div>
            <h3>От сборки контента до анализа результата</h3>
            <p>Полный путь: что делает админ, что — система, что — оценщик и участник.</p>
          </div>
        </div>
        <div className="dns-assessor-bpmn">
          <div className="dns-assessor-bpmn-lanes">
            <span>Админ</span>
            <span>Система</span>
            <span>Оценщик / Участник</span>
          </div>
          <div className="dns-assessor-bpmn-flow">
            {ADMIN_PROCESS_STEPS.map((step, index) => (
              <div key={`${step.lane}-${step.title}`} className="dns-assessor-bpmn-node">
                <div className="dns-assessor-bpmn-lane">{step.lane}</div>
                <div className="dns-assessor-bpmn-title">{step.title}</div>
                <div className="dns-assessor-bpmn-note">{step.note}</div>
                {index < ADMIN_PROCESS_STEPS.length - 1 && <ArrowRight className="dns-assessor-bpmn-arrow h-4 w-4" />}
              </div>
            ))}
          </div>
          <div className="dns-assessor-bpmn-dependencies">
            <div><Target className="h-4 w-4" />Компетенции кейсов определяют, что реально проверяется в оценке.</div>
            <div><SlidersHorizontal className="h-4 w-4" />Варианты ответа и веса формируют фактический вклад в профиль.</div>
            <div><Radio className="h-4 w-4" />Каналы и расписание задают нагрузку и ритм симуляции.</div>
            <div><Map className="h-4 w-4" />Результаты и сравнение замыкают цикл — по ним правят настройку.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
