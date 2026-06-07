# INTEGRA KOTOVA API

TypeScript backend для заявок в Telegram, статистики сайта и AI-аналитики. Фронтенд остаётся статичным, API подключается отдельно.

## Что умеет

- `POST /api/contact` — принимает заявку, сохраняет в SQLite, отправляет в Telegram
- `POST /api/visit` — сохраняет визит пользователя
- `POST /api/events` — сохраняет события сайта: клики, скролл, язык, форму, секции
- `GET /api/stats?period=today|week|month` — отдаёт сводную статистику
- `GET /api/leads` — последние заявки
- `POST /api/ai/report` — создаёт AI-отчёт по статистике
- `GET /api/ai/reports` — история AI-отчётов
- `GET/POST /api/content/:key` — базовое управление контентом

## Быстрый старт

```bash
cd api
npm install
cp .env.example .env
npm run dev
```

Минимально заполните в `.env`:

```bash
BOT_TOKEN=token_from_botfather
CHAT_ID=your_telegram_chat_id
CORS_ORIGIN=https://your-site.vercel.app
OPENAI_API_KEY=sk-...
OPENAI_MODEL=minimax-m2
OPENAI_BASE_URL=https://api.hydraai.ru/v1
```

Если `OPENAI_API_KEY` пустой, `/api/ai/report` вернёт локальный fallback-отчёт без обращения к AI. Для HydraAI используйте `OPENAI_BASE_URL=https://api.hydraai.ru/v1` и модель `minimax-m2`.

## Подключение фронтенда

В `index.html` задайте базовый URL API:

```html
<script>
    window.API_BASE = 'https://your-api.onrender.com';
</script>
```

`window.API_URL` сформируется автоматически как `/api/contact`. Если нужно, его можно задать вручную.

## Telegram-команды

- `/start` — подключить администратора
- `/leads` — последние 10 заявок
- `/leads 20` — последние 20 заявок
- `/stats` — статистика за сегодня
- `/stats week` — статистика за неделю
- `/stats month` — статистика за месяц
- `/ai` — AI-анализ за неделю
- `/ai month` — AI-анализ за месяц
- `/reports` — последние AI-отчёты
- `/help` — список команд
- `/stop` — отключить уведомления

## Проверка

```bash
npm run build
npm start

curl http://localhost:3000/
curl -X POST http://localhost:3000/api/visit \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test-session","path":"/","language":"ru"}'
curl -X POST http://localhost:3000/api/events \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test-session","eventType":"cta_click","label":"test"}'
curl 'http://localhost:3000/api/stats?period=today'
```
