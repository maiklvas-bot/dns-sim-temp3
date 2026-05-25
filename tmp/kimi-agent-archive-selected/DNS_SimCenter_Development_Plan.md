# DNS SimCenter v3.0 — План развития проекта

> **Назначение**: Пошаговый план внедрения изменений, разбитый на независимые блоки.
> Каждый блок можно реализовывать отдельно, не затрагивая остальные.
> 
> **Как пользоваться**: Выберите блок → выполните задачи по порядку → проставьте галочки в логе

---

# СОДЕРЖАНИЕ

1. [БЛОК 1: Безопасность (auth + sessions)](#блок-1-безопасность)
2. [БЛОК 2: Rate Limiting](#блок-2-rate-limiting)
3. [БЛОК 3: CSRF Защита](#блок-3-csrf-защита)
4. [БЛОК 4: Валидация входных данных (Zod)](#блок-4-валидация-входных-данных)
5. [БЛОК 5: Backend API (новые endpoints)](#блок-5-backend-api)
6. [БЛОК 6: Дизайн-система DNS](#блок-6-дизайн-система-dns)
7. [БЛОК 7: Мобильная адаптивность (simulation.tsx)](#блок-7-мобильная-адаптивность)
8. [БЛОК 8: Упрощение оценщика (assessor.tsx)](#блок-8-упрощение-интерфейса-оценщика)
9. [БЛОК 9: Переработка результатов (results.tsx)](#блок-9-переработка-результатов)
10. [БЛОК 10: Админ-панель — скролл](#блок-10-админ-панель--скролл)
11. [БЛОК 11: Docker](#блок-11-docker)
12. [Критерии приемки](#критерии-приемки)
13. [Лог ведения разработки](#лог-ведения-разработки)

---

# БЛОК 1: Безопасность

## Задача: Заменить scrypt на bcrypt, усилить сессии, добавить helmet

### 1.1 Установить зависимости

```bash
npm install bcrypt helmet express-rate-limit
npm install -D @types/bcrypt
```

### 1.2 Заменить `server/auth.ts` целиком

**БЫЛО:**
```typescript
import crypto from "crypto";
const SCRYPT_KEYLEN = 64;
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}
```

**СТАЛО:** [см. файл `/mnt/agents/dns-sim-temp3/server/auth.ts` — полностью готовый]

Ключевые изменения:
- `bcrypt.hash(password, 12)` вместо `scryptSync`
- `bcrypt.compare(password, hash)` вместо ручного сравнения
- Обратная совместимость для старых scrypt-хешей через `verifyLegacyScryptPassword`
- Асинхронные функции (`async/await`)
- Валидация: минимум 8 символов, не пустой пароль

### 1.3 Обновить `server/staff-storage.ts`

**Что изменить:**
1. Сделать `ensureDefaults()` асинхронным (`async`)
2. Сделать `authenticate()` асинхронным (`async`)
3. Заменить вызовы хеширования на `await hashPassword()`
4. Добавить метод `listStaff()` — возвращает список админов и оценщиков
5. Добавить проверку дефолтных паролей через `checkDefaultPasswords()`

**Ключевой код для `authenticate()`:**
```typescript
async authenticate(payload: StaffLoginPayload): Promise<StaffPrincipal | null> {
  // Валидация username
  const usernameRegex = /^[a-zA-Z0-9._-]+$/;
  if (!payload.username || !usernameRegex.test(payload.username)) {
    return null;
  }

  // Проверка админа
  const adminAccount = db.select().from(admins).where(eq(admins.username, payload.username)).get();
  if (adminAccount && adminAccount.isActive) {
    const isValid = await verifyPassword(payload.password, adminAccount.passwordHash);
    if (isValid) { /* return admin */ }
  }

  // Проверка оценщика
  const evaluatorAccount = db.select().from(evaluatorAccounts)...;
  // ... аналогично

  return null; // Не раскрываем какое поле неверное
}
```

### 1.4 Обновить `server/index.ts` — Session конфигурация

**БЫЛО (строки 50-70 примерно):**
```typescript
cookie: {
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 8,  // 8 часов
  sameSite: "lax",
  secure: false,
}
```

**СТАЛО:**
```typescript
cookie: {
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 2,   // 2 часа (уменьшено)
  sameSite: "strict",           // было "lax"
  secure: isHttps,              // true в production
}
name: "dns-simcenter.sid",      // маскировка
resave: false,
rolling: true,                  // продление при активности
saveUninitialized: false,
```

### 1.5 Добавить SESSION_SECRET защиту

**Добавить в `server/index.ts` ПЕРЕД созданием сессии:**
```typescript
function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.length >= 32) return envSecret;
  
  console.warn("SESSION_SECRET не установлен или слишком короткий!");
  const crypto = require("crypto");
  return crypto.randomBytes(64).toString("hex");
}
const sessionSecret = getSessionSecret();
```

### 1.6 Добавить Helmet

**В `server/index.ts` ПОСЛЕ `const app = express()`:**
```typescript
import helmet from "helmet";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isProduction ? ["'self'", "'unsafe-inline'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "/library", "/uploads"],
      fontSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:", "/library", "/uploads"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  frameguard: { action: "deny" },
  noSniff: true,
  hsts: isHttps ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
```

### 1.7 Добавить заголовки X-XSS-Protection

**В `server/index.ts` ПОСЛЕ helmet:**
```typescript
app.use((_req, res, next) => {
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.removeHeader("X-Powered-By");
  next();
});
```

### 1.8 Ограничить JSON body

**В `server/index.ts` заменить:**
```typescript
app.use(express.json());
// на:
app.use(express.json({ limit: "10mb" }));
```

---

# БЛОК 2: Rate Limiting

## Задача: Защита от brute-force и DoS

### 2.1 Создать файл `server/middleware/rate-limiter.ts`

**Содержимое:** [см. готовый файл в `/mnt/agents/dns-sim-temp3/server/middleware/rate-limiter.ts`]

Ключевые экспорты:
```typescript
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 минут
  max: 5,                     // 5 попыток
  keyGenerator: (req) => `${req.ip}:${req.body?.username || "unknown"}`,
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,                   // 100 запросов
  skip: (req) => req.path === "/health", // health check без лимита
});

export const heavyOperationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                    // 10 запросов (PDF/XLSX)
});
```

### 2.2 Подключить в `server/index.ts`

**Добавить импорт:**
```typescript
import { apiRateLimiter } from "./middleware/rate-limiter";
```

**Добавить ПОСЛЕ session, ДО регистрации routes:**
```typescript
app.use("/api", apiRateLimiter);
```

### 2.3 Подключить login rate limiter в `server/routes.ts`

**Добавить импорт:**
```typescript
import { loginRateLimiter, recordFailedLogin, clearFailedAttempts } from "./middleware/rate-limiter";
```

**Применить к login endpoint:**
```typescript
app.post("/api/staff/login", loginRateLimiter, async (req, res) => {
  // ... код аутентификации
  if (!result) {
    recordFailedLogin(req);  // записываем неудачную попытку
    return res.status(401).json({ message: "Invalid credentials" });
  }
  clearFailedAttempts(req);  // очищаем при успехе
  // ...
});
```

---

# БЛОК 3: CSRF Защита

## Задача: Защита от Cross-Site Request Forgery

### 3.1 Создать файл `server/middleware/csrf.ts`

**Содержимое:** [см. готовый файл в `/mnt/agents/dns-sim-temp3/server/middleware/csrf.ts`]

Ключевые функции:
```typescript
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function csrfProtection(req, res, next): void {
  // Пропускаем GET/HEAD/OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  
  // Пропускаем exempt-пути
  if (["/api/staff/login", "/api/staff/logout"].includes(req.path)) return next();
  
  // Проверяем токен из заголовка X-CSRF-Token
  const submittedToken = req.headers["x-csrf-token"];
  const expectedToken = req.session?.csrfToken;
  
  if (!submittedToken || submittedToken !== expectedToken) {
    return res.status(403).json({ message: "CSRF token invalid" });
  }
  next();
}
```

### 3.2 Подключить в `server/index.ts`

**Добавить импорт:**
```typescript
import { csrfProtection } from "./middleware/csrf";
```

**Добавить ПОСЛЕ rate limiter:**
```typescript
app.use(csrfProtection);
```

### 3.3 Выдавать токен при логине

**В `server/routes.ts` в endpoint логина:**
```typescript
import { regenerateCsrfToken } from "./middleware/csrf";

app.post("/api/staff/login", ..., async (req, res) => {
  // ... после успешной аутентификации
  req.session.staff = { id, role, username, displayName };
  const csrfToken = regenerateCsrfToken(req);
  res.json({ staff: req.session.staff, csrfToken });
});
```

### 3.4 Расширить типы сессии

**В `server/index.ts` (или отдельный .d.ts файл):**
```typescript
declare module "express-session" {
  interface SessionData {
    staff?: { id: number; role: string; username: string; displayName: string };
    csrfToken?: string;
  }
}
```

---

# БЛОК 4: Валидация входных данных

## Задача: Защита от injection и некорректных данных

### 4.1 Создать файл `server/middleware/validation.ts`

**Содержимое:** [см. готовый файл в `/mnt/agents/dns-sim-temp3/server/middleware/validation.ts`]

Ключевые схемы:
```typescript
export const usernameSchema = z.string()
  .min(3, "Логин минимум 3 символа")
  .max(50)
  .regex(/^[a-zA-Z0-9._-]+$/);

export const passwordSchema = z.string()
  .min(8, "Пароль минимум 8 символов")
  .max(128);

export const staffLoginBodySchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});
```

### 4.2 Middleware-фабрики

```typescript
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: result.error.errors.map(e => `${e.path}: ${e.message}`),
      });
    }
    req.validatedBody = result.data;
    next();
  };
}
```

### 4.3 Расширить типы Express

```typescript
declare global {
  namespace Express {
    interface Request {
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}
```

### 4.4 Применить в routes

```typescript
import { validateBody, staffLoginBodySchema } from "./middleware/validation";

app.post("/api/staff/login", validateBody(staffLoginBodySchema), async (req, res) => {
  const { username, password } = req.validatedBody as { username: string; password: string };
  // ...
});
```

---

# БЛОК 5: Backend API

## Задача: Новые endpoints, удаление JSON экспорта

### 5.1 Добавить удаление результатов в `server/session-storage.ts`

**Добавить метод в класс `SessionStorage`:**
```typescript
deleteSessionResult(sessionId: number): void {
  db.transaction((tx) => {
    tx.delete(sessionAnswers).where(eq(sessionAnswers.sessionId, sessionId)).run();
    tx.delete(sessionMetrics).where(eq(sessionMetrics.sessionId, sessionId)).run();
    tx.delete(sessionResults).where(eq(sessionResults.sessionId, sessionId)).run();
    tx.delete(simulationSessions).where(eq(simulationSessions.id, sessionId)).run();
  });
}
```

### 5.2 Добавить endpoint DELETE `/api/admin/results/:id`

**В `server/routes.ts` добавить:**
```typescript
import { validateParams, sessionIdParamSchema } from "./middleware/validation";

app.delete("/api/admin/results/:id", requireAdmin, validateParams(sessionIdParamSchema), (req, res) => {
  const { id } = req.validatedParams as { id: string };
  const sessionId = parseInt(id, 10);
  
  // Проверяем существование
  const existing = sessionStorage.getSimulationSession(sessionId);
  if (!existing) {
    return res.status(404).json({ message: "Session not found" });
  }
  
  sessionStorage.deleteSessionResult(sessionId);
  res.json({ message: "Session deleted successfully", sessionId });
});
```

### 5.3 Добавить endpoint GET `/api/admin/staff`

**В `server/routes.ts` добавить:**
```typescript
app.get("/api/admin/staff", requireAdmin, (req, res) => {
  const staff = staffStorage.listStaff();
  res.json(staff);
});
```

### 5.4 Добавить health check

**В `server/index.ts` (уже есть в моей версии):**
```typescript
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
});
```

### 5.5 Убрать JSON экспорт

**Найти в `server/routes.ts`:**
- Удалить endpoint `/api/export-json` если есть
- Убедиться что остались только `/api/export-pdf` и `/api/export-xlsx`

---

# БЛОК 6: Дизайн-система DNS

## Задача: Создать единую корпоративную стилистику

### 6.1 Создать файл `client/src/styles/dns-theme.ts`

**Содержимое:** [см. готовый файл в `/mnt/agents/dns-sim-temp3/client/src/styles/dns-theme.ts`]

Основные экспорты:
```typescript
export const DNS_COLORS = {
  primary: '#F04E23',      // DNS Orange
  primaryLight: '#FF6B35',
  bgDark: '#0F1923',       // Dark Navy
  bgCard: '#1A2634',
  bgElevated: '#243447',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  success: '#00C853',
  warning: '#FFB300',
  error: '#FF1744',
  info: '#2979FF',
};

export const DNS_TYPOGRAPHY = {
  fontFamily: { sans: 'Inter, system-ui, sans-serif', mono: 'JetBrains Mono, monospace' },
  sizes: { xs: '0.6875rem', sm: '0.8125rem', base: '0.9375rem', lg: '1.125rem', xl: '1.375rem', '2xl': '1.75rem' },
};

export const DNS_ANIMATIONS = {
  transitions: { fast: '150ms ease', normal: '250ms ease', slow: '400ms ease' },
};

export const DNS_BREAKPOINTS = {
  xs: '375px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px',
};
```

### 6.2 Создать файл `client/src/styles/dns-global.css`

**Содержимое:** [см. готовый файл в `/mnt/agents/dns-sim-temp3/client/src/styles/dns-global.css`]

Ключевые CSS переменные:
```css
@layer base {
  :root {
    --dns-primary: #F04E23;
    --dns-primary-light: #FF6B35;
    --dns-bg: #0F1923;
    --dns-card: #1A2634;
    --dns-elevated: #243447;
    --dns-text: #FFFFFF;
    --dns-text-secondary: #94A3B8;
    --dns-success: #00C853;
    --dns-warning: #FFB300;
    --dns-error: #FF1744;
  }
}
```

### 6.3 Подключить шрифты в `client/index.html`

**Добавить в `<head>`:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

---

# БЛОК 7: Мобильная адаптивность

## Задача: Сделать simulation.tsx работающим на телефонах

### 7.1 Добавить таб-переключение

**В `client/src/pages/simulation.tsx`:**

1. Добавить импорт иконок:
```typescript
import { useState } from "react";
import { Map, BarChart3, Radio } from "lucide-react";
```

2. Добавить state для таба:
```typescript
const [mobileTab, setMobileTab] = useState<'map' | 'signals' | 'metrics'>('signals');
```

3. Заменить grid layout:
```tsx
// БЫЛО:
<div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[228px_minmax(0,1fr)_264px]">

// СТАЛО:
<div className="grid h-full min-h-0 grid-cols-1 gap-2 md:gap-3 md:grid-cols-[200px_1fr] xl:grid-cols-[220px_minmax(0,1fr)_260px]">
```

4. Добавить мобильный таб-бар (виден только на <768px):
```tsx
<div className="flex md:hidden items-center gap-1 px-2 py-1.5 overflow-x-auto border-b border-white/[0.04]">
  <button onClick={() => setMobileTab('map')} className={mobileTab === 'map' ? 'bg-[#FF6B00]/15 text-[#FF6B00]' : 'text-[#8B95A5]'}>
    <Map className="w-4 h-4" /> Карта
  </button>
  <button onClick={() => setMobileTab('signals')} className={mobileTab === 'signals' ? 'bg-[#FF6B00]/15 text-[#FF6B00]' : 'text-[#8B95A5]'}>
    <Radio className="w-4 h-4" /> Сигналы
  </button>
  <button onClick={() => setMobileTab('metrics')} className={mobileTab === 'metrics' ? 'bg-[#FF6B00]/15 text-[#FF6B00]' : 'text-[#8B95A5]'}>
    <BarChart3 className="w-4 h-4" /> Метрики
  </button>
</div>
```

5. Скрывать панели по табу:
```tsx
{/* Store Map */}
<div className={`... ${mobileTab !== 'map' ? 'hidden md:block' : ''}`}>
  <StoreMap />
</div>

{/* Signals */}
<div className={`... ${mobileTab !== 'signals' ? 'hidden md:block' : ''}`}>
  <SignalFeed />
</div>

{/* Metrics */}
<div className={`... ${mobileTab !== 'metrics' ? 'hidden md:block' : ''}`}>
  <MetricsPanel />
</div>
```

### 7.2 Адаптировать header

- Уменьшить padding: `px-2 py-1.5 md:px-4 md:py-2`
- Скрыть лейблы на мобильных: `hidden sm:inline`
- Скрыть participant name: `hidden md:flex`
- Кнопки компактнее

---

# БЛОК 8: Упрощение интерфейса оценщика

## Задача: Сделать HR-friendly wizard вместо 8 секций настроек

### 8.1 Добавить 3-шаговый wizard

**В `client/src/pages/assessor.tsx`:**

1. Добавить state:
```typescript
const [wizardStep, setWizardStep] = useState(1); // 1, 2, 3
```

2. Шаг 1 — "Кто участник":
- Поле "ФИО участника" (обязательное)
- Поле "ФИО оценщика" (обязательное)
- Кнопка "Далее"

3. Шаг 2 — "Сложность":
- 3 карточки: Лёгкий (20 мин) / Средний (40 мин) / Сложный (60 мин)
- Toggle "В зачёт / Тренировка"
- Кнопки "Назад" и "Далее"

4. Шаг 3 — "Подтверждение":
- Сводка: имя, сложность, время
- Кнопка "Запустить симуляцию"

### 8.2 Добавить Quick Start кнопки

```tsx
<div className="grid grid-cols-3 gap-3">
  <button onClick={() => quickStart('easy')}>
    <Shield /> Лёгкий <span>20 мин</span>
  </button>
  <button onClick={() => quickStart('medium')}>
    <Zap /> Средний <span>40 мин</span>
  </button>
  <button onClick={() => quickStart('hard')}>
    <Flame /> Сложный <span>60 мин</span>
  </button>
</div>
```

### 8.3 Скрыть технические настройки

- Каналы связи → авто-выбор по сложности
- Стартовые метрики → пресет "Спокойная смена"
- Скорость → скрыть (всегда 1x)
- Только toggle "Ручной выбор кейсов" оставить

### 8.4 Добавить HR-подсказки

```typescript
const HR_TOOLTIPS = {
  easy: "Для первого прохождения. Очевидные ситуации.",
  medium: "Стандартная оценка. Баланс сложности.",
  hard: "Для опытных. Сложные ситуации.",
};
```

---

# БЛОК 9: Переработка результатов

## Задача: Hero + сравнение + план развития

### 9.1 Добавить Hero Result Card

```tsx
<div className="rounded-2xl border-2 p-6 mb-6" style={{ borderColor: verdict.color + '40' }}>
  <div className="flex items-center gap-4">
    <div className="w-16 h-16 rounded-full flex items-center justify-center" 
         style={{ background: verdict.color + '20' }}>
      <Award className="w-8 h-8" style={{ color: verdict.color }} />
    </div>
    <div className="flex-1">
      <h2 style={{ color: verdict.color }}>{verdict.level}</h2>
      <p className="text-sm text-[#94A3B8]">{verdict.description}</p>
    </div>
    <div className="text-3xl font-bold" style={{ color: verdict.color }}>
      {overallAvg}/5
    </div>
  </div>
</div>
```

### 9.2 Добавить Expected vs Actual comparison

```tsx
<div className="space-y-3">
  {compScores.map(c => {
    const expected = 4.0;
    const pct = Math.min(100, (c.avg / 5) * 100);
    const isGood = c.avg >= expected;
    return (
      <div key={c.id} className="flex items-center gap-3">
        <span className="text-xs w-40">{c.name}</span>
        <div className="flex-1 h-3 rounded-full bg-[#0F1923] relative">
          <div className="absolute top-0 bottom-0 w-0.5 bg-[#64748B]" 
               style={{ left: `${(expected/5)*100}%` }} />
          <div className="h-full rounded-full" 
               style={{ width: `${pct}%`, 
                       background: isGood ? '#00C853' : '#FF1744' }} />
        </div>
        <span>{c.avg.toFixed(1)}</span>
      </div>
    );
  })}
</div>
```

### 9.3 Добавить Learning Plan

```tsx
<div className="space-y-3">
  {weaknesses.map((c, i) => (
    <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg 
                                bg-[#FF1744]/5 border border-[#FF1744]/10">
      <div className="w-6 h-6 rounded-full bg-[#FF1744]/20 flex items-center 
                      justify-center flex-shrink-0">
        <span className="text-xs font-bold text-[#FF1744]">{i + 1}</span>
      </div>
      <div>
        <div className="text-sm font-semibold">{c.name}</div>
        <div className="text-xs text-[#94A3B8]">
          Балл: <span className="text-[#FF1744]">{c.avg.toFixed(1)}/5</span>
          {' · '}Цель: <span className="text-[#00C853]">4.0/5</span>
        </div>
      </div>
    </div>
  ))}
</div>
```

---

# БЛОК 10: Админ-панель — скролл

## Задача: Добавить скролл к фиксированному блоку влияния

### 10.1 Обновить ChannelInfluencePanel в `client/src/pages/admin.tsx`

**БЫЛО:**
```tsx
<div className="rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4 
                xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
```

**СТАЛО:**
```tsx
<div className="rounded-xl border border-[#2a3a4e] bg-[#141c2bcc] p-4 
                xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] 
                xl:overflow-y-auto xl:overflow-x-hidden xl:pr-3
                scrollbar-thin">
```

### 10.2 Добавить CSS для scrollbar

**В `client/src/styles/dns-global.css` добавить:**
```css
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgba(240, 78, 35, 0.3) transparent;
}
.scrollbar-thin::-webkit-scrollbar { width: 4px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { 
  background: rgba(240, 78, 35, 0.3); 
  border-radius: 999px; 
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover { 
  background: rgba(240, 78, 35, 0.5); 
}
```

### 10.3 Добавить подсказку

```tsx
<div className="flex items-center justify-center gap-1 py-1 text-[10px] 
                text-[#64748B] xl:hidden">
  <ChevronDown className="h-3 w-3" />
  <span>Прокрутите для подробностей</span>
</div>
```

---

# БЛОК 11: Docker

## Задача: Production-ready Docker конфигурация

### 11.1 Заменить `Dockerfile`

**Содержимое:** [см. готовый файл в `/mnt/agents/dns-sim-temp3/Dockerfile`]

Ключевые изменения:
```dockerfile
# Этап 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Этап 2: Production
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
EXPOSE 5000
USER node
CMD ["dumb-init", "node", "dist/index.cjs"]
```

### 11.2 Заменить `docker-compose.yml`

**Содержимое:** [см. готовый файл в `/mnt/agents/dns-sim-temp3/docker-compose.yml`]

Ключевые изменения:
- Health check
- Resource limits
- Volume mounts для data/
- Environment variables

### 11.3 Создать `nginx.conf`

**Содержимое:** [см. готовый файл в `/mnt/agents/dns-sim-temp3/nginx.conf`]

### 11.4 Создать `.dockerignore`

```
node_modules
.git
dist
uploads
data
.env
```

---

---

# КРИТЕРИИ ПРИЁМКИ

## Общие требования для каждого блока

| Критерий | Описание | Как проверить |
|----------|----------|---------------|
| Код компилируется | `npm run build` выполняется без ошибок | Запустить `npm run build` |
| Нет ошибок в консоли | В браузерной консоли нет красных ошибок | Открыть DevTools → Console |
| TypeScript проверка | `npx tsc --noEmit` без ошибок | Запустить проверку типов |

---

## БЛОК 1: Безопасность — Тесты

### Тест 1.1: Bcrypt хеширование
```bash
# Создать тестовый скрипт test-auth.js:
const { hashPassword, verifyPassword } = require('./dist/server/auth');

(async () => {
  const hash = await hashPassword('TestPassword123!');
  console.log('Hash format valid:', hash.startsWith('$2b$12$'));
  
  const valid = await verifyPassword('TestPassword123!', hash);
  console.log('Valid password:', valid === true);
  
  const invalid = await verifyPassword('WrongPassword', hash);
  console.log('Invalid password:', invalid === false);
  
  // Обратная совместимость scrypt
  const oldHash = 'salt:expectedhash';
  const legacy = await verifyPassword('any', oldHash);
  console.log('Legacy fallback works:', legacy === false); // не падает с ошибкой
})();
```

**Критерий приёмки:**
- [ ] Хеш начинается с `$2b$12$`
- [ ] Верный пароль возвращает `true`
- [ ] Неверный пароль возвращает `false`
- [ ] Старый scrypt-хеш не вызывает ошибку

### Тест 1.2: Session cookie
```bash
# Проверить через curl:
curl -I http://localhost:5000/api/staff/me
# Ожидаем:
# Set-Cookie: dns-simcenter.sid=...; HttpOnly; SameSite=Strict
```

**Критерий приёмки:**
- [ ] Cookie name = `dns-simcenter.sid` (не `connect.sid`)
- [ ] `HttpOnly` присутствует
- [ ] `SameSite=Strict` присутствует
- [ ] `Max-Age=7200` (2 часа)

### Тест 1.3: Helmet headers
```bash
curl -I http://localhost:5000/health
# Ожидаемые заголовки:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: ...
# Referrer-Policy: strict-origin-when-cross-origin
```

**Критерий приёмки:**
- [ ] Все 4 заголовка присутствуют в ответе

---

## БЛОК 2: Rate Limiting — Тесты

### Тест 2.1: Login rate limiting
```bash
# 6 раз отправить неверный логин:
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/staff/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}'
done
# 6-й запрос должен вернуть 429 Too Many Requests
```

**Критерий приёмки:**
- [ ] 5 первых запросов возвращают 401
- [ ] 6-й запрос возвращает 429
- [ ] Заголовок `Retry-After` присутствует

### Тест 2.2: API rate limiting
```bash
# Отправить 101 запрос к /api/simulation-content:
for i in {1..101}; do
  curl http://localhost:5000/api/simulation-content
done
# 101-й должен вернуть 429
```

**Критерий приёмки:**
- [ ] 100 первых запросов возвращают 200
- [ ] 101-й возвращает 429

---

## БЛОК 3: CSRF — Тесты

### Тест 3.1: Блокировка без токена
```bash
# Войти и получить CSRF токен
curl -X POST http://localhost:5000/api/staff/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"пароль"}' \
  -c cookies.txt
# Сохранить csrfToken из ответа

# Отправить POST без CSRF токена:
curl -X POST http://localhost:5000/api/simulation-sessions \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"participantName":"Test"}'
# Ожидаем: 403 CSRF token missing
```

**Критерий приёмки:**
- [ ] Запрос без токена возвращает 403
- [ ] Запрос с правильным токеном возвращает 200

---

## БЛОК 4: Валидация — Тесты

### Тест 4.1: Валидация входных данных
```bash
# Слишком короткий логин:
curl -X POST http://localhost:5000/api/staff/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ab","password":"123"}'
# Ожидаем: 400 Validation error
```

**Критерий приёмки:**
- [ ] Логин < 3 символов → 400
- [ ] Пароль < 8 символов → 400
- [ ] Логин со спецсимволами → 400
- [ ] Корректные данные → 200

---

## БЛОК 5: Backend API — Тесты

### Тест 5.1: Удаление результатов
```bash
# Создать сессию, затем удалить:
curl -X DELETE http://localhost:5000/api/admin/results/1 \
  -b cookies.txt \
  -H "X-CSRF-Token: ТОКЕН"
# Ожидаем: {"message":"Session deleted successfully"}

# Проверить что удалено:
curl http://localhost:5000/api/admin/results \
  -b cookies.txt \
  -H "X-CSRF-Token: ТОКЕН"
# Сессия 1 не должна быть в списке
```

**Критерий приёмки:**
- [ ] DELETE возвращает 200
- [ ] Сессия исчезает из списка
- [ ] Связанные ответы/метрики тоже удалены

### Тест 5.2: Список staff
```bash
curl http://localhost:5000/api/admin/staff \
  -b cookies.txt \
  -H "X-CSRF-Token: ТОКЕН"
# Ожидаем: {"admins":[...],"evaluators":[...]}
```

**Критерий приёмки:**
- [ ] Возвращает объект с admins и evaluators
- [ ] Каждый staff имеет id, username, displayName, isActive, role

### Тест 5.3: Health check
```bash
curl http://localhost:5000/health
# Ожидаем: {"status":"ok","timestamp":"...","uptime":...}
```

**Критерий приёмки:**
- [ ] Возвращает status: "ok"
- [ ] Не требует аутентификации
- [ ] Не под rate limiting

---

## БЛОК 6: Дизайн-система — Тесты

### Тест 6.1: Цвета DNS
```bash
# Открыть сайт в браузере
# Проверить в DevTools → Elements → Computed:
```

**Критерий приёмки:**
- [ ] Основной цвет = `#F04E23`
- [ ] Фон = `#0F1923`
- [ ] Карточки = `#1A2634`
- [ ] Шрифт = `Inter`

---

## БЛОК 7: Мобильная адаптивность — Тесты

### Тест 7.1: Chrome DevTools
1. Открыть сайт
2. F12 → Toggle Device Toolbar
3. Выбрать "iPhone 14 Pro" (393×852)

**Критерий приёмки:**
- [ ] Видны табы (Карта/Сигналы/Метрики)
- [ ] Одна колонка контента
- [ ] Нет горизонтального скролла
- [ ] Кнопки достаточно большие (>44px)

### Тест 7.2: Планшет
1. Выбрать "iPad Air" (820×1180)

**Критерий приёмки:**
- [ ] Две колонки
- [ ] Контент помещается без горизонтального скролла

---

## БЛОК 8: Оценщик — Тесты

### Тест 8.1: Wizard flow
1. Открыть `/assessor`
2. Ввести ФИО участника и оценщика
3. Нажать "Далее"
4. Выбрать сложность
5. Нажать "Далее"
6. Нажать "Запустить"

**Критерий приёмки:**
- [ ] 3 шага с индикатором прогресса
- [ ] Quick Start кнопки работают
- [ ] Технические настройки скрыты
- [ ] Симуляция запускается

---

## БЛОК 9: Результаты — Тесты

### Тест 9.1: Hero card
1. Пройти симуляцию
2. Открыть страницу результатов

**Критерий приёмки:**
- [ ] Видна Hero-карточка с уровнем
- [ ] Градиентные прогресс-бары с пунктирной линией 4.0
- [ ] Learning Plan с рекомендациями
- [ ] Радарная диаграмма с линией ожиданий

---

## БЛОК 10: Админ — Тесты

### Тест 10.1: Скролл блока влияния
1. Открыть админку
2. Выбрать кейс
3. Правый блок должен скроллиться

**Критерий приёмки:**
- [ ] Блок фиксирован при скролле страницы
- [ ] Внутренний скролл работает
- [ ] Скроллбар оранжевый (DNS стиль)
- [ ] На мобильном видна подсказка

---

## БЛОК 11: Docker — Тесты

### Тест 11.1: Сборка
```bash
docker compose build --no-cache
```

**Критерий приёмки:**
- [ ] Сборка завершается без ошибок
- [ ] Контейнер запускается
- [ ] `docker compose ps` показывает status "healthy"
- [ ] `curl http://localhost:5000/health` возвращает ok

---

# ЛОГ ВЕДЕНИЯ РАЗРАБОТКИ

> Проставьте [x] при выполнении задачи и добавьте дату

## Этап 1: Безопасность (КРИТИЧНО)

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 1.1 | Установить bcrypt, helmet, express-rate-limit | [ ] | | `npm install bcrypt helmet express-rate-limit` |
| 1.2 | Заменить `server/auth.ts` на bcrypt-версию | [ ] | | Полный файл готов |
| 1.3 | Обновить `server/staff-storage.ts` — async authenticate + listStaff | [ ] | | Добавить `async`, `listStaff()` |
| 1.4 | Обновить session config в `server/index.ts` — 2ч, strict, secure | [ ] | | maxAge=2ч, sameSite=strict |
| 1.5 | Добавить SESSION_SECRET защиту | [ ] | | Убрать fallback, добавить генерацию |
| 1.6 | Добавить Helmet с CSP | [ ] | | Полный конфиг в плане |
| 1.7 | Добавить X-XSS-Protection + убрать X-Powered-By | [ ] | | middleware с заголовками |
| 1.8 | Ограничить JSON body до 10MB | [ ] | | `express.json({ limit: "10mb" })` |
| 1.9 | **ТЕСТ**: Bcrypt хеширование работает | [ ] | | См. Тест 1.1 |
| 1.10 | **ТЕСТ**: Session cookie корректен | [ ] | | См. Тест 1.2 |
| 1.11 | **ТЕСТ**: Helmet headers присутствуют | [ ] | | См. Тест 1.3 |

## Этап 2: Rate Limiting

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 2.1 | Создать `server/middleware/rate-limiter.ts` | [ ] | | Готовый файл |
| 2.2 | Подключить apiRateLimiter в `server/index.ts` | [ ] | | `app.use("/api", ...)` |
| 2.3 | Применить loginRateLimiter к `/api/staff/login` | [ ] | | + recordFailedLogin |
| 2.4 | **ТЕСТ**: Login blocking после 5 попыток | [ ] | | См. Тест 2.1 |
| 2.5 | **ТЕСТ**: API limiting после 100 запросов | [ ] | | См. Тест 2.2 |

## Этап 3: CSRF Защита

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 3.1 | Создать `server/middleware/csrf.ts` | [ ] | | Готовый файл |
| 3.2 | Подключить csrfProtection в `server/index.ts` | [ ] | | `app.use(csrfProtection)` |
| 3.3 | Выдавать CSRF токен при логине | [ ] | | `regenerateCsrfToken(req)` |
| 3.4 | Расширить типы сессии (csrfToken) | [ ] | | declare module |
| 3.5 | **ТЕСТ**: Блокировка без токена | [ ] | | См. Тест 3.1 |

## Этап 4: Валидация входных данных

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 4.1 | Создать `server/middleware/validation.ts` | [ ] | | Готовый файл |
| 4.2 | Добавить схемы для login, sessions, answers | [ ] | | Все схемы в файле |
| 4.3 | Применить validateBody к login endpoint | [ ] | | `validateBody(staffLoginBodySchema)` |
| 4.4 | Расширить Express Request типы | [ ] | | validatedBody, validatedQuery |
| 4.5 | **ТЕСТ**: Невалидные данные отклоняются | [ ] | | См. Тест 4.1 |

## Этап 5: Backend API

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 5.1 | Добавить `deleteSessionResult()` в session-storage | [ ] | | Транзакция, 4 таблицы |
| 5.2 | Добавить DELETE `/api/admin/results/:id` | [ ] | | requireAdmin + валидация |
| 5.3 | Добавить GET `/api/admin/staff` | [ ] | | requireAdmin |
| 5.4 | Добавить GET `/health` | [ ] | | Без auth, без rate limit |
| 5.5 | Убрать JSON экспорт (если есть) | [ ] | | Оставить только PDF/XLSX |
| 5.6 | **ТЕСТ**: Удаление работает | [ ] | | См. Тест 5.1 |
| 5.7 | **ТЕСТ**: Список staff возвращает данные | [ ] | | См. Тест 5.2 |
| 5.8 | **ТЕСТ**: Health check доступен | [ ] | | См. Тест 5.3 |

## Этап 6: Дизайн-система DNS

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 6.1 | Создать `client/src/styles/dns-theme.ts` | [ ] | | Цвета, типографика, анимации |
| 6.2 | Создать `client/src/styles/dns-global.css` | [ ] | | CSS переменные, scrollbar |
| 6.3 | Подключить шрифты в `client/index.html` | [ ] | | Google Fonts: Inter, JetBrains Mono |
| 6.4 | **ТЕСТ**: Цвета DNS применяются | [ ] | | Основной = #F04E23 |

## Этап 7: Мобильная адаптивность

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 7.1 | Добавить `useState` для mobileTab в simulation.tsx | [ ] | | `'map' \| 'signals' \| 'metrics'` |
| 7.2 | Добавить импорт иконок Map, BarChart3, Radio | [ ] | | lucide-react |
| 7.3 | Обновить grid layout (1/2/3 колонки) | [ ] | | md: 2col, xl: 3col |
| 7.4 | Добавить мобильный таб-бар | [ ] | | Виден только <768px |
| 7.5 | Скрывать панели по mobileTab | [ ] | | `hidden md:block` |
| 7.6 | Адаптировать header (padding, скрыть лейблы) | [ ] | | responsive классы |
| 7.7 | **ТЕСТ**: iPhone 14 Pro — один столбец | [ ] | | Chrome DevTools |
| 7.8 | **ТЕСТ**: iPad Air — два столбца | [ ] | | Chrome DevTools |

## Этап 8: Упрощение оценщика

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 8.1 | Добавить wizardStep state | [ ] | | 1, 2, 3 |
| 8.2 | Шаг 1: форма ФИО участника + оценщика | [ ] | | Валидация обязательных полей |
| 8.3 | Шаг 2: выбор сложности (3 карточки) | [ ] | | Лёгкий/Средний/Сложный |
| 8.4 | Шаг 3: подтверждение + запуск | [ ] | | Сводка параметров |
| 8.5 | Добавить Quick Start кнопки | [ ] | | 1 клик — запуск |
| 8.6 | Скрыть технические настройки | [ ] | | Каналы, метрики, скорость |
| 8.7 | Добавить HR-подсказки (tooltips) | [ ] | | Описание сложности |
| 8.8 | **ТЕСТ**: Wizard flow работает | [ ] | | См. Тест 8.1 |

## Этап 9: Переработка результатов

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 9.1 | Добавить Hero Result Card | [ ] | | Уровень, балл, иконка |
| 9.2 | Добавить Expected vs Actual прогресс-бары | [ ] | | Пунктирная линия 4.0 |
| 9.3 | Добавить Learning Plan | [ ] | | Слабые компетенции |
| 9.4 | Добавить getLearningRecommendation() | [ ] | | 14 рекомендаций |
| 9.5 | Улучшить радарную диаграмму | [ ] | | Линия ожиданий |
| 9.6 | **ТЕСТ**: Hero card отображается | [ ] | | См. Тест 9.1 |

## Этап 10: Админ — скролл

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 10.1 | Обновить классы ChannelInfluencePanel | [ ] | | + scrollbar-thin |
| 10.2 | Добавить CSS .scrollbar-thin в dns-global.css | [ ] | | 4px, оранжевый |
| 10.3 | Добавить подсказку прокрутки | [ ] | | xl:hidden |
| 10.4 | **ТЕСТ**: Скролл работает | [ ] | | См. Тест 10.1 |

## Этап 11: Docker

| № | Задача | Статус | Дата | Примечания |
|---|--------|--------|------|------------|
| 11.1 | Заменить `Dockerfile` (multi-stage) | [ ] | | builder + production |
| 11.2 | Заменить `docker-compose.yml` | [ ] | | health check, limits |
| 11.3 | Создать `nginx.conf` | [ ] | | SSL, HTTP/2 |
| 11.4 | Создать `.dockerignore` | [ ] | | node_modules, .git |
| 11.5 | **ТЕСТ**: `docker compose build` успешно | [ ] | | См. Тест 11.1 |
| 11.6 | **ТЕСТ**: Контейнер healthy | [ ] | | `docker compose ps` |

---

# ИТОГОВЫЙ ЧЕКЛИСТ ВНЕДРЕНИЯ

| Блок | Название | Задач | Тестов | Приоритет |
|------|----------|-------|--------|-----------|
| 1 | Безопасность (bcrypt, helmet, sessions) | 11 | 3 | **КРИТИЧЕСКИЙ** |
| 2 | Rate Limiting | 5 | 2 | **КРИТИЧЕСКИЙ** |
| 3 | CSRF Защита | 5 | 1 | **КРИТИЧЕСКИЙ** |
| 4 | Валидация входных данных | 5 | 1 | **КРИТИЧЕСКИЙ** |
| 5 | Backend API (delete, staff list, health) | 8 | 3 | Высокий |
| 6 | Дизайн-система DNS | 4 | 1 | Средний |
| 7 | Мобильная адаптивность | 8 | 2 | Высокий |
| 8 | Упрощение оценщика | 8 | 1 | Высокий |
| 9 | Переработка результатов | 6 | 1 | Средний |
| 10 | Админ — скролл | 4 | 1 | Низкий |
| 11 | Docker | 6 | 2 | Средний |
| **ИТОГО** | | **80** | **18** | |

---

> **Рекомендуемый порядок внедрения:**
> 1. Блоки 1-4 (Безопасность) — **первыми и вместе**, т.к. зависят друг от друга
> 2. Блок 5 (Backend API) — после безопасности
> 3. Блоки 6-10 (Frontend) — параллельно, независимо друг от друга
> 4. Блок 11 (Docker) — последним
