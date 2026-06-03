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

## 5. Структура БД (SQLite)
```sql
CREATE TABLE content (
    key TEXT PRIMARY KEY,    -- hero_title, about_p1, service_construction и т.д.
    value TEXT NOT NULL,     -- текст или путь к файлу
    type TEXT NOT NULL,      -- 'text' | 'image'
    section TEXT,            -- hero, about, services...
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

## 7. План действий

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

### Этап 5 — Запуск на ПК (0.5 дня)
- [ ] `npm start` запускает сервер на `localhost:3000`
- [ ] ngrok для webhook Telegram (временный публичный URL)
- [ ] Проверка: бот редактирует → сайт обновляется

### Этап 6 — Перенос на сервер (после покупки)
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
    "dotenv": "^16.3.1"
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

## Следующий шаг
Когда будешь готов — скажи, и я начну писать бэкенд: `server.js`, `db.js`, API и бота.
