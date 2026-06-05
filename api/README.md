# INTEGRA KOTOVA API

TypeScript backend для приёма заявок, отправки в Telegram и управления контентом.

## Что умеет

- `POST /api/contact` — принимает заявку с сайта, сохраняет в SQLite, отправляет в Telegram
- `GET /api/stats` — статистика заявок (всего, сегодня, неделя, по направлениям)
- `GET /api/leads` — список заявок (для админки)
- `GET/POST /api/content/:key` — управление текстом/фото сайта через API (для бота)

## Быстрый старт

```bash
cd api
npm install

# Создайте .env из примера
cp .env.example .env
# Отредактируйте .env — вставьте BOT_TOKEN и CHAT_ID

# Разработка
npm run dev

# Сборка
npm run build
npm start
```

## Telegram Bot — как подписаться на заявки

1. Напишите [@BotFather](https://t.me/BotFather), создайте бота, получите `BOT_TOKEN`
2. Напишите вашему боту команду `/start` — он сохранит ваш chat_id и подпишет на уведомления
3. Вставьте `BOT_TOKEN` в `.env`
4. `CHAT_ID` можно оставить пустым — он используется только как запасной вариант

## Деплой

### Railway (рекомендую — бесплатно)
```bash
# Установите CLI: npm i -g @railway/cli
railway login
railway init
railway up
```

### Render
1. Создайте Web Service, укажите `api/` как root directory
2. Build command: `npm run build`
3. Start command: `npm start`
4. Добавьте environment variables из `.env`

## Подключение к фронтенду

В `index.html` замените `window.API_URL` на ваш домен:

```html
<script>
    window.API_URL = 'https://your-api.onrender.com/api/contact';
</script>
```

## Будущее: админка через Telegram бота

Можно расширить бота командами:
- `/stats` — показать статистику
- `/leads` — последние заявки
- `/set hero_title Новый текст` — обновить текст на сайте
- `/photo hero_bg photo.jpg` — заменить фото
