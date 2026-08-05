# Дизайн-система SimCenter — фундамент Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить дрейфовавшие от бренда токены цвета/моушена/z-index одним источником правды (`tokens.css`) с двумя явными семантическими наборами (тёмный/светлый), не ломая текущий переключатель темы, и дать витрину для визуальной сверки.

**Architecture:** Новый файл `client/src/styles/tokens.css` определяет базовый слой брендовых примитивов + оба семантических набора под РЕАЛЬНЫМИ существующими селекторами (`:root` = тёмный по умолчанию, `.dns-product-shell.dns-theme-light` = светлый оверрайд — это существующий, не новый механизм из `useDnsTheme()`/`brand-access-shell.tsx`). `base.css` импортирует его и лишается дублирующих объявлений. `tailwind.config.ts` получает недостающие цвета (success/warning/info) и мапит z-index/duration на CSS-переменные, чтобы ими можно было пользоваться как утилитами (`z-overlay`, `duration-base`).

**Tech Stack:** Vite + React + Tailwind CSS 3 + CSS custom properties (HSL), wouter (роутинг), Playwright MCP (визуальная проверка — тестового раннера vitest/jest в проекте нет, юнит-тестов для чистого CSS не пишем).

## Global Constraints

- Не трогать `client/src/features/zrd/*` и `client/src/styles/zrd.css` — вне охвата (см. спек п.3).
- Не трогать `docs/zrd-wiki/` в рамках этого плана.
- Не удалять `react-icons` из зависимостей — только не использовать в новом коде (спек п.14).
- Не переписывать `visual-system.css` целиком — трогаем только объявления `--dns-visual-*` (8 строк), остальные ~2000 строк файла вне охвата (см. Task 6).
- Каждая правка CSS проверяется: `npm run check` (tsc), `npm run build`, и визуально через Playwright-скриншот (dark + light) на затронутом экране — юнит-тестов для чистого CSS не существует в проекте, это единственный доступный «test cycle».
- Коммит только по завершении задачи, только релевантные файлы (не `git add -A`).

---

## Файловая карта

```
client/src/styles/
  tokens.css          ← СОЗДАЁТСЯ. Базовый слой + оба семантических набора + моушен/z-index токены.
  base.css             ← МЕНЯЕТСЯ: добавляется @import, удаляются дублирующие объявления (:root цвета, мёртвые --dns-* строки 662-669).
  visual-system.css    ← МЕНЯЕТСЯ ТОЧЕЧНО: строки 2-9 и 17-21 (объявления --dns-visual-*) переводятся на var(...) из tokens.css.
tailwind.config.ts      ← МЕНЯЕТСЯ: добавляются colors.success/warning/info, theme.extend.zIndex, theme.extend.transitionDuration.
client/src/pages/
  design-system.tsx     ← СОЗДАЁТСЯ. Витрина токенов + существующих shadcn-компонентов.
client/src/App.tsx      ← МЕНЯЕТСЯ: регистрируется route /design-system.
```

---

### Task 1: `tokens.css` — базовый слой + оба семантических набора

**Files:**
- Create: `client/src/styles/tokens.css`

**Interfaces:**
- Produces: CSS custom properties, потребляемые `tailwind.config.ts` (`hsl(var(--background))` и т.д. — уже так спроектировано, имена переменных не меняются) и напрямую компонентами через `var(--dns-navy)` и т.п. для новых мест, где нужен именно базовый бренд-цвет, а не семантический.

- [ ] **Step 1: Создать файл с базовым слоем и обоими семантическими наборами**

```css
/* client/src/styles/tokens.css
 * Единственный источник правды для цвета/моушена/z-index SimCenter.
 * Канон и происхождение значений: docs/superpowers/specs/2026-07-10-design-system-foundation-design.md
 *
 * Селекторы ниже — НЕ новые: :root уже безусловно тёмный (был так и раньше),
 * .dns-product-shell.dns-theme-light — существующий светлый оверрайд,
 * управляемый хуком useDnsTheme() (client/src/components/brand-access-shell.tsx).
 * Здесь только заменяются ЗНАЧЕНИЯ, механизм переключения не меняется.
 */

:root {
  /* ---- Базовый слой: бренд-примитивы (не зависят от темы) ---- */
  --dns-navy: 225 100% 14%;      /* #001145 */
  --dns-orange: 30 92% 54%;      /* #f68b1f */
  --dns-blue: 203 66% 49%;       /* #2a91d0 */
  --dns-teal: 168 100% 36%;      /* #00ba95 */
  --dns-gray: 0 0% 31%;          /* #505050 */
  --dns-success: 148 48% 43%;    /* #38a169 */
  --dns-warning: 45 100% 55%;    /* #f6ad55, согласовано с --chart-3 */
  --dns-info: 203 66% 49%;       /* = --dns-blue */
  --dns-error: 0 76% 57%;        /* #e53e3e */

  /* ---- Моушен (тема-независимый) ---- */
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 320ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);

  /* ---- Z-index (тема-независимый) ---- */
  --z-raised: 10;
  --z-sticky: 20;
  --z-dropdown: 30;
  --z-overlay: 50;
  --z-toast: 60;
  --z-tooltip: 70;

  /* ---- Семантика: ТЁМНАЯ тема (default) ---- */
  --background: 225 40% 8%;
  --foreground: 210 35% 93%;
  --border: 220 24% 26%;
  --input: 220 24% 26%;

  --card: 224 35% 13%;
  --card-foreground: 210 35% 93%;
  --card-border: 220 24% 26%;

  --sidebar: 226 42% 11%;
  --sidebar-foreground: 0 0% 90%;
  --sidebar-border: 220 24% 20%;
  --sidebar-primary: 30 92% 54%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 222 26% 19%;
  --sidebar-accent-foreground: 0 0% 90%;
  --sidebar-ring: 30 92% 54%;

  --popover: 224 35% 13%;
  --popover-foreground: 210 35% 93%;
  --popover-border: 220 24% 26%;

  --primary: 30 92% 54%;
  --primary-foreground: 0 0% 100%;

  --secondary: 222 28% 17%;
  --secondary-foreground: 0 0% 88%;

  --muted: 222 22% 17%;
  --muted-foreground: 225 15% 60%;

  --accent: 222 26% 19%;
  --accent-foreground: 0 0% 88%;

  --destructive: 0 76% 57%;
  --destructive-foreground: 0 0% 100%;

  --ring: 30 92% 54%;

  --chart-1: 30 92% 54%;
  --chart-2: 168 100% 36%;
  --chart-3: 45 100% 55%;
  --chart-4: 203 66% 49%;
  --chart-5: 0 76% 57%;

  --radius: 1rem;
}

/* ---- Семантика: СВЕТЛАЯ тема (оверрайд) ---- */
.dns-product-shell.dns-theme-light {
  --background: 210 40% 98%;
  --foreground: 213 43% 14%;
  --border: 214 28% 80%;
  --input: 214 26% 82%;

  --card: 0 0% 100%;
  --card-foreground: 213 43% 14%;
  --card-border: 214 30% 80%;

  --popover: 0 0% 100%;
  --popover-foreground: 213 43% 14%;
  --popover-border: 214 30% 80%;

  --secondary: 214 36% 94%;
  --secondary-foreground: 213 43% 18%;

  --muted: 214 32% 92%;
  --muted-foreground: 212 19% 39%;

  --accent: 214 40% 92%;
  --accent-foreground: 213 43% 18%;

  --sidebar: 210 40% 97%;
  --sidebar-foreground: 213 30% 22%;
  --sidebar-border: 214 28% 82%;
  --sidebar-accent: 214 36% 92%;
  --sidebar-accent-foreground: 213 43% 18%;

  /* --primary/--destructive не переопределяются — наследуются из :root
     (подтверждено: текущий светлый блок base.css:885-908 их тоже не переопределял) */

  --radius: 1rem;
}
```

- [ ] **Step 2: Проверить, что файл синтаксически корректен**

Run: `npx tsc --noEmit` (CSS не типизируется tsc, но команда должна пройти без ошибок — новый файл ни на что пока не влияет, т.к. никем не импортирован)
Expected: PASS (0 ошибок, как и до изменения)

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/tokens.css
git commit -m "feat(design-system): добавить tokens.css — единый источник правды токенов"
```

---

### Task 2: `tailwind.config.ts` — success/warning/info + z-index/duration утилиты

**Files:**
- Modify: `tailwind.config.ts:44-83` (блок `colors`)

**Interfaces:**
- Consumes: `--dns-success`, `--dns-warning`, `--dns-info`, `--z-*`, `--duration-*` из `tokens.css` (Task 1).
- Produces: Tailwind-классы `bg-success`/`text-success-foreground`, `bg-warning`, `bg-info`, `z-raised`/`z-sticky`/`z-dropdown`/`z-overlay`/`z-toast`/`z-tooltip`, `duration-fast`/`duration-base`/`duration-slow`.

- [ ] **Step 1: Добавить success/warning/info рядом с destructive**

Modify `tailwind.config.ts`, найти блок:

```ts
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
```

Добавить сразу после него:

```ts
        success: {
          DEFAULT: "hsl(var(--dns-success) / <alpha-value>)",
          foreground: "0 0% 100%",
        },
        warning: {
          DEFAULT: "hsl(var(--dns-warning) / <alpha-value>)",
          foreground: "0 0% 12%",
        },
        info: {
          DEFAULT: "hsl(var(--dns-info) / <alpha-value>)",
          foreground: "0 0% 100%",
        },
```

- [ ] **Step 2: Добавить zIndex и transitionDuration в `theme.extend`**

Найти конец блока `animation` в `tailwind.config.ts` (перед закрывающей `},` для `extend`) и добавить рядом два новых поля:

```ts
      zIndex: {
        raised: "var(--z-raised)",
        sticky: "var(--z-sticky)",
        dropdown: "var(--z-dropdown)",
        overlay: "var(--z-overlay)",
        toast: "var(--z-toast)",
        tooltip: "var(--z-tooltip)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
```

- [ ] **Step 3: Проверить типы и сборку**

Run: `npm run check`
Expected: PASS, без ошибок TypeScript

Run: `npm run build`
Expected: PASS, сборка проходит (новые классы пока нигде не используются, но конфиг должен быть валиден)

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(design-system): success/warning/info цвета + z-index/duration утилиты"
```

---

### Task 3: Подключить `tokens.css`, убрать дублирующие объявления в `base.css`

**Files:**
- Modify: `client/src/styles/base.css:1` (добавить импорт)
- Modify: `client/src/styles/base.css:584-685` (сократить `:root`)
- Modify: `client/src/styles/base.css:874-908` (сократить светлый блок)

**Interfaces:**
- Consumes: селекторы и переменные из `tokens.css` (Task 1).

- [ ] **Step 1: Добавить импорт в начало файла**

В `base.css` первой строкой (перед `@import url('https://fonts.googleapis.com/...')`) добавить:

```css
@import './tokens.css';
```

- [ ] **Step 2: Удалить дублирующие цветовые объявления из `:root` (base.css:596-644)**

Убрать блок от комментария `/* Core surfaces ... */` (строка 596) до строки `--chart-5: 0 72% 55%;               /* Red */` (строка 643) включительно — все эти переменные теперь приходят из `tokens.css`. **Оставить нетронутыми**: строки 585-594 (font-size clamp, `--button-outline`, `--badge-outline`, `--opaque-button-border-intensity`, `--elevate-1/2`), строки 645-647 (`--font-sans`, `--font-mono` — не токенизируем шрифт в этом заходе, `--radius` теперь приходит из `tokens.css`, эту строку тоже удалить), 649-659 (shadows, tracking, spacing — не трогаем), 678-684 (border-helpers, ссылаются на `--primary`/`--secondary` и т.д. через `hsl(var(...))` — эти переменные теперь берутся из `tokens.css`, сами helper-строки остаются).

- [ ] **Step 3: Удалить 8 строк мёртвых `--dns-*` переменных (base.css:662-669)**

Удалить:

```css
  /* DNS custom vars */
  --dns-orange: #FF6B00;
  --dns-orange-dim: #cc5500;
  --dns-teal: #00d4aa;
  --dns-amber: #ffc107;
  --dns-red: #ff4444;
  --dns-bg-dark: #1a1a2e;
  --dns-panel: #1e2a3a;
  --dns-panel-border: #2a3a4e;
```

Подтверждено (Task 1 исследования), что нигде в `client/src` не используются (`grep -r "var(--dns-orange)"` и соседи — 0 совпадений). Соседние `--scrollbar-*` (следующие 7 строк) не трогать — используются в `base.css:1252-1263,2348-2359`.

- [ ] **Step 4: Удалить дублирующие цветовые объявления из светлого блока (base.css:885-906)**

В блоке `.dns-product-shell.dns-theme-light { ... }` убрать строки с `--background` по `--sidebar-accent-foreground` (885-906) — приходят из `tokens.css`. **Оставить**: `color-scheme: light;`, `--dns-admin-border*`, `--dns-admin-text-*` (874-880 — отдельный, не пересекающийся namespace для admin-специфичных нужд, вне охвата) и `color: #142033;` (907).

- [ ] **Step 5: Проверить сборку**

Run: `npm run check`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Визуальная проверка (Playwright) — оба экрана, обе темы**

Запустить dev-сервер (`npm run dev`), затем через Playwright MCP:
1. Открыть `/staff-login`, сделать скриншот в тёмной теме (дефолт).
2. Переключить тему через `ThemeToggle` (кнопка с `aria-label="Включить светлую тему"`), сделать скриншот в светлой.
3. Открыть `/admin` (после логина или напрямую, если доступно без авторизации в dev), повторить оба скриншота.

Ожидаемо: фон тёмной темы — глубокий navy (не почти-чёрный как раньше), primary-акцент — тёплый янтарный оранжевый; светлая тема визуально не сломана (текст читаем, нет прозрачных/чёрных провалов). Никаких сломанных layout, наложений, `NaN`/`undefined` в стилях.

Если что-то выглядит не так — прежде чем продолжать, скорректировать конкретные HSL-значения в `tokens.css` (Task 1) и повторить проверку.

- [ ] **Step 7: Commit**

```bash
git add client/src/styles/base.css
git commit -m "feat(design-system): подключить tokens.css, убрать дублирующие/мёртвые объявления в base.css"
```

---

### Task 4: Точечная миграция `--dns-visual-*` в `visual-system.css`

**Files:**
- Modify: `client/src/styles/visual-system.css:1-22`

**Interfaces:**
- Consumes: `--dns-orange`, `--dns-blue`, `--dns-teal` из `tokens.css` (Task 1).
- Не трогает остальные ~2075 строк файла (хардкод rgba/hex в `.dns-home-*`, `.dns-access-*` и т.п. — отдельный, гораздо больший объём работы, backlog, не входит в этот план).

- [ ] **Step 1: Заменить объявления `--dns-visual-*` на ссылки на базовый слой**

Текущее (`visual-system.css:1-14`):

```css
.dns-visual-shell {
  --dns-visual-orange: #ff6b00;
  --dns-visual-blue: #4a9eff;
  --dns-visual-cyan: #00d4aa;
  --dns-visual-text: #f7f9ff;
  --dns-visual-muted: #a4b0c5;
  --dns-visual-panel: rgba(10, 18, 31, 0.9);
  --dns-visual-panel-soft: rgba(16, 27, 44, 0.76);
  --dns-visual-border: rgba(133, 156, 190, 0.34);
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  color: var(--dns-visual-text);
}
```

Заменить на:

```css
.dns-visual-shell {
  --dns-visual-orange: hsl(var(--dns-orange));
  --dns-visual-blue: hsl(var(--dns-blue));
  --dns-visual-cyan: hsl(var(--dns-teal));
  --dns-visual-text: #f7f9ff;
  --dns-visual-muted: #a4b0c5;
  --dns-visual-panel: rgba(10, 18, 31, 0.9);
  --dns-visual-panel-soft: rgba(16, 27, 44, 0.76);
  --dns-visual-border: rgba(133, 156, 190, 0.34);
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  color: var(--dns-visual-text);
}
```

(`--dns-visual-text/muted/panel/*` оставлены как есть — они не про бренд-цвет, а про непрозрачность/поверхности конкретно этого визуального слоя, переносить их в базовый слой преждевременно без более широкого аудита файла.)

- [ ] **Step 2: Проверить сборку**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Визуальная проверка (Playwright)**

Открыть `/` (role-select, использует `dns-visual-shell`), скриншот в обеих темах. Ожидаемо: оранжевые акценты (логотип, кнопки) стали чуть теплее/янтарнее (новый `--dns-orange`), в остальном страница выглядит так же.

- [ ] **Step 4: Commit**

```bash
git add client/src/styles/visual-system.css
git commit -m "feat(design-system): --dns-visual-orange/blue/cyan теперь ссылаются на базовый слой tokens.css"
```

---

### Task 5: Витрина `/design-system`

**Files:**
- Create: `client/src/pages/design-system.tsx`
- Modify: `client/src/App.tsx:21` (добавить lazy-импорт)
- Modify: `client/src/App.tsx:35` (добавить route)

**Interfaces:**
- Consumes: существующие компоненты из `client/src/components/ui/*` (Button, Card, Badge, Input, Alert и т.д. — использовать как есть, не создавать новые), `ThemeToggle`/`useDnsTheme` из `client/src/components/brand-access-shell.tsx`.

- [ ] **Step 1: Создать страницу-витрину**

```tsx
// client/src/pages/design-system.tsx
import { useDnsTheme, ThemeToggle } from "@/components/brand-access-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const COLOR_TOKENS = [
  { name: "background", label: "Background" },
  { name: "foreground", label: "Foreground" },
  { name: "card", label: "Card" },
  { name: "primary", label: "Primary" },
  { name: "secondary", label: "Secondary" },
  { name: "muted", label: "Muted" },
  { name: "accent", label: "Accent" },
  { name: "destructive", label: "Destructive" },
  { name: "success", label: "Success" },
  { name: "warning", label: "Warning" },
  { name: "info", label: "Info" },
] as const;

function ColorSwatch({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-16 w-full rounded-md border border-border"
        style={{ background: `hsl(var(--${name}))` }}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
      <code className="text-xs">--{name}</code>
    </div>
  );
}

export default function DesignSystemPage() {
  const { theme, themeClass, toggleTheme } = useDnsTheme();

  return (
    <div className={`dns-product-shell min-h-dvh bg-background text-foreground ${themeClass}`}>
      <div className="mx-auto max-w-5xl space-y-10 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Design System — SimCenter</h1>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Токены цвета</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {COLOR_TOKENS.map((token) => (
              <ColorSwatch key={token.name} {...token} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Кнопки</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Бейджи</h2>
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Карточка</h2>
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle>Пример карточки</CardTitle>
            </CardHeader>
            <CardContent>
              <Input placeholder="Поле ввода" />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Алерты</h2>
          <Alert>
            <AlertTitle>Успех</AlertTitle>
            <AlertDescription>Пример стандартного алерта.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>Пример деструктивного алерта.</AlertDescription>
          </Alert>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Зарегистрировать route**

В `client/src/App.tsx` добавить lazy-импорт рядом с остальными (после строки 22):

```ts
const DesignSystemPage = lazy(() => import("@/pages/design-system"));
```

И добавить route в `AppRouter` (после строки `<Route path="/results" component={ResultsPage} />`, перед `<Route component={NotFound} />`):

```tsx
      <Route path="/design-system" component={DesignSystemPage} />
```

- [ ] **Step 3: Проверить типы и сборку**

Run: `npm run check`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Визуальная проверка (Playwright)**

Запустить `npm run dev`, открыть `/#/design-system` (hash-роутер — важно: путь через `#`, не query, см. паттерн `/?id=...#/zrd` в проекте), сделать скриншот в обеих темах через кнопку переключения. Ожидаемо: все токены/компоненты рендерятся, нет надписей "undefined", контраст текста читаем в обеих темах.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/design-system.tsx client/src/App.tsx
git commit -m "feat(design-system): страница-витрина /design-system"
```

---

### Task 6: Финальная сквозная проверка

**Files:** нет новых, только верификация.

- [ ] **Step 1: Полная проверка типов**

Run: `npm run check`
Expected: PASS, 0 ошибок

- [ ] **Step 2: Полная сборка**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Существующие проверочные скрипты проекта**

Run: `npm run test` (tsx script/ci-smoke.ts)
Expected: PASS (как и до изменений — этот заход не трогает бизнес-логику/API)

- [ ] **Step 4: Финальный визуальный проход по ключевым экранам**

Через Playwright MCP пройти `/`, `/staff-login`, `/design-system` в обеих темах (6 скриншотов), убедиться в отсутствии горизонтального скролла, наложений, сломанных hover/disabled состояний, ошибок в консоли браузера.

- [ ] **Step 5: Проверить чистоту git-статуса**

Run: `git status --short`
Expected: пусто (все изменения из Task 1-5 закоммичены), либо только преднамеренно оставленные незакоммиченные файлы, не относящиеся к этому плану.

---

## Не входит в этот план (backlog, см. спек п.3 и п.19.6)

- Полная миграция хардкод-хекса в `admin.css`/`assessor.css`/`simulation.css` и остальной части `visual-system.css` — мигрируется по мере правок соответствующих файлов в будущих задачах.
- Новый Figma-файл «SimCenter — UI Design System» — ручное действие пользователя в Figma, не код.
- ЗРД (`zrd.css`) и РРС Тюмень дашборд.
