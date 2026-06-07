# Техническое задание: Telegram-админка для сайта INTEGRA KOTOVA

## 1. Цель
Сделать сайт динамическим: весь текст и изображения загружаются из базы данных и могут редактироваться через Telegram-бота.

## 2. Стек
| Компонент | Технология |
|-----------|------------|
| Frontend | **Astro** + TypeScript |
| Backend | Node.js + Express |
| База данных | SQLite (файл `data.db`) |
| Telegram Bot | `node-telegram-bot-api` |
| Загрузка файлов | Multer |
| Хостинг (этап 1) | Локальный ПК |
| Хостинг (этап 2) | VPS + домен |

## 2.1 Почему Astro

После анализа проекта (5400+ строк, 10 секций, слайдеры, форма, мультиязычность, динамический контент) выбор сделан в пользу **Astro**:

| Критерий | Astro | Next.js | SvelteKit |
|----------|-------|---------|-----------|
| **Контентные сайты** | ✅ Создан для этого | Перебор — тянет React | Хорош, но не специализация |
| **Мультиязычность** | ✅ Из коробки (`/ru/`, `/en/`, `/hy/`) | Костыли | Есть, но сложнее |
| **TypeScript** | ✅ Из коробки, без настройки | Есть | Есть |
| **Минимум JS** | ✅ 0 JS по умолч. — только где нужно | ~100KB React на клиент | ~20KB Svelte runtime |
| **SEO** | ✅ Идеальный — HTML на сервере | Хороший | Хороший |
| **Скорость** | ✅ Top-1 по performance | Хороший | Хороший |
| **Простота** | ✅ Синтаксис ≈ HTML | JSX + хуки | Своё синтаксис |
| **Интерактивность** | Острова (`<Counter client:load />`) | Встроенная | Встроенная |
| **Динам. контент** | ✅ `fetch` при сборке или SSR | SSR/SSG | SSR/SSG |

### Почему НЕ Next.js
- Лендинг не требует React — тянет 100KB лишнего JS
- Сложнее поддерживать (React-опыт нужен)
- Больше boilerplate для простых задач

### Почему НЕ SvelteKit
- Отличный фреймворк, но Astro **специально заточен** под контентные сайты
- Если бы нужно было веб-приложение (личный кабинет, фильтры) — выбрал бы SvelteKit

### Как выглядит миграция

**Сейчас (HTML):**
```html
<section class="hero">
  <h1>Ваш капитал</h1>
</section>
```

**Будет (Astro + TypeScript):**
```astro
---
const content = await fetch('http://localhost:3000/api/content').then(r => r.json());
---
<section class="hero">
  <h1>{content.hero_title}</h1>
</section>
```

### Что остаётся 1:1
- Весь CSS (`style.css` переносится целиком)
- Все анимации и эффекты (scroll-trigger, parallax, glow)
- Все шрифты и картинки
- Логика слайдеров (как "острова" интерактивности)

### Что станет проще
- **Мультиязычность**: `src/pages/[lang]/index.astro` вместо `translations.js`
- **Динамический контент**: серверный `fetch` при сборке или SSR
- **TypeScript**: из коробки, без `tsconfig.json`
- **SEO**: `<SEO title={content.hero_title} />` компонент
- **Сборка**: `npm run build` → статические HTML-файлы

## 3. Архитектура
```
┌─────────────┐      HTTP/REST      ┌─────────────┐      SQL       ┌─────────┐
│   Browser   │ ◄─────────────────► │  Express    │ ◄────────────► │ SQLite  │
│  (index.js) │                     │   Server    │                │  .db    │
└─────────────┘                     └──────┬──────┘                └─────────┘
                                           │
                                    Webhook │
                                           ▼
                                    ┌─────────────┐
                                    │  Telegram   │
                                    │    Bot      │
                                    └─────────────┘
```

## 4. Эндпоинты API
| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/content` | Получить весь контент (тексты + URL фото) |
| `PUT` | `/api/content/:key` | Обновить текст по ключу |
| `POST`| `/api/upload` | Загрузить фото, вернуть URL |
| `POST`| `/api/track` | Записать событие аналитики |
| `GET` | `/api/stats` | Получить статистику (за период) |
| `POST`| `/api/ask` | Задать вопрос AI-ассистенту |

## 5. Структура БД (SQLite)
```sql
-- Контент сайта
CREATE TABLE content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL,      -- 'text' | 'image'
    section TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Аналитика: посещения
CREATE TABLE visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    referrer TEXT,
    country TEXT,
    city TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Аналитика: события (скроллы, клики, секции)
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,     -- 'scroll', 'click', 'section_view', 'time_spent'
    section TEXT,                 -- hero, about, projects...
    element TEXT,                 -- .cta-button, .service-card, #contacts...
    value REAL,                   -- scroll %, time in seconds, click count
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Аналитика: источники трафика
CREATE TABLE sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI: лог запросов
CREATE TABLE ai_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 6. Команды Telegram-бота
| Команда | Аргументы | Действие |
|---------|-----------|----------|
| `/start` | — | Приветствие + список команд |
| `/edit <key> <текст>` | `hero_title Новый заголовок` | Обновить текст |
| `/upload <key>` | ответом на фото | Загрузить фото для блока |
| `/list` | — | Список всех ключей |
| `/get <key>` | — | Показать текущее значение |
| `/sections` | — | Список секций |
| `/preview` | — | Ссылка на локальный сайт |

### Команды аналитики
| Команда | Аргументы | Действие |
|---------|-----------|----------|
| `/stats` | `today` / `week` / `month` | Общая статистика |
| `/visitors` | — | Уникальные посетители |
| `/heatmap` | `<section>` | Где кликают в секции |
| `/scroll` | — | Средний скролл по секциям |
| `/sources` | — | Источники трафика |
| `/popular` | — | Самые просматриваемые секции |

### Команды AI-ассистента (OpenAI GPT-4o-mini)
| Команда | Аргументы | Действие |
|---------|-----------|----------|
| `/ai` | любой вопрос | Общий вопрос с контекстом аналитики |
| `/insights` | `today` / `week` / `month` | AI-анализ: что улучшить на сайте |
| `/suggest` | — | AI-рекомендации по контенту |
| `/translate` | `<key> <язык>` | Перевести текст через AI |
| `/write` | `<key> <тема>` | Сгенерировать текст (описание проекта, SEO-title и т.д.) |

### AI редактирует сайт напрямую
| Команда | Аргументы | Действие |
|---------|-----------|----------|
| `/ai` | `"Сделай описание Projects более продающим"` | AI генерирует текст → автоматически сохраняет в БД |
| `/rewrite` | `<key>` | AI переписывает текст, сохраняет новый вариант |
| `/fix` | `<key>` | AI анализирует текст → исправляет ошибки, сохраняет |

## 7. Как работает AI

### Промпт (формируется автоматически)
```
Ты — AI-ассистент для администратора сайта INTEGRA KOTOVA.
Контекст аналитики за период:
- Посетителей: 145
- Средний скролл: 62%
- Популярная секция: Projects (89 просмотров)
- Больше всего кликов: CTA "Связаться" (34 клика)
- Проблемная зона: 58% не доходят до Contacts

Вопрос администратора: "Что улучшить?"
```

### Пример ответа AI
```
📊 Анализ за сегодня:

✅ Хорошо:
• Projects — самая популярная секция (89 просмотров)
• CTA "Связаться" работает (34 клика)

⚠️ Проблемы:
• 58% посетителей не доходят до Contacts
• Средний скролл 62% — люди не доскролливают

💡 Рекомендации:
1. Добавьте CTA-кнопку в секцию Projects
2. Сократите описание в About — возможно, оно слишком длинное
3. Добавьте фиксированный "Заказать звонок" внизу экрана
```

## 8. JS-трекер на фронтенде
Мини-скрипт (~80 строк), встроенный в `index.html`:
```javascript
// Отправляет события на /api/track
// - page_open         → при открытии
// - section_view      → когда секция появилась в viewport
// - click             → клики по кнопкам/ссылкам
// - scroll            → глубина скролла (25%, 50%, 75%, 100%)
// - time_spent        → время на каждой секции (5s, 10s, 30s...)
```

Пример отправки:
```javascript
fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        session_id: 'abc123',
        event_type: 'section_view',
        section: 'projects',
        element: null,
        value: null
    })
});
```

## 8. План действий

### Этап 1 — Подготовка (0.5 дня)
- [ ] Создать `package.json` и установить зависимости
- [ ] Создать `.env` с токеном бота
- [ ] Инициализировать SQLite и наполнить начальными данными из текущего `index.html`
- [ ] Написать `server.js` с Express

### Этап 2 — API (0.5 дня)
- [ ] `GET /api/content` — выдача JSON со всем контентом
- [ ] `PUT /api/content/:key` — обновление текста
- [ ] `POST /api/upload` — приём файла через Multer

### Этап 3 — Telegram Bot (1 день)
- [ ] Подключение `node-telegram-bot-api`
- [ ] Webhook или polling
- [ ] Обработчики команд `/edit`, `/upload`, `/list`
- [ ] Защита: только `ADMIN_CHAT_ID` может редактировать

### Этап 4 — Frontend (0.5 дня)
- [ ] Заменить статический HTML на динамический рендер через `fetch('/api/content')`
- [ ] Сохранить CSS-анимации и структуру
- [ ] Preloader: показывать пока загружается контент

### Этап 5 — Аналитика (1 день)
- [ ] JS-трекер: `track.js` — отслеживание скролла, кликов, секций
- [ ] `POST /api/track` — приём и сохранение событий
- [ ] `GET /api/stats` — агрегация данных
- [ ] Команды бота: `/stats`, `/visitors`, `/heatmap`, `/scroll`
- [ ] Dashboard в боте: сводка за сегодня / неделю / месяц

### Этап 6 — AI-ассистент (1 день)
- [ ] Подключить `openai` SDK
- [ ] `POST /api/ask` — отправка промпта + получение ответа
- [ ] Сервис `ai.js` — формирование контекста из аналитики
- [ ] Команды бота: `/ai`, `/insights`, `/suggest`, `/translate`, `/write`
- [ ] Сохранение диалогов в `ai_logs`

### Этап 7 — Запуск на ПК (0.5 дня)
- [ ] `npm start` запускает сервер на `localhost:3000`
- [ ] ngrok для webhook Telegram (временный публичный URL)
- [ ] Проверка: бот редактирует → сайт обновляется

### Этап 8 — Astro-фронтенд (переписывание сайта)
- [ ] `npm create astro@latest` — новый проект
- [ ] Перенос CSS 1:1 в `src/styles/global.css`
- [ ] Создать компоненты: `Hero.astro`, `About.astro`, `Projects.astro`, `Services.astro`, `Supply.astro`, `Advantages.astro`, `Tourism.astro`, `Partners.astro`, `Contacts.astro`, `Footer.astro`
- [ ] Мультиязычность: `src/pages/[lang]/index.astro` (`ru`, `en`, `hy`)
- [ ] Динамический контент: `const content = await fetch('http://localhost:3000/api/content')`
- [ ] Интерактивные острова: `<Slider client:load />`, `<Form client:load />`
- [ ] SEO-компонент: `<SEO title={content.hero_title} />`
- [ ] Сборка: `npm run build` → `dist/` (статические HTML)

### Этап 9 — TypeScript типизация (Astro + Backend)
- [ ] `tsconfig.json` для Astro (из коробки) + отдельный для backend
- [ ] Типы для API: `ContentItem`, `Visit`, `Event`, `AIResponse`
- [ ] Типы для запросов: `TrackBody`, `EditBody`, `AskBody`
- [ ] Типы для AI: `PromptContext`, `AIResponse`
- [ ] Переименовать `backend/*.js` → `*.ts`

### Этап 10 — Перенос на сервер (после покупки)
- [ ] Купить VPS + домен
- [ ] Установить Node.js + PM2
- [ ] Настроить Nginx (reverse proxy + SSL)
- [ ] Перенести БД и uploads
- [ ] Постоянный webhook

## 8. Зависимости (package.json)

### Frontend (Astro)
```json
{
  "dependencies": {
    "astro": "^4.0.0",
    "typescript": "^5.3.0",
    "@astrojs/ts-plugin": "^1.3.0"
  }
}
```

### Backend (Node.js + Express)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "node-telegram-bot-api": "^0.63.0",
    "multer": "^1.4.5-lts.1",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "geoip-lite": "^1.4.7",
    "uuid": "^9.0.0",
    "openai": "^4.28.0"
  }
}
```

## 9. Переменные окружения (.env)
```env
PORT=3000
BOT_TOKEN=your_telegram_bot_token_from_botfather
ADMIN_CHAT_ID=your_telegram_chat_id
OPENAI_API_KEY=sk-xxx...xxx
UPLOAD_DIR=./uploads
DB_PATH=./data.db
```

## 10. Пример работы

### Редактирование контента
1. Открываешь сайт → фронт делает `fetch('/api/content')` → рендерит текст и фото
2. Пишешь боту: `/edit hero_title "Ваш капитал — в надёжных руках"`
3. Бот обновляет `data.db`
4. Обновляешь страницу — текст изменился

### AI-анализ
```
Ты: /insights today
Бот: 📊 Анализ за сегодня:

✅ Хорошо:
• Projects — самая популярная секция (89 просмотров)
• CTA "Связаться" работает (34 клика)

⚠️ Проблемы:
• 58% посетителей не доходят до Contacts
• Средний скролл 62%

💡 Рекомендации:
1. Добавьте CTA-кнопку в секцию Projects
2. Сократите описание в About
```

### AI редактирует сайт
```
Ты: /ai "Сделай описание Projects более продающим"
Бот: 🤖 AI написал новый текст:

"26 премиальных вилл на Пхукете с панорамным
видом на океан. ROI от 12% годовых."

Сохранить? [Да] / [Нет]

Ты: Да
Бот: ✅ Сохранено в `project_loc_agclub`
```

### AI и фото
```
Ты: /ai "Какое фото лучше для hero?"
Бот: 🤖 Рекомендация:

Сейчас: темный офисный небоскрёб
Проблема: не передаёт vibe компании

Рекомендую:
• Вилла на Пхукете на закате (роскошь + туризм)
• Или панорама Еревана + Артashat (локации)
• Или минималистичный интерьер (дизайн)

Загрузите фото через /upload hero_bg
```

---

## 11. Структура проекта (Astro + Backend)

### Полная структура
```
integrakotova/
├── frontend/                 # Astro проект
│   ├── src/
│   │   ├── components/
│   │   │   ├── Hero.astro
│   │   │   ├── About.astro
│   │   │   ├── Projects.astro
│   │   │   ├── Services.astro
│   │   │   ├── Supply.astro
│   │   │   ├── Advantages.astro
│   │   │   ├── Tourism.astro
│   │   │   ├── Partners.astro
│   │   │   ├── Contacts.astro
│   │   │   ├── Footer.astro
│   │   │   └── SEO.astro
│   │   ├── islands/          # Интерактивные компоненты
│   │   │   ├── Slider.tsx    # Слайдеры (React/Preact)
│   │   │   ├── Form.tsx      # Контактная форма
│   │   │   └── Track.tsx     # Аналитика-трекер
│   │   ├── layouts/
│   │   │   └── Base.astro    # Общий layout (head, nav, footer)
│   │   ├── pages/
│   │   │   └── [lang]/
│   │   │       └── index.astro   # /ru/, /en/, /hy/
│   │   ├── styles/
│   │   │   └── global.css    # Весь CSS из style.css
│   │   └── types/
│   │       └── api.ts        # Типы: ContentItem, Visit, Event
│   ├── astro.config.mjs
│   ├── package.json          # astro, typescript
│   └── tsconfig.json         # Из коробки
│
├── backend/                  # Node.js API
│   ├── config/
│   │   └── index.js          # env + constants
│   ├── db/
│   │   ├── index.js          # SQLite connection
│   │   └── migrations.js     # CREATE TABLE
│   ├── middleware/
│   │   ├── auth.js           # ADMIN_CHAT_ID проверка
│   │   └── upload.js         # Multer
│   ├── routes/
│   │   ├── api.js            # /api/content, /api/upload
│   │   ├── stats.js          # /api/stats, /api/track
│   │   ├── ai.js             # /api/ask
│   │   └── bot.js            # Telegram webhook handlers
│   ├── services/
│   │   ├── content.js        # CRUD контента
│   │   ├── analytics.js      # агрегация статистики
│   │   └── ai.js             # OpenAI API + prompts
│   ├── utils/
│   │   └── helpers.js        # formatDate, sanitize и т.д.
│   ├── server.js             # Express entry point
│   └── package.json          # express, sqlite3, openai
│
└── .env                      # Общий env для обеих частей
```

### Принципы для Astro-фронтенда
1. **Компоненты = секции** — каждая секция сайта = отдельный `.astro` файл
2. **0 JS по умолчанию** — вся интерактивность только в `islands/` (`client:load`)
3. **CSS 1:1** — `global.css` переносится без изменений, Astro сам оптимизирует
4. **Динамика на сервере** — `fetch` к API в frontmatter (`---`) при сборке
5. **Мультиязычность через роутинг** — `src/pages/[lang]/index.astro` + `getStaticPaths()`

### Принципы для Backend
1. **Модульная структура** — каждый сервис в отдельном файле
2. **JSDoc типы** — уже сейчас для лёгкой миграции на TS
3. **Separate concerns** — `routes` принимают HTTP, `services` — бизнес-логика, `db` — SQL

### Что изменится при миграции на TS
```diff
- // backend/services/content.js
- function getContent(key) { ... }

+ // backend/services/content.ts
+ interface ContentItem {
+   key: string;
+   value: string;
+   type: 'text' | 'image';
+   section?: string;
+ }
+ function getContent(key: string): Promise<ContentItem> { ... }
```

Миграция backend на TypeScript займёт **1–2 часа** — просто добавить `.ts` + типы.  
Astro уже с TypeScript из коробки.

## 12. Объём кода (оценка)

### Backend (Node.js + Express)
| Компонент | База | +Аналитика | +AI |
|-----------|------|------------|-----|
| `server.js` + `config.js` | ~80 | ~100 | ~120 |
| `db.js` + миграции | ~50 | ~120 | ~140 |
| `routes/api.js` | ~120 | ~180 | ~220 |
| `routes/bot.js` | ~200 | ~350 | ~500 |
| `routes/stats.js` | — | ~150 | ~150 |
| `routes/ai.js` | — | — | ~100 |
| `middleware/upload.js` | ~40 | ~40 | ~40 |
| `services/content.js` | ~80 | ~80 | ~80 |
| `services/analytics.js` | — | ~200 | ~200 |
| `services/ai.js` | — | — | ~180 |
| `public/track.js` | — | ~80 | ~80 |
| **Backend итого** | **~570** | **~1300** | **~1750** |

### Frontend (Astro + TypeScript)
| Компонент | Строк | Описание |
|-----------|-------|----------|
| Компоненты секций (10 шт) | ~400 | Hero.astro, About.astro, Projects.astro... |
| Layouts + SEO | ~80 | Base.astro, SEO.astro |
| Islands (интерактив) | ~200 | Slider.tsx, Form.tsx, Track.tsx |
| Стили | ~1 | global.css переносится 1:1 |
| Роутинг мультиязычности | ~50 | [lang]/index.astro + getStaticPaths |
| Типы API | ~50 | api.ts — ContentItem, Visit, Event |
| **Frontend итого** | **~780** | |

### Полный проект
| | Backend | Frontend | **Всего** |
|---|---------|----------|-----------|
| База (контент + бот) | ~570 | ~780 | **~1350** |
| +Аналитика | ~1300 | ~780 | **~2080** |
| +AI | **~1750** | ~780 | **~2530** |

---

## Следующий шаг

**Старт:** Создать Astro-проект (`npm create astro@latest`) и backend (`npm init`).

**Порядок работы:**
1. **Этап 1-3:** Backend — `server.js`, `db.js`, API, бот (основа)
2. **Этап 4-5:** Frontend — Astro компоненты, мультиязычность, динамический контент
3. **Этап 6:** Аналитика — трекер, статистика, команды бота
4. **Этап 7:** AI — OpenAI, анализ, редактирование
5. **Этап 8:** TypeScript типизация backend
6. **Этап 9-10:** Тесты, деплой на VPS

Когда будешь готов — скажи **«старт»**, и я начну писать код:
- `npm create astro@latest` для frontend
- `npm init` + Express для backend
- Первый commit: базовая структура обоих частей
