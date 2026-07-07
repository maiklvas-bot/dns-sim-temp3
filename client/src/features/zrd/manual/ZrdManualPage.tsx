/**
 * ЗРД v2 — «Инструкция настольной игры»: правила матча, роли, аннотированный интерфейс,
 * карта хода, схема партии, сценарии, привязка к 12 компетенциям, итоговая карта развития,
 * материалы к обучению. Доступна всем ролям: /#/zrd/manual (ссылки из лобби, борда и мастера).
 * Текстовый первоисточник для правок администратора: docs/zrd-wiki/16-instrukciya-igry.md.
 */
import "@/styles/zrd.css";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, BookOpen, Users, Bot, CircleOff, Crown, Layers, Target, AlertTriangle,
  Swords, Map, GraduationCap, ClipboardList, Compass, Timer, Shield, BarChart3, Printer,
  Pencil, Save, X, Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useDnsTheme } from "@/components/theme-toggle";
import { SCENARIOS, SCENARIO_IDS } from "@shared/zrd/content-scenarios";
import { MISSION_CATALOG } from "@shared/zrd/content-missions";
import { BLACK_SWANS } from "@shared/zrd/content-swans";
import { COMPETENCY_LABEL, COMPETENCY_KEYS } from "@shared/zrd/types";
import type { CompetencyKey } from "@shared/zrd/types";

// ── локальные примитивы вёрстки ─────────────────────────────────────────────
const S = {
  h2: { color: "var(--zrd-text)", fontSize: 22, fontWeight: 800, margin: "0 0 4px" } as CSSProperties,
  kicker: { color: "#FF6B00", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" } as CSSProperties,
  p: { color: "var(--zrd-text-dim)", fontSize: 14, lineHeight: 1.55, margin: "6px 0" } as CSSProperties,
  strongP: { color: "var(--zrd-text)", fontSize: 14, lineHeight: 1.55, margin: "6px 0" } as CSSProperties,
  chip: { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "3px 8px", fontSize: 12, fontWeight: 600, background: "rgba(255,107,0,0.12)", color: "#FF6B00" } as CSSProperties,
};

function Section({ id, icon, kicker, title, children }: { id: string; icon: ReactNode; kicker: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="zrd-panel" style={{ padding: 24, scrollMarginTop: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ display: "inline-flex", width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(255,107,0,0.14)", color: "#FF6B00", flexShrink: 0 }}>{icon}</span>
        <div>
          <div style={S.kicker}>{kicker}</div>
          <h2 style={S.h2}>{title}</h2>
        </div>
      </div>
      {children}
      <AdminNote sectionId={id} />
    </section>
  );
}

// ── дополнения администратора (живут в БД, видят все, правит админ) ─────────
interface ManualNote { sectionId: string; bodyMd: string; updatedBy: string; updatedAt: string }
interface NotesCtx {
  notes: Record<string, ManualNote>;
  isAdmin: boolean;
  save: (sectionId: string, bodyMd: string) => Promise<void>;
}
const ManualNotesContext = createContext<NotesCtx>({ notes: {}, isAdmin: false, save: async () => {} });

/** Безопасный мини-markdown: ##/### заголовки, **жирный**, списки «- », абзацы. Без HTML-инъекций (React-ноды). */
function MiniMarkdown({ text }: { text: string }) {
  const bold = (line: string, key: number): ReactNode => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return (
      <span key={key}>
        {parts.map((p, i) => (i % 2 === 1 ? <b key={i} style={{ color: "var(--zrd-text)" }}>{p}</b> : p))}
      </span>
    );
  };
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flushList = () => {
    if (list.length) {
      out.push(<ul key={`ul-${out.length}`} style={{ margin: "4px 0", paddingLeft: 18, color: "var(--zrd-text-dim)", fontSize: 13.5, lineHeight: 1.55 }}>{list}</ul>);
      list = [];
    }
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("- ")) { list.push(<li key={i}>{bold(t.slice(2), i)}</li>); return; }
    flushList();
    if (!t) return;
    if (t.startsWith("### ")) { out.push(<div key={i} style={{ color: "var(--zrd-text)", fontWeight: 700, fontSize: 13.5, marginTop: 6 }}>{bold(t.slice(4), i)}</div>); return; }
    if (t.startsWith("## ")) { out.push(<div key={i} style={{ color: "var(--zrd-text)", fontWeight: 800, fontSize: 15, marginTop: 8 }}>{bold(t.slice(3), i)}</div>); return; }
    out.push(<p key={i} style={{ ...S.p, margin: "4px 0" }}>{bold(t, i)}</p>);
  });
  flushList();
  return <>{out}</>;
}

/** Блок «Дополнение администратора» под секцией: просмотр для всех, инлайн-правка для админа. */
function AdminNote({ sectionId }: { sectionId: string }) {
  const { notes, isAdmin, save } = useContext(ManualNotesContext);
  const note = notes[sectionId];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!note && !isAdmin) return null;

  const startEdit = () => { setDraft(note?.bodyMd ?? ""); setErr(null); setEditing(true); };
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await save(sectionId, draft); setEditing(false); }
    catch (e) { setErr(e instanceof Error ? e.message : "Не удалось сохранить"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 14, border: "1px dashed rgba(255,107,0,0.45)", borderRadius: 12, padding: "10px 14px", background: "rgba(255,107,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...S.kicker, fontSize: 10 }}>Дополнение администратора</span>
        {note && <span style={{ fontSize: 10, color: "var(--zrd-text-dim)" }}>· {note.updatedBy} · {note.updatedAt.slice(0, 10)}</span>}
        {isAdmin && !editing && (
          <button type="button" onClick={startEdit}
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--zrd-border)", borderRadius: 7, padding: "3px 8px", fontSize: 11.5, fontWeight: 600, color: "var(--zrd-text-dim)", background: "transparent", cursor: "pointer" }}>
            <Pencil size={12} aria-hidden /> {note ? "Редактировать" : "Добавить"}
          </button>
        )}
      </div>
      {!editing && note && <div style={{ marginTop: 4 }}><MiniMarkdown text={note.bodyMd} /></div>}
      {!editing && !note && isAdmin && (
        <p style={{ ...S.p, margin: "4px 0", fontStyle: "italic" }}>Пусто. Нажмите «Добавить», чтобы дописать правила/уточнения к этой секции — увидят все игроки и оценщики.</p>
      )}
      {editing && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            maxLength={8000}
            aria-label={`Дополнение к секции ${sectionId}`}
            placeholder={"Markdown: ## заголовок, **жирный**, списки через «- ». Пустой текст удаляет дополнение."}
            style={{ width: "100%", borderRadius: 10, border: "1px solid var(--zrd-border)", background: "var(--zrd-surface-2)", color: "var(--zrd-text)", fontSize: 13, lineHeight: 1.5, padding: 10, resize: "vertical" }}
          />
          {err && <div style={{ color: "#e85a5a", fontSize: 12, marginTop: 4 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" onClick={submit} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 8, border: "none", padding: "6px 12px", fontSize: 12.5, fontWeight: 700, color: "#fff", background: "#FF6B00", cursor: busy ? "wait" : "pointer" }}>
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Save size={13} aria-hidden />} Сохранить
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 8, border: "1px solid var(--zrd-border)", padding: "6px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--zrd-text-dim)", background: "transparent", cursor: "pointer" }}>
              <X size={13} aria-hidden /> Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "#FF6B00", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--zrd-border)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: "8px 10px", color: j === 0 ? "var(--zrd-text)" : "var(--zrd-text-dim)", fontWeight: j === 0 ? 700 : 400, borderBottom: "1px solid var(--zrd-border)", verticalAlign: "top" }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** нумерованный маркер-«выноска» для схемы интерфейса */
function Pin({ n }: { n: number }) {
  return (
    <span aria-hidden style={{ position: "absolute", top: -9, left: -9, zIndex: 2, display: "inline-flex", width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#FF6B00", color: "#fff", fontSize: 12, fontWeight: 800, boxShadow: "0 0 0 2px rgba(0,0,0,0.35)" }}>{n}</span>
  );
}

function Zone({ n, label, style, tall }: { n: number; label: string; style?: CSSProperties; tall?: boolean }) {
  return (
    <div style={{ position: "relative", border: "1px solid rgba(255,107,0,0.45)", borderRadius: 10, padding: "8px 10px", minHeight: tall ? 64 : 40, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--zrd-text)", fontSize: 12, fontWeight: 600, background: "var(--zrd-surface)", ...style }}>
      <Pin n={n} />
      {label}
    </div>
  );
}

// ── карта «компетенция → игровые сигналы → материал» ────────────────────────
const COMPETENCY_MAP: Record<CompetencyKey, { signals: string; books: string }> = {
  planning: { signals: "Длительные проекты (4–8 нед.) в первой трети года, вложения в производство ресурсов, ровный темп действий", books: "Кёрк Ректор «Делегировать или умереть»; Сергей Дерцап «Проджект-менеджмент»" },
  goal_setting: { signals: "Закрытые миссии, движение KPI к целям кварталов без «пилы»", books: "Радислав Гандапас «Формула победы»; Наполеон Хилл «Думай и богатей»" },
  decision_making: { signals: "Уместность выбора в дилеммах и на лебедях (вариант соответствует контексту РРС, а не «первый попавшийся»)", books: "Канеман, Сибони, Санстейн «Шум»; Фридман «Между Ангелом и Чертом»" },
  analytical: { signals: "Открытие панели «Анализировать» перед решениями, товарные карты (цены, инвентаризация, ассортимент)", books: "Канеман «Шум»; Цзэн Мин «Alibaba и умный бизнес будущего»" },
  flexibility: { signals: "Быстрая и уместная реакция на чёрных лебедей, смена курса при глобальных событиях", books: "Талеб «Антихрупкость» и «Чёрный лебедь»" },
  communication: { signals: "Выбор переговорных опций в конфликтах и претензиях (в мультиплеере — усиление сигнала)", books: "Стоун, Паттон, Хин «Неудобные разговоры»; Ильяхов «Ясно, понятно»" },
  result_orientation: { signals: "Итоговый прогресс KPI к финальным целям миссий, тай-брейк по эффективности", books: "Батырев «45 татуировок менеджера»; Гандапас «Формула победы»" },
  team_motivation: { signals: "Карты «Сотрудники» (наставничество, мотивация, удержание), реакции на кадровые события", books: "Батырев «Сложные подчинённые»; Адизес «Развитие лидеров»" },
  critical_thinking: { signals: "Избегание слабых (weak) вариантов, доля уместных решений, трейд-офф карты («Сократить бюджеты»)", books: "Кукла «Ментальные ловушки»; Канеман «Шум»" },
  initiative: { signals: "Число разыгранных карт, реакция на лебедей раньше дедлайна, стратегические тир-3 карты", books: "Адам Грант «Оригиналы»; Синсеро «НИ СЫ»" },
  conflict_management: { signals: "Опции в конфликтных событиях (совещание vs волевое решение vs игнор), сервисные кейсы (претензия, суд, экстремист)", books: "Батырев «Сложные подчинённые»; Берн «Игры, в которые играют люди»" },
  strategic_vision: { signals: "Тир-3 проекты, разнообразие направлений (4+ колод), баланс трёх показателей без перекоса", books: "Макнилли «Сунь-цзы и искусство бизнеса»; Адизес «Идеальный руководитель»" },
};

const SWAN_FREQ_TEXT = "выкл 0% · редко 10% · стандарт 22% · шторм 40% (за такт)";

export default function ZrdManualPage() {
  const { themeClass } = useDnsTheme();
  const [, navigate] = useLocation();
  const [notes, setNotes] = useState<Record<string, ManualNote>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // дополнения — публичные; роль admin включает режим правки
    void fetch("/api/zrd/manual-notes", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((data: { notes: ManualNote[] }) => {
        setNotes(Object.fromEntries((data.notes ?? []).map((n) => [n.sectionId, n])));
      })
      .catch(() => { /* оффлайн — просто без дополнений */ });
    void fetch("/api/staff/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me: { role?: string } | null) => setIsAdmin(me?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  const saveNote = async (sectionId: string, bodyMd: string) => {
    const res = await apiRequest("PUT", `/api/zrd/manual-notes/${sectionId}`, { bodyMd });
    const data = (await res.json()) as { note: ManualNote | null };
    setNotes((prev) => {
      const next = { ...prev };
      if (data.note) next[sectionId] = data.note;
      else delete next[sectionId];
      return next;
    });
  };

  const nav: { id: string; label: string }[] = [
    { id: "about", label: "Об игре" },
    { id: "roles", label: "Роли" },
    { id: "goal", label: "Цель и победа" },
    { id: "flow", label: "Схема партии" },
    { id: "turnmap", label: "Карта хода" },
    { id: "interface", label: "Интерфейс" },
    { id: "cards", label: "Карты и колоды" },
    { id: "events", label: "События и лебеди" },
    { id: "scenarios", label: "Сценарии" },
    { id: "competencies", label: "Компетенции ЗРД" },
    { id: "results", label: "Итоги и карта развития" },
    { id: "learning", label: "Материалы к обучению" },
    { id: "admin", label: "Администратору" },
  ];

  return (
    <ManualNotesContext.Provider value={{ notes, isAdmin, save: saveNote }}>
    <div className={themeClass}>
      <div className="zrd-root" style={{ minHeight: "100dvh", overflowY: "auto" }}>
        {/* Шапка */}
        <header style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid var(--zrd-border)", background: "var(--zrd-surface-2)", padding: "10px 16px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => navigate("/zrd")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--zrd-border)", borderRadius: 8, padding: "6px 10px", color: "var(--zrd-text-dim)", fontSize: 13, fontWeight: 600, background: "transparent", cursor: "pointer" }}>
              <ArrowLeft size={15} aria-hidden /> К игре
            </button>
            <span style={{ display: "inline-flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "rgba(255,107,0,0.14)", color: "#FF6B00" }}><BookOpen size={16} aria-hidden /></span>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ color: "var(--zrd-text)", fontWeight: 800, fontSize: 14 }}>Институт ЗРД · Инструкция</div>
              <div style={{ color: "var(--zrd-text-dim)", fontSize: 11 }}>Правила стратегического матча «Покорение новых территорий»</div>
            </div>
            <button type="button" onClick={() => window.print()}
              style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--zrd-border)", borderRadius: 8, padding: "6px 10px", color: "var(--zrd-text-dim)", fontSize: 13, background: "transparent", cursor: "pointer" }}>
              <Printer size={15} aria-hidden /> Печать
            </button>
          </div>
          <nav aria-label="Разделы инструкции" style={{ maxWidth: 1100, margin: "8px auto 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {nav.map((n) => (
              <a key={n.id} href={`#/zrd/manual#${n.id}`}
                onClick={(e) => { e.preventDefault(); document.getElementById(n.id)?.scrollIntoView({ behavior: "smooth" }); }}
                style={{ fontSize: 11.5, fontWeight: 600, color: "var(--zrd-text-dim)", border: "1px solid var(--zrd-border)", borderRadius: 999, padding: "3px 10px", textDecoration: "none", cursor: "pointer" }}>
                {n.label}
              </a>
            ))}
          </nav>
        </header>

        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px", display: "grid", gap: 16 }}>

          {/* ── Обложка ── */}
          <section className="zrd-panel" style={{ padding: 28, textAlign: "center" }}>
            <div style={S.kicker}>Настольная стратегия в цифре · 1–4 игрока · 60–120 минут</div>
            <h1 style={{ color: "var(--zrd-text)", fontSize: 32, fontWeight: 800, margin: "6px 0 2px" }}>Институт ЗРД: Покорение новых территорий</h1>
            <p style={{ ...S.p, maxWidth: 760, margin: "8px auto" }}>
              Вы — заместитель регионального директора DNS. Ваш стол — одна из четырёх РРС Дивизиона Урал.
              Год (4 квартала) на то, чтобы развить регион: открывать точки, строить логистику, растить команду,
              переживать чёрных лебедей — и обойти соперников за соседними столами. Пока вы играете,
              машина наблюдает и собирает ваш профиль из 12 управленческих компетенций.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10 }}>
              <span style={S.chip}><Layers size={13} aria-hidden /> 6 колод · 300 карт</span>
              <span style={S.chip}><AlertTriangle size={13} aria-hidden /> 14 чёрных лебедей</span>
              <span style={S.chip}><Target size={13} aria-hidden /> 10 миссий · 4 сценария</span>
              <span style={S.chip}><Bot size={13} aria-hidden /> ИИ-соперники 5 уровней</span>
              <span style={S.chip}><BarChart3 size={13} aria-hidden /> 12 компетенций ЗРД</span>
            </div>
          </section>

          {/* ── Об игре ── */}
          <Section id="about" icon={<BookOpen size={18} aria-hidden />} kicker="Состав игры" title="Что на столе">
            <Table
              head={["Компонент", "Сколько", "Зачем"]}
              rows={[
                ["Столы (РРС)", "4 — Екатеринбург, Челябинск, Тюмень, Пермь", "Каждый стол — регион одного игрока: свои ресурсы, показатели, колоды и миссии"],
                ["Ресурсы", "5 — финансы, люди, материалы, технологии, репутация", "Валюта решений: ими платят за карты и действия"],
                ["Показатели", "3 базовых (продажи, сервис/NPS, охват) + 6 KPI (0–100%)", "Здоровье региона; из них считаются миссии и Торговый рейтинг"],
                ["Колоды карт", "6 личных × 50 карт (продвижение, сервис, логистика, товар, сотрудники, проекты)", "Главные ходы игры; добор каждый месяц, карты не повторяются"],
                ["Чёрные лебеди", "14 рисков", "Редкие сильные удары — по одной РРС или по всем сразу"],
                ["Миссии", "каталог из 10", "Цели года с поквартальной лестницей; дают бонус к рейтингу"],
                ["Календарь", "4 квартала × 3 месяца = 12 тактов; минимальная единица — неделя", "Такт = месяц принятия решений; проекты и лебеди тикают неделями"],
              ]}
            />
          </Section>

          {/* ── Роли ── */}
          <Section id="roles" icon={<Users size={18} aria-hidden />} kicker="Кто за столом" title="Роли участников">
            <Table
              head={["Роль", "Что делает", "Что видит"]}
              rows={[
                [<span key="p"><Users size={13} style={{ display: "inline" }} aria-hidden /> Испытуемый (игрок)</span>,
                  "Получает код от оценщика и вводит его на ГЛАВНОМ экране платформы (кнопка «Космонавт» → поле кода) — система сама сажает за стол ЗРД. Управляет одной РРС: играет карты, реагирует на события и лебедей, закрывает миссии.",
                  "Только своё: рука, колоды, сброс, ресурсы. Про других — публичная сводка KPI внизу борда."],
                [<span key="a"><Crown size={13} style={{ display: "inline" }} aria-hidden /> Оценщик</span>,
                  "Собирает партию в кабинете (карточка «ЗРД»): сценарий, сложность 1–5, режим победы, состав стола (человек/ИИ/пусто на каждую РРС), миссии, частота лебедей, темп. Раздаёт коды. Во время игры: наблюдает, может запустить лебедя вручную и ставить паузу.",
                  "Всё: состояние всех столов, прогресс тактов, а по финалу — профили 12 компетенций каждого участника."],
                [<span key="ai"><Bot size={13} style={{ display: "inline" }} aria-hidden /> ИИ-управленец</span>,
                  "Занимает свободные столы. Уровень 1–5 задаёт оценщик: пятый играет почти оптимально, первый — ошибается, жжёт ходы и не замечает лебедей.",
                  "То же, что игрок (движок честный: ИИ не подглядывает в чужие колоды)."],
                [<span key="off"><CircleOff size={13} style={{ display: "inline" }} aria-hidden /> Пустой стол</span>,
                  "РРС не участвует: не ходит, не получает событий, не попадает в зачёт.",
                  "—"],
                [<span key="adm"><Shield size={13} style={{ display: "inline" }} aria-hidden /> Администратор</span>,
                  "Ведёт контент игры и эту инструкцию (раздел «Администратору» внизу), управляет учётками оценщиков.",
                  "Всё, что оценщик, плюс админ-зона платформы."],
              ]}
            />
          </Section>

          {/* ── Цель и победа ── */}
          <Section id="goal" icon={<Crown size={18} aria-hidden />} kicker="Ради чего играем" title="Цель игры и условия победы">
            <p style={S.strongP}>Оценщик выбирает один из двух режимов ещё до старта:</p>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 8 }}>
              <div style={{ border: "1px solid var(--zrd-border)", borderRadius: 12, padding: 14 }}>
                <div style={{ ...S.kicker, marginBottom: 4 }}>Режим А · По итогам года</div>
                <p style={S.p}>Играются все 12 тактов. Побеждает наибольший <b style={{ color: "var(--zrd-text)" }}>Торговый рейтинг (ТР)</b> = продажи + сервис + охват + бонусы выполненных миссий.</p>
              </div>
              <div style={{ border: "1px solid var(--zrd-border)", borderRadius: 12, padding: 14 }}>
                <div style={{ ...S.kicker, marginBottom: 4 }}>Режим Б · Гонка к цели</div>
                <p style={S.p}>Выбрана <b style={{ color: "var(--zrd-text)" }}>ключевая миссия</b> (отмечена короной <Crown size={12} style={{ display: "inline", color: "#f0b429" }} aria-hidden />). Кто первым довёл её KPI до финальной цели — немедленно побеждает.</p>
              </div>
            </div>
            <p style={S.p}>
              <b style={{ color: "var(--zrd-text)" }}>Тай-брейк при равенстве:</b> сначала выигрывает тот, кто потратил меньше ресурсов;
              если и тут равенство — кто совершил меньше действий. То есть при одинаковом результате побеждает более
              эффективный управленец. Полное равенство — ничья.
            </p>
          </Section>

          {/* ── Схема партии ── */}
          <Section id="flow" icon={<Map size={18} aria-hidden />} kicker="Как устроен год" title="Схема партии">
            <div style={{ overflowX: "auto", padding: "8px 0" }}>
              {/* Календарь года */}
              <div style={{ display: "flex", gap: 8, minWidth: 640 }}>
                {[1, 2, 3, 4].map((q) => (
                  <div key={q} style={{ flex: 1, border: "1px solid rgba(255,107,0,0.4)", borderRadius: 12, padding: 10 }}>
                    <div style={{ ...S.kicker, textAlign: "center" }}>Квартал {q}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      {[1, 2, 3].map((m) => {
                        const tick = (q - 1) * 3 + m;
                        const isQEnd = m === 3;
                        return (
                          <div key={m} style={{ flex: 1, textAlign: "center", borderRadius: 8, padding: "8px 4px", fontSize: 11, fontWeight: 700, color: isQEnd ? "#fff" : "var(--zrd-text)", background: isQEnd ? "#FF6B00" : "var(--zrd-surface-2)", border: "1px solid var(--zrd-border)" }}>
                            Мес {tick}
                            <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.85 }}>{isQEnd ? "рубеж квартала" : "4 недели"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p style={S.p}>
              <b style={{ color: "var(--zrd-text)" }}>Каждый месяц (такт):</b> добор карт → действия всех столов одновременно →
              бросок чёрного лебедя → прогресс проектов (−4 недели) → месячный доход.
              На <b style={{ color: "#FF6B00" }}>рубеже квартала</b> (месяцы 3, 6, 9, 12) дополнительно: производство ресурсов
              и показателей, пересмотр целей миссий и каждому столу выдаётся квартальная дилемма.
            </p>
            <p style={S.p}>
              <Timer size={13} style={{ display: "inline" }} aria-hidden /> <b style={{ color: "var(--zrd-text)" }}>Темп:</b> на такт отводится
              2–15 минут реального времени (задаёт оценщик; таймер — в шапке борда). Кто не успел — автоматически пасует,
              а незакрытая дилемма решается «бесплатным» вариантом. Матч никогда не зависает из-за одного игрока.
            </p>
          </Section>

          {/* ── Карта хода ── */}
          <Section id="turnmap" icon={<ClipboardList size={18} aria-hidden />} kicker="Пошагово" title="Карта хода: ваш месяц за 6 шагов">
            <ol style={{ margin: "8px 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {[
                ["Осмотритесь", "Проверьте панель «Показатели региона» и блок «Миссия»: какие цели квартала горят, какой KPI отстаёт."],
                ["Решите дилемму (если есть)", "Красная плашка «Событие раунда» ждёт выбора? Пока не решите — месяц не завершить. Выбирайте вариант ПОД СИТУАЦИЮ: с пустой кассой не вкладывайтесь, с сильной командой — задействуйте людей."],
                ["Проверьте лебедя", "Блок «Чёрный лебедь» пульсирует красным — риск бьёт по вам каждый месяц. Клик по блоку → выберите реакцию (есть и бесплатная), штраф с вашей РРС снимется."],
                ["Потратьте действия", "У вас 1–2 действия на месяц (зависит от сложности). Действие = сыграть карту из колоды СПРАВА или стандартное действие СЛЕВА. Карты с длительностью уходят в «Проекты» и дают эффект по завершении."],
                ["Доберите знания", "Кнопка «Анализировать» открывает товарную колоду и фиксируется как работа с данными (плюс к аналитике в профиле)."],
                ["Завершите месяц", "Оранжевая кнопка в центре. После неё — ждём остальных; когда все спасуют (или дедлайн), месяц закрывается и начинается следующий."],
              ].map(([t, d], i) => (
                <li key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "1px solid var(--zrd-border)", borderRadius: 12, padding: "10px 12px" }}>
                  <span style={{ flexShrink: 0, display: "inline-flex", width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#FF6B00", color: "#fff", fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
                  <span>
                    <b style={{ color: "var(--zrd-text)", fontSize: 14 }}>{t}.</b>{" "}
                    <span style={{ color: "var(--zrd-text-dim)", fontSize: 13.5, lineHeight: 1.5 }}>{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          {/* ── Интерфейс ── */}
          <Section id="interface" icon={<Compass size={18} aria-hidden />} kicker="Разбор экрана" title="Интерфейс борда: каждый элемент">
            <p style={S.p}>Схема повторяет расположение блоков на игровом столе. Номер на схеме = строка в таблице ниже.</p>
            {/* Аннотированная схема борда */}
            <div style={{ border: "1px dashed rgba(255,107,0,0.4)", borderRadius: 14, padding: 16, marginTop: 10, background: "var(--zrd-surface-2)", overflowX: "auto" }}>
              <div style={{ minWidth: 720, display: "grid", gridTemplateColumns: "150px 1fr 96px", gap: 10 }}>
                {/* верхняя строка — шапка */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <Zone n={1} label="Шапка: выход · «Кв 2/4 · Мес 05/12» · таймер такта ⏱" />
                </div>
                {/* левая колонка */}
                <div style={{ display: "grid", gap: 8 }}>
                  <Zone n={2} label="Показатели региона" />
                  <Zone n={3} label="Доступные действия" />
                  <Zone n={4} label="Действия (глаголы)" />
                  <Zone n={5} label="Ресурсы (5)" />
                  <Zone n={6} label="Проекты (недели)" />
                </div>
                {/* центр */}
                <div style={{ display: "grid", gap: 8, gridTemplateRows: "auto 1fr auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.6fr", gap: 8 }}>
                    <Zone n={7} label="Миссия (цели квартала)" tall />
                    <Zone n={8} label="Событие раунда (дилемма)" tall />
                    <Zone n={9} label="Чёрный лебедь" tall />
                  </div>
                  <Zone n={10} label="Центр: карта 4 РРС + кнопка «Завершить месяц»" style={{ minHeight: 90 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 8 }}>
                    <Zone n={11} label="4 РРС: публичные KPI всех столов (ваш подсвечен)" />
                    <Zone n={12} label="Сброс · Раздача" />
                  </div>
                </div>
                {/* правая колонка */}
                <div style={{ display: "grid", gap: 8 }}>
                  <Zone n={13} label="6 личных колод" style={{ minHeight: 240 }} tall />
                </div>
              </div>
            </div>
            <Table
              head={["№", "Элемент", "За что отвечает", "Как делать выбор"]}
              rows={[
                ["1", "Шапка", "Календарь матча и таймер дедлайна такта (за 60 сек. краснеет)", "Следите за временем: не успели — авто-пас"],
                ["2", "Показатели региона", "Сеть магазинов, сервис, доля онлайн, укомплектованность, доля рынка — живые данные вашей РРС", "Наведите на строку — подсказка, что влияет на показатель"],
                ["3", "Доступные действия", "5 стандартных ходов (логистика, магазин, сервис, реклама, персонал) — всегда доступны при деньгах", "Клик = потратить действие и финансы; серые — не хватает ресурсов/действий"],
                ["4", "Действия (глаголы)", "Планировать/Строить/Развивать/Управлять/Анализировать — открывают соответствующую колоду справа", "Клик — веер карт этой колоды выезжает из стопки"],
                ["5", "Ресурсы", "Финансы, люди, материалы, технологии, репутация + доход в подсказке", "Только просмотр; ресурсы тратятся картами и действиями"],
                ["6", "Проекты", "Запущенные длительные карты: прогресс «3/6 НЕД»", "Только наблюдение: эффект придёт по завершении сам"],
                ["7", "Миссия", "Прогресс каждой миссии против цели текущего квартала; корона = ключевая (режим «гонка»)", "Ориентир для выбора карт: тяните отстающий KPI"],
                ["8", "Событие раунда", "Квартальная дилемма, требующая решения", "Клик «Выбрать реакцию» → модал с вариантами равной формы; смотрите на цену и уместность"],
                ["9", "Чёрный лебедь", "Активный риск: влияние, сколько недель осталось, масштаб; пульсирует = бьёт по вам", "Клик по блоку → выбрать реакцию; наведение — полное описание риска"],
                ["10", "Центр", "Карта дивизиона (арт) и главная кнопка хода", "«Завершить месяц» — когда потратили действия и решили события"],
                ["11", "4 РРС", "Публичная сводка соперников: 6 KPI, кто ходит/спасовал, человек или ИИ", "Наведение — карточка стола; чужие руки и колоды скрыты"],
                ["12", "Сброс и Раздача", "Оранжевая «Сброс» — ваши разыгранные карты; синяя «Раздача» — карты, выданные на партию и ждущие добора", "Сброс: клик — открыть список (виден только вам). Раздача: клик — количество по направлениям; какие именно карты — тайна до добора"],
                ["13", "6 колод", "Личные стопки: Продвижение, Сервис, Логистика, Товар, Сотрудники, Проекты; подпись = сколько в руке и в колоде", "Клик по стопке → веер карт руки → клик по карте → крупный просмотр → «Разыграть». Недоступные объясняют причину"],
              ]}
            />
          </Section>

          {/* ── Карты ── */}
          <Section id="cards" icon={<Layers size={18} aria-hidden />} kicker="Главный ресурс решений" title="Карты и колоды: как читать и играть">
            <p style={S.p}>
              В игре 6 направлений × 50 карт. На старте вы получаете <b style={{ color: "var(--zrd-text)" }}>стартовую руку
              4–8 карт</b> (чем выше сложность, тем меньше), затем каждый месяц добираете 2–3 карты (состав зависит
              от сценария); карты за партию <b style={{ color: "var(--zrd-text)" }}>не повторяются</b>. Рука и остаток колод — тайна
              для соперников. Разыгранные карты уходят в оранжевый «Сброс», ещё не розданные ждут в синей «Раздаче».
            </p>
            <Table
              head={["Что на карте", "Что означает"]}
              rows={[
                ["Название + масштаб («Реклама · пилот» … «· дивизион»)", "Одна и та же идея в разном масштабе: чем крупнее, тем дороже, сильнее и дольше"],
                ["Цена (например «6К · 1П»)", "Сколько ресурсов спишется при розыгрыше: К — финансы, П — люди, С — склады, Т — технологии, Р — рынок"],
                ["Эффекты (зелёные/красные чипы)", "Что изменится: мгновенно, «+N/кв» — производство каждый квартал"],
                ["Условие (тир 2–3)", "Порог для розыгрыша, например «продажи ≥ 5». Кнопка «Разыграть» объяснит, чего не хватает"],
                ["Длительность («проект 6 нед.»)", "Карта уходит в панель «Проекты» и срабатывает по завершении недель"],
              ]}
            />
            <p style={S.p}>
              <b style={{ color: "var(--zrd-text)" }}>Тактика:</b> тир-1 карты — быстрые дешёвые латки; тир-2 — рабочая лошадка;
              тир-3 — дорогие проекты с условиями, которые выигрывают партии, если запущены не позже середины года.
            </p>
          </Section>

          {/* ── События и лебеди ── */}
          <Section id="events" icon={<AlertTriangle size={18} aria-hidden />} kicker="Кризисы" title="События и чёрные лебеди">
            <p style={S.strongP}>Квартальные дилеммы</p>
            <p style={S.p}>
              На рубеже каждого квартала каждый стол получает управленческую дилемму (сбой логистики, текучесть,
              конфликт точек, выход конкурента…). Варианты равны по форме — «правильного по тексту» нет.
              Машина оценивает <b style={{ color: "var(--zrd-text)" }}>уместность</b>: тот же «переждать» силён при пустой кассе
              и слаб при отстающих продажах. Пока дилемма не решена, месяц завершить нельзя.
            </p>
            <p style={S.strongP}>Чёрные лебеди ({BLACK_SWANS.length})</p>
            <p style={S.p}>
              Редкие сильные удары: {SWAN_FREQ_TEXT}. Локальный бьёт по одной случайной РРС, глобальный — по всем.
              Штраф повторяется каждый месяц, пока риск действует (недели) и пока вы <b style={{ color: "var(--zrd-text)" }}>не отреагировали</b>.
              Реакция стоит ресурсов (есть бесплатная «перетерпеть») и снимает штраф только с вашей РРС.
              Оценщик может запустить лебедя вручную — будьте готовы всегда.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {BLACK_SWANS.map((s) => (
                <span key={s.id} title={s.description} style={{ fontSize: 11.5, border: "1px solid var(--zrd-border)", borderRadius: 999, padding: "3px 9px", color: "var(--zrd-text-dim)" }}>
                  {s.scope === "global" ? "🌐" : "📍"} {s.title}
                </span>
              ))}
            </div>
          </Section>

          {/* ── Сценарии ── */}
          <Section id="scenarios" icon={<Swords size={18} aria-hidden />} kicker="Варианты партий" title="Сценарии игры">
            <p style={S.p}>Сценарий выбирает оценщик — он задаёт стартовые условия, набор миссий, частоту лебедей, состав добора и режим победы по умолчанию. Сложность 1–5 накладывается поверх любого сценария.</p>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 8 }}>
              {SCENARIO_IDS.map((id) => {
                const sc = SCENARIOS[id];
                const missions = sc.missionIds.map((m) => MISSION_CATALOG.find((x) => x.id === m)?.label).filter(Boolean);
                return (
                  <div key={id} style={{ border: "1px solid var(--zrd-border)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ ...S.kicker }}>{sc.winModeDefault === "race" ? "Гонка" : "По итогам года"} · лебеди: {sc.swanFrequencyDefault === "storm" ? "шторм" : sc.swanFrequencyDefault === "rare" ? "редко" : sc.swanFrequencyDefault === "off" ? "выкл" : "стандарт"}</div>
                    <div style={{ color: "var(--zrd-text)", fontWeight: 800, fontSize: 15 }}>{sc.title}</div>
                    <p style={{ ...S.p, margin: 0 }}>{sc.tagline}</p>
                    <div style={{ fontSize: 11.5, color: "var(--zrd-text-dim)" }}>Миссии: {missions.join(" · ")}</div>
                  </div>
                );
              })}
            </div>
            <p style={S.p}>
              <b style={{ color: "var(--zrd-text)" }}>Типовые составы стола:</b> соло-ассессмент (1 человек + 3 ИИ) ·
              дуэль (2 человека + 2 ИИ) · командный зачёт (3–4 человека) · «трое и пустой стол» (3 человека, одна РРС выключена) ·
              демонстрация (4 ИИ, все смотрят наблюдение оценщика).
            </p>
          </Section>

          {/* ── Компетенции ── */}
          <Section id="competencies" icon={<GraduationCap size={18} aria-hidden />} kicker="Отдельная инструкция" title="Как игра измеряет 12 компетенций ЗРД">
            <p style={S.p}>
              Оценщик <b style={{ color: "var(--zrd-text)" }}>не ставит баллы вручную</b> — профиль собирает алгоритм по журналу ваших решений.
              Главный принцип: оценивается не «что вы выбрали», а <b style={{ color: "var(--zrd-text)" }}>насколько выбор уместен в контексте вашей РРС</b> в момент решения
              (состояние кассы, команды, склада, отставание от целей). Поэтому «выучить правильные ответы» нельзя — выигрывает управленческое мышление.
            </p>
            <Table
              head={["Компетенция", "Какие игровые сигналы её показывают"]}
              rows={COMPETENCY_KEYS.map((k) => [COMPETENCY_LABEL[k], COMPETENCY_MAP[k].signals])}
            />
            <p style={S.p}>
              Шкала — 0–5 по каждой компетенции. Мягкие компетенции (коммуникация, конфликты) в соло-партии
              видны слабее — их сигнал усиливается в партиях людей друг против друга.
            </p>
          </Section>

          {/* ── Итоги ── */}
          <Section id="results" icon={<BarChart3 size={18} aria-hidden />} kicker="После финального свистка" title="Итоги игры и карта развития">
            <p style={S.p}>Когда матч завершён (12 тактов сыграны или ключевая миссия закрыта), формируются два документа:</p>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 8 }}>
              <div style={{ border: "1px solid var(--zrd-border)", borderRadius: 12, padding: 14 }}>
                <div style={{ ...S.kicker, marginBottom: 4 }}>Игроку · таблица матча</div>
                <p style={S.p}>Места по Торговому рейтингу, победитель с короной, закрытые миссии каждого стола, ваша строка подсвечена. Видна сразу на борде.</p>
              </div>
              <div style={{ border: "1px solid var(--zrd-border)", borderRadius: 12, padding: 14 }}>
                <div style={{ ...S.kicker, marginBottom: 4 }}>Оценщику · профиль и карта развития</div>
                <p style={S.p}>По каждому участнику — 12 компетенций (0–5), итоговые KPI, выполненные миссии и эффективность (потрачено ресурсов / число ходов).</p>
              </div>
            </div>
            <p style={{ ...S.strongP, marginTop: 12 }}>Карта развития сотрудника строится так же, как после основной симуляции SimCenter:</p>
            <ol style={{ color: "var(--zrd-text-dim)", fontSize: 13.5, lineHeight: 1.6, paddingLeft: 20, margin: "6px 0" }}>
              <li><b style={{ color: "var(--zrd-text)" }}>Сильные стороны</b> — компетенции 4.0+: на что опираться, какие задачи делегировать этому управленцу уже сейчас.</li>
              <li><b style={{ color: "var(--zrd-text)" }}>Зоны роста</b> — компетенции ниже 3.0 с примерами конкретных игровых эпизодов («в Q2 при кадровом дефиците выбрал ротацию при полной кассе — просела команда»).</li>
              <li><b style={{ color: "var(--zrd-text)" }}>Рекомендации</b> — по каждой зоне роста: книга/приём из материалов ниже + рабочая практика (например, «неделя решений через таблицу факт→причина→варианты→риск»).</li>
              <li><b style={{ color: "var(--zrd-text)" }}>Контрольная точка</b> — повторная партия через 2–3 месяца в другом сценарии: сравнение профилей показывает динамику.</li>
            </ol>
          </Section>

          {/* ── Материалы ── */}
          <Section id="learning" icon={<GraduationCap size={18} aria-hidden />} kicker="Прокачка между партиями" title="Материалы к обучению">
            <p style={S.p}>Подборка из управленческой библиотеки — по компетенции, которая просела в вашем профиле:</p>
            <Table
              head={["Компетенция", "Что читать / изучать"]}
              rows={COMPETENCY_KEYS.map((k) => [COMPETENCY_LABEL[k], COMPETENCY_MAP[k].books])}
            />
            <p style={S.p}>
              Отдельно про чёрных лебедей — обязательная пара: Нассим Талеб «Чёрный лебедь» (почему их нельзя предсказать)
              и «Антихрупкость» (как строить регион, который от ударов становится сильнее). Именно эта логика зашита в механику рисков игры.
            </p>
          </Section>

          {/* ── Администратору ── */}
          <Section id="admin" icon={<Shield size={18} aria-hidden />} kicker="Служебное" title="Администратору: как менять игру и инструкцию">
            <Table
              head={["Что менять", "Где лежит"]}
              rows={[
                ["Эта инструкция (текст-первоисточник)", "docs/zrd-wiki/16-instrukciya-igry.md — правьте markdown; экранная версия: client/src/features/zrd/manual/ZrdManualPage.tsx"],
                ["Карты колод (300)", "shared/zrd/content-decks.ts — якоря и генератор вариантов"],
                ["Чёрные лебеди (14)", "shared/zrd/content-swans.ts — штрафы, длительности, опции реакции"],
                ["Миссии и сценарии", "shared/zrd/content-missions.ts · content-scenarios.ts"],
                ["Экономика и сложность", "shared/zrd/match-engine.ts (доход/действия/добор) + DIFFICULTY_CONFIGS в content.ts"],
                ["Скоринг компетенций", "shared/zrd/match-scoring.ts — сигналы и калибровка EXPECTED_MAX"],
                ["Правила-канон (wiki)", "docs/zrd-wiki/15-multistol.md + журнал 14-changelog.md — обновлять при каждом изменении механики"],
              ]}
            />
            <p style={S.p}>
              Правило платформы: изменил число или механику в коде → в том же изменении поправь wiki и добавь строку в changelog.
              После правок прогнать: <code style={{ fontSize: 12 }}>npx tsx script/zrd-decks-check.ts</code> и <code style={{ fontSize: 12 }}>npx tsx script/zrd-match-sim.ts</code>.
            </p>
          </Section>

          <footer style={{ textAlign: "center", color: "var(--zrd-text-dim)", fontSize: 11, padding: "8px 0 20px" }}>
            Институт ЗРД · инструкция v2 «Мультистол» · DNS SimCenter
            {isAdmin && " · режим администратора: дополнения к секциям редактируются на месте"}
          </footer>
        </main>
      </div>
    </div>
    </ManualNotesContext.Provider>
  );
}
