# Промты для AI — сборка проекта INTEGRA KOTOVA

> Каждый промт — это самостоятельная задача. Можно копировать и отправлять AI по очереди.

---

## Промт 1: Инициализация проектов (Frontend + Backend)

```
Создай два проекта в папке /Users/rotman/Desktop/oxy/integrakotova/:

1. FRONTEND — Astro проект:
   - Выполни: npm create astro@latest frontend
   - Ответы на вопросы: TypeScript, строгий режим, рекомендуемый шаблон
   - После создания проверь что запускается: cd frontend && npm run dev
   - Создай папки: src/components/, src/islands/, src/layouts/, src/pages/[lang]/, src/styles/, src/types/

2. BACKEND — Node.js проект:
   - Создай папку backend/
   - npm init -y
   - Установи: express sqlite3 multer cors dotenv node-telegram-bot-api
   - Создай папки: config/, db/, middleware/, routes/, services/, utils/

3. ОБЩИЕ файлы:
   - Создай .env в корне integrakotova/:
     PORT=3000
     BOT_TOKEN=your_telegram_bot_token_from_botfather
     ADMIN_CHAT_ID=your_telegram_chat_id
     OPENAI_API_KEY=sk-xxx
     UPLOAD_DIR=./uploads
     DB_PATH=./data.db
   
   - Создай README.md с описанием структуры

4. Сделай первый commit:
   git init && git add -A && git commit -m "Init: Astro frontend + Express backend"

Отчёт: список всех созданных файлов и папок.
```

---

## Промт 2: База данных и миграции

```
В папке /Users/rotman/Desktop/oxy/integrakotova/backend/:

1. Создай db/index.js — подключение к SQLite:
   - Используй sqlite3, путь из process.env.DB_PATH или './data.db'
   - Экспортируй объект db с методами: run, get, all
   - Оборачивай в Promises

2. Создай db/migrations.js — создание таблиц:
   content (key PRIMARY KEY, value, type, section, updated_at)
   visits (id AUTOINCREMENT, session_id, ip, user_agent, referrer, country, city, created_at)
   events (id AUTOINCREMENT, session_id, event_type, section, element, value, created_at)
   sources (id AUTOINCREMENT, session_id, utm_source, utm_medium, utm_campaign, created_at)
   ai_logs (id AUTOINCREMENT, chat_id, question, answer, tokens_used, created_at)

3. Создай services/content.js — CRUD для контента:
   getAll() → все записи
   getByKey(key) → одна запись
   update(key, value) → обновить
   insert(key, value, type, section) → создать

4. Создай seeds.js — начальные данные из сайта INTEGRA KOTOVA:
   Заполни таблицу content всеми текстами из текущего index.html
   Ключи: hero_title_line1, hero_title_line2, hero_desc, about_p1, about_p2, 
   services_label, service_construction, service_construction_desc и т.д.
   Тип: 'text', section: соответствующая секция

5. Напиши скрипт npm run migrate для запуска миграций

Отчёт: покажи структуру db/migrations.js и 5 примеров ключей из seeds.js.
```

---

## Промт 3: Express API — контент и загрузка

```
В папке /Users/rotman/Desktop/oxy/integrakotova/backend/:

1. Создай routes/api.js:
   GET /api/content — отдать JSON всех записей из content
   PUT /api/content/:key — обновить текст по ключу
   POST /api/upload — принять файл через multer, сохранить в uploads/, вернуть URL
   GET /api/content/:key — получить одну запись

2. Создай middleware/upload.js:
   Настрой multer для сохранения файлов в uploads/
   Генерируй имя файла: Date.now() + '-' + Math.round(Math.random() * 1E9) + ext

3. Создай middleware/auth.js:
   Проверяй ADMIN_CHAT_ID для PUT/POST запросов
   Если не совпадает — 403 Forbidden

4. Обнови server.js:
   Подключи express, cors, dotenv
   Подключи маршруты: app.use('/api', apiRoutes)
   Статика: app.use('/uploads', express.static('uploads'))
   Запуск: app.listen(PORT, () => console.log(...))

5. Проверь: node server.js должен запускаться без ошибок

Отчёт: покажи код routes/api.js полностью.
```

---

## Промт 4: Telegram Bot — команды контента

```
В папке /Users/rotman/Desktop/oxy/integrakotova/backend/:

1. Создай routes/bot.js:
   Подключи node-telegram-bot-api
   Создай бота с токеном из .env
   Настрой polling (для локальной разработки)

2. Команды бота (только для ADMIN_CHAT_ID):
   /start — приветствие + список команд
   /edit <key> <текст> — обновить текст в БД через services/content.js
   /get <key> — показать текущее значение
   /list — список всех ключей (постранично по 20)
   /sections — список уникальных section из БД
   /preview — ссылка на http://localhost:3000

3. Если сообщение НЕ от ADMIN_CHAT_ID — ответ: "⛔️ Доступ запрещён"

4. Обнови server.js чтобы бот запускался вместе с сервером

5. Проверь: запусти сервер и отправь /start боту

Отчёт: покажи как выглядит ответ бота на /list.
```

---

## Промт 5: Astro — компоненты секций

```
В папке /Users/rotman/Desktop/oxy/integrakotova/frontend/:

1. Создай src/layouts/Base.astro:
   - HTML5 шаблон с <head>
   - Подключение global.css
   - Навигация с языковым переключателем RU/EN/HY
   - Передай через props: lang, title

2. Создай src/components/ — по файлу на каждую секцию:
   Hero.astro — hero-секция с локациями, title, формулой, CTA
   About.astro — фото + текст + статистика
   Projects.astro — слайдер с 8 проектами
   Services.astro — 6 карточек
   Supply.astro — 3 карточки
   Advantages.astro — 6 карточек преимуществ
   Tourism.astro — 3 карточки
   Partners.astro — 6 партнёров
   Contacts.astro — форма + мессенджеры
   Footer.astro — адрес, контакты, соцсети

3. Каждый компонент получает через props объект content с нужными ключами
   Пример: <Hero title={content.hero_title_line1} ... />

4. Создай src/pages/[lang]/index.astro:
   getStaticPaths() для ['ru', 'en', 'hy']
   Собирает все компоненты в layout Base
   Получает content через const content = await fetch('http://localhost:3000/api/content')

5. Скопируй CSS из текущего style.css в src/styles/global.css

Отчёт: покажи структуру src/ (дерево файлов).
```

---

## Промт 6: Интерактивные острова (острова Astro)

```
В папке /Users/rotman/Desktop/oxy/integrakotova/frontend/:

1. Создай src/islands/Slider.tsx (React или Preact):
   - Логика слайдера проектов как в текущем main.js
   - Кнопки prev/next, dots, переключение по таймеру
   - Используй client:load directive в Astro

2. Создай src/islands/Form.tsx:
   - Контактная форма с валидацией
   - Отправка на API (если есть) или просто alert
   - client:load

3. Создай src/islands/Track.tsx:
   - Аналитика: отправка событий на /api/track
   - Отслеживание: page_open, section_view (IntersectionObserver), 
     click (на CTA), scroll (25%, 50%, 75%, 100%)
   - client:load

4. Подключи острова в соответствующие компоненты:
   <Slider client:load slides={content.projects} />
   <Form client:load />

Отчёт: покажи код Track.tsx (аналитика).
```

---

## Промт 7: Мультиязычность и динамика

```
В папке /Users/rotman/Desktop/oxy/integrakotova/frontend/:

1. Обнови src/pages/[lang]/index.astro:
   Добавь getStaticPaths():
   export function getStaticPaths() {
     return [{ params: { lang: 'ru' } }, { params: { lang: 'en' } }, { params: { lang: 'hy' } }];
   }
   
   Получай lang из Astro.params.lang
   Передай lang в Base layout

2. Создай src/i18n/labels.ts:
   Объект с переводами UI-элементов (не контента):
   { ru: { nav_about: 'О нас', ... }, en: { ... }, hy: { ... } }

3. Навигация в Base.astro должна:
   Показывать правильные ссылки: /ru/, /en/, /hy/
   Подсвечивать текущий язык
   Переключаться при клике

4. Проверь сборку: npm run build
   Убедись что создаются dist/ru/index.html, dist/en/index.html, dist/hy/index.html

Отчёт: покажи структуру dist/ после сборки.
```

---

## Промт 8: Аналитика — сбор и API

```
В папке /Users/rotman/Desktop/oxy/integrakotova/backend/:

1. Создай services/analytics.js:
   recordVisit(sessionId, ip, userAgent, referrer) → INSERT INTO visits
   recordEvent(sessionId, eventType, section, element, value) → INSERT INTO events
   recordSource(sessionId, utmSource, utmMedium, utmCampaign) → INSERT INTO sources
   getStats(period) → агрегация: посетители, события, средний скролл

2. Создай routes/stats.js:
   POST /api/track — принять JSON с событиями, записать в БД
   GET /api/stats?period=today|week|month — вернуть статистику
   GET /api/stats/heatmap?section=X — клики по элементам секции
   GET /api/stats/popular — самые просматриваемые секции
   GET /api/stats/scroll — средний скролл по секциям

3. Обнови routes/bot.js — добавь команды аналитики:
   /stats today — сводка за сегодня
   /stats week — за неделю
   /heatmap <section> — клики
   /scroll — средний скролл
   /sources — источники трафика
   /popular — популярные секции

Отчёт: покажи пример ответа /stats today в формате Telegram.
```

---

## Промт 9: AI-ассистент (OpenAI)

```
В папке /Users/rotman/Desktop/oxy/integrakotova/backend/:

1. Создай services/ai.js:
   ask(question, context) → отправляет запрос в OpenAI API
   generateText(prompt) → генерация текста
   analyzeStats(stats) → AI-анализ статистики с рекомендациями
   translate(text, targetLang) → перевод
   fixText(text) → исправление ошибок

2. Используй модель: gpt-4o-mini (дешёвая, быстрая)
   Формируй промт с контекстом аналитики перед вопросом
   Сохраняй ответы в ai_logs

3. Создай routes/ai.js:
   POST /api/ask — принять question, вернуть ответ AI
   { question, session_id? } → { answer, tokens_used }

4. Обнови routes/bot.js — добавь AI-команды:
   /ai <вопрос> — общий вопрос к AI с контекстом
   /insights today|week|month — AI анализирует статистику
   /suggest — AI советует что улучшить
   /write <key> <тема> — AI пишет текст, показывает, спрашивает подтверждение
   /translate <key> <язык> — AI переводит текст
   /fix <key> — AI исправляет ошибки

5. Для /write и /fix: бот спрашивает "Сохранить? [Да]/[Нет]" перед записью в БД

Отчёт: покажи пример диалога: /insights today → ответ бота.
```

---

## Промт 10: Связка всего вместе + запуск

```
В папке /Users/rotman/Desktop/oxy/integrakotova/:

1. FRONTEND:
   Убедись что npm run dev работает на localhost:4321
   Проверь мультиязычность: /ru/, /en/, /hy/
   Проверь что контент подгружается с http://localhost:3000/api/content
   Собери: npm run build → dist/

2. BACKEND:
   Убедись что node backend/server.js работает на localhost:3000
   Проверь API: curl http://localhost:3000/api/content
   Проверь бота: отправь /start, /list
   Проверь аналитику: отправь событие на /api/track
   Проверь AI: отправь /ai "Привет"

3. СВЯЗКА:
   Astro dev proxy: настрой astro.config.mjs чтобы /api/* проксировались на :3000
   Или: запускай оба сервера и фронт обращается к http://localhost:3000

4. Сделай финальный commit:
   git add -A && git commit -m "Full stack: Astro frontend + Express backend + Telegram bot + Analytics + AI"

5. Напиши README.md с инструкцией по запуску:
   npm run dev (frontend)
   node backend/server.js (backend)
   Как настроить .env
   Как получить BOT_TOKEN у @BotFather

Отчёт: скриншоты или логи успешного запуска.
```

---

## Промт 11: Опционально — деплой на VPS

```
Когда будет VPS:

1. Установи на сервер: Node.js 20+, PM2, Nginx, SQLite3
2. Склонируй репозиторий
3. Собери frontend: cd frontend && npm run build
4. Настрой Nginx:
   / → serve dist/ (статические файлы Astro)
   /api → proxy_pass localhost:3000
   /uploads → serve uploads/
5. Запусти backend через PM2: pm2 start backend/server.js --name api
6. Настрой постоянный webhook Telegram (не polling)
7. Настрой SSL через Let's Encrypt
8. Перезапуск при деплое: pm2 restart api && nginx -s reload

Отчёт: конфиг Nginx.
```

---

## Как использовать

1. **Отправь Промт 1** AI → получи базовую структуру
2. **Проверь** что файлы созданы → отправь Промт 2
3. **И так далее** по порядку
4. **Если что-то сломалось** — вернись на шаг назад и уточни

> ⚠️ Важно: после каждого промта проверяй результат перед следующим!
