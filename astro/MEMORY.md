# ПАМЯТЬ: Правила проекта GYURJYAN на Astro

## Критические правила Astro

### 1. Архитектура Островов
- По умолчанию Astro НЕ отправляет JS на клиент
- JS только для интерактивных компонентов
- Директивы client:*:
  - `client:load` — критичные (прелоадер, меню)
  - `client:visible` — когда в viewport (слайдеры, галереи)
  - `client:idle` — когда браузер простаивает
  - `client:media="(max-width: 768px)"` — только мобильные
  - `client:only="react"` — только клиент, без SSR

### 2. Оптимизация изображений (astro:assets)
- ВСЕГДА использовать `<Image>` из `astro:assets`, не `<img>`
- Astro конвертирует в WebP/AVIF, создает srcset, blur-плейсхолдеры, lazy loading
- Для фонов — `<Picture>` или `<img>` с `object-fit: cover`
- ОБЯЗАТЕЛЬНО указывать width и height (предотвращает CLS)

### 3. Стили
- Scoped CSS внутри `.astro` файлов (тег `<style>` авто-изолируется)
- Глобальные стили: `src/styles/global.css` импортируется в layout
- НЕ использовать CSS-in-JS (styled-components, emotion) — добавляют JS на клиент

### 4. Роутинг
- Файловый: `src/pages/index.astro` → `/`
- Динамические: `src/pages/projects/[slug].astro`
- `getStaticPaths()` для генерации из данных

### 5. Данные
- Content Collections (`src/content/`)
- Markdown/MDX или JSON/YAML
- Типизация, валидация, оптимизация

### 6. View Transitions
- `<ViewTransitions />` из `astro:transitions/client`
- SPA-эффект без JS-фреймворка

## Антипаттерны (НЕЛЬЗЯ)

### JS-паразиты
1. НЕ загружать React/Vue для простых компонентов — ванильный JS если можно
2. НЕ использовать `client:load` на всём
3. НЕ импортировать тяжелые библиотеки целиком — tree-shaking
4. НЕ использовать jQuery
5. НЕ делать useEffect с тяжелыми вычислениями без useMemo/useCallback

### Изображения-паразиты
1. НЕ использовать обычные `<img>` без оптимизации
2. НЕ забывать width/height
3. НЕ загружать все картинки сразу — lazy loading
4. НЕ использовать фоновые изображения через CSS для критичного контента

### CSS-паразиты
1. НЕ импортировать весь Bootstrap/Tailwind если мало классов
2. НЕ использовать `!important`
3. НЕ дублировать стили
4. НЕ загружать шрифты без `font-display: swap`

### Архитектурные паразиты
1. НЕ создавать монолитные компоненты 500+ строк — атомы/молекулы
2. НЕ хранить данные в компонентах — Content Collections
3. НЕ делать клиентский роутинг — в Astro встроенный
4. НЕ использовать SSR без необходимости — SSG быстрее

## Паразиты производительности

1. **CLS** — width/height для Image, font-display: swap, min-height для динамики
2. **Большой JS Bundle** — tree-shaking, динамические импорты
3. **Блокирующие ресурсы** — async/defer, preload шрифтов
4. **Неоптимальные изображения** — Image, quality 75-85, fetchpriority="high" для hero
5. **Избыточные HTTP-запросы** — Astro бандлит CSS/JS, CDN для изображений

## Этапы проекта

### Этап 1: Инициализация
- `npm create astro@latest` — TypeScript Strict, ESLint Да, Tailwind Нет
- `npm install sharp astro-icon`
- Настроить astro.config.mjs

### Этап 2: Структура
```
src/
├── assets/ (images, fonts)
├── components/
│   ├── ui/
│   ├── sections/
│   └── layout/
├── content/ (projects, services)
├── layouts/
├── pages/
├── styles/
└── utils/
```

### Этап 3: Перенос HTML
- BaseLayout.astro — общий head, шрифты, мета
- Header.astro, Footer.astro
- Секции: Hero, About, Services, Projects, Contact

### Этап 4+: Оптимизация изображений, JS, стили, SEO, Content Collections, тестирование, деплой

## Целевые метрики
- Загрузка < 2 секунд на мобильном
- 0 JavaScript для неинтерактивных элементов
- Lighthouse Performance ≥ 90
- LCP < 2.5s, FID < 100ms, CLS < 0.1
