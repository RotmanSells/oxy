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
- `GET /api/content` — публично отдаёт тексты и фото для статичного сайта
- `GET /api/content/:key` — публично отдаёт один текст в новом формате
- `POST /api/content/:key` — обновляет текст, требует `X-Admin-Secret`
- `POST /api/media/:key` — загружает фото, требует `X-Admin-Secret`
- `GET /uploads/*` — отдаёт загруженные изображения

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
UPLOAD_DIR=./uploads
ADMIN_SECRET=long-random-string
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

- `/start` — подключить администратора, только если chat id совпадает с `CHAT_ID`
- `/leads` — последние 10 заявок
- `/leads 20` — последние 20 заявок
- `/stats` — статистика за сегодня
- `/stats week` — статистика за неделю
- `/stats month` — статистика за месяц
- `/ai` — AI-анализ за неделю
- `/ai month` — AI-анализ за месяц
- `/reports` — последние AI-отчёты
- `/set hero_title Новый текст` — обновить текст сайта
- `/content hero_title Новый текст` — то же самое
- `/get hero_title` — показать текущий текст
- `/photo hero_bg` — бот ждёт следующую картинку и сохраняет её
- `/help` — список команд
- `/stop` — отключить уведомления

После `/start` бот показывает кнопки `📊 Статистика`, `📝 Тексты`, `🖼 Фото`, `🤖 AI`.

### Управление текстами через Telegram

1. Нажмите `📝 Тексты`.
2. Выберите ключ с понятным названием.
3. Бот покажет текущий текст.
4. Отправьте новый текст следующим сообщением.
5. Бот ответит `✅ Текст обновлён`.

Доступные ключи:

- `hero_title` — Главный заголовок
- `hero_subtitle` — Подзаголовок
- `hero_cta` — Текст кнопки
- `about_title` — Заголовок “О компании”
- `about_text` — Текст “О компании”
- `contacts_title` — Заголовок контактов
- `contacts_phone` — Телефон
- `contacts_telegram` — Telegram
- `contacts_whatsapp` — WhatsApp

### Управление фото через Telegram

1. Нажмите `🖼 Фото`.
2. Выберите ключ фото.
3. Отправьте изображение JPG, PNG или WebP до 8 MB.
4. Бот скачает файл, сохранит его в `UPLOAD_DIR` и ответит `✅ Фото обновлено`.

Доступные ключи фото:

- `hero_bg` — Главное фото
- `about_photo` — Фото “О компании”
- `contacts_bg` — Фото контактов

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
curl 'http://localhost:3000/api/content'
curl -X POST http://localhost:3000/api/content/hero_title \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Secret: long-random-string' \
  -d '{"value":"Новый заголовок"}'
```

## VPS / один сервер

Для размещения сайта и API на одном Ubuntu VPS используйте готовые файлы из `deploy/`:

```bash
bash deploy/bootstrap-ubuntu.sh example.com
```

После этого заполните секреты в `/opt/oxy/api/.env`, перезапустите `oxy-api` и выпустите SSL через Certbot. Подробная инструкция: `deploy/README.md`.
