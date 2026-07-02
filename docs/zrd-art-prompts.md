# ЗРД — пакет промптов для генерации арта (3D-board)

Цель — поднять 3D-сцену (`ZrdBoard3D`) к уровню твоего эталонного рендера. Генерируешь ассеты
(Midjourney / др.), кладёшь в `client/src/assets/brand/zrd/`, я подключаю как текстуры/спрайты.

**Общие требования:** PNG (с альфой где указано) или JPG; квадрат для текстур, 16:9/широкое для
карты; без текста на изображении (надписи рисует UI); единый стиль — корпоративный DNS
(оранжевый #FF6B00 / графит / неон), премиальный, кинематографичный свет.

---

## 1. Карта-стол Дивизиона Урал (ГЛАВНОЕ) — текстура поверхности стола
Назначение: натянуть на 3D-плоскость стола (вместо текущего тёмного материала) — даст «остров с
городами», как на твоём макете. Топ-даун, без перспективы (перспективу даёт 3D-камера).
- Файл: `map_ural_division_topdown.png` (или .jpg), **4096×2304** (16:9), без альфы.
- Промпт (MJ):
  > top-down game board map of a stylized Ural region divided into 4 territories, miniature 3D
  > isometric cities with tiny buildings, rivers, forests, roads connecting towns, dark teal water,
  > warm orange city glow, premium board-game render, dramatic studio lighting, high detail,
  > clean negative space for tokens, DNS corporate orange and graphite palette, no text --ar 16:9 --style raw --v 6
- Вариант «бесшовная подложка» (если нужен фон-стол вокруг карты): дерево/графит-металл,
  `table_surface.jpg` 2048×2048 tileable.

## 2. Подиум/зона РРС (4 шт. или 1 универсальный) — текстура верхней грани
Назначение: верх 3D-подиума РРС. Можно 1 нейтральный + красить акцентом в коде.
- Файл: `rrs_podium_top.png` 1024×1024, можно с лёгкой альфой по краю.
- Промпт:
  > circular tech podium platform top texture, brushed metal with subtle neon edge ring, dark,
  > premium sci-fi board game piece, centered, top view, no text --ar 1:1 --style raw --v 6

## 3. Карты-проекты — рамка + превью (для колод Логистика/Проекты/Сотрудники)
Назначение: лицо игровой карты (сейчас плоский чип). Нужны: 1 универсальная рамка + по 1 фон-арту
на категорию (или на каждую из 15 карт — по желанию).
- Рамка: `card_frame.png` 512×720, **с альфой** (прозрачная середина под превью).
  > premium trading card frame, dark graphite with orange neon accents, ornate but clean corners,
  > transparent center, board game quality, no text --ar 5:7 --style raw --v 6
- Превью по категориям (512×400, без альфы):
  - Логистика: `art_logistics.jpg` — `DNS warehouse, delivery trucks, logistics hub, isometric miniature, warm light`
  - Проекты: `art_projects.jpg` — `retail innovation, flagship electronics store, marketing campaign, neon`
  - Сотрудники: `art_staff.jpg` — `friendly retail team, training, teal accent, miniature 3D`

## 4. Маскоты-токены РРС
Уже есть зелёные пришельцы (`assets/brand/heroes/dnstech_alien_*`). Если нужны фигурки «на
подставке» для 3D-биллборда:
- Файлы: `mascot_*.png` 768×1024, **с альфой**, фронтальная поза, мягкая тень-подставка.
  > cute green alien mascot figurine on a round stand, DNS orange accents, front view, soft studio
  > shadow, transparent background, premium collectible toy render, no text --ar 3:4 --style raw --v 6

## 5. Текстуры материалов (для премиум-панелей/стола)
- `wood_dark.jpg` 2048² tileable — тёмное дерево стола.
- `metal_brushed.jpg` 2048² tileable — рамки панелей.
- `glass_panel.png` — стеклянная панель HUD (с альфой), лёгкие блики.

---

## Куда класть и как подключаю
1. Складывай в `client/src/assets/brand/zrd/` (создам папку).
2. Дай знать имена файлов — я: (а) карту натяну на 3D-стол; (б) подиумы/токены/материалы подключу;
   (в) карты-чипы заменю на рамку+превью.
3. Поэтапно: сначала **карта-стол (п.1)** — даёт максимальный скачок к виду рендера.

> Приоритет: **п.1 (карта)** → п.4 (маскоты-фигурки) → п.3 (карты) → п.5 (материалы).
> Связано: `docs/zrd-wiki/`, память `zrd-board-mockup-target`.
