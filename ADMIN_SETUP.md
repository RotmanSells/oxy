# Техническое задание: Telegram-админка для сайта INTEGRA KOTOVA

## 1. Цель
Сделать сайт динамическим: весь текст и изображения загружаются из базы данных и могут редактироваться через Telegram-бота.

## 2. Стек
| Компонент | Технология |
|-----------|------------|
| Backend | Node.js + Express |
| База данных | SQLite (файл `data.db`) |
| Telegram Bot | `node-telegram-bot-api` |
| Загрузка файлов | Multer |
| Фронтенд | Vanilla JS (`fetch` к API) |
| Хостинг (этап 1) | Локальный ПК |
| Хостинг (этап 2) | VPS + домен |

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

## 7. JS-трекер на фронтенде
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

### Этап 6 — Запуск на ПК (0.5 дня)
- [ ] `npm start` запускает сервер на `localhost:3000`
- [ ] ngrok для webhook Telegram (временный публичный URL)
- [ ] Проверка: бот редактирует → сайт обновляется

### Этап 7 — Перенос на сервер (после покупки)
- [ ] Купить VPS + домен
- [ ] Установить Node.js + PM2
- [ ] Настроить Nginx (reverse proxy + SSL)
- [ ] Перенести БД и uploads
- [ ] Постоянный webhook

## 8. Зависимости (package.json)
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
    "uuid": "^9.0.0"
  }
}
```

## 9. Переменные окружения (.env)
```env
PORT=3000
BOT_TOKEN=your_telegram_bot_token_from_botfather
ADMIN_CHAT_ID=your_telegram_chat_id
UPLOAD_DIR=./uploads
DB_PATH=./data.db
```

## 10. Пример работы
1. Открываешь сайт → фронт делает `fetch('/api/content')` → рендерит текст и фото
2. Пишешь боту: `/edit hero_title "Ваш капитал — в надёжных руках"`
3. Бот обновляет `data.db`
4. Обновляешь страницу — текст изменился

---

## 10. Объём кода (оценка)
| Компонент | Без аналитики | С аналитикой |
|-----------|---------------|--------------|
| `server.js` + `config.js` | ~80 | ~100 |
| `db.js` + миграции | ~50 | ~120 |
| `routes/api.js` | ~120 | ~180 |
| `routes/bot.js` | ~200 | ~350 |
| `routes/stats.js` | — | ~150 |
| `middleware/upload.js` | ~40 | ~40 |
| `services/content.js` | ~80 | ~80 |
| `services/analytics.js` | — | ~200 |
| `public/track.js` | — | ~80 |
| **Итого** | **~570** | **~1300** |

Аналитика добавляет примерно **+730 строк** (~65% кода).

---

## Следующий шаг
Когда будешь готов — скажи, и я начну писать бэкенд: `server.js`, `db.js`, API, бота **и аналитику**.

По умолчанию начну с **основы** (контент + бот), аналитику добавлю отдельным этапом.
