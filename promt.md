# 📋 ТЕХНИЧЕСКОЕ ЗАДАНИЕ: Переписывание сайта GYURJYAN на Astro

## 🎯 ЦЕЛЬ ПРОЕКТА
Переписать существующий HTML/JS/CSS сайт премиальной компании (инвестиции, архитектура, строительство, туризм) на фреймворк **Astro** с сохранением дизайна и функциональности, но с максимальной оптимизацией производительности. Сайт содержит много фотографий, поэтому оптимизация изображений — приоритет №1.

---

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА ASTRO (ЧТО НУЖНО СОБЛЮДАТЬ)

### 1. Архитектура "Островов" (Islands Architecture)
- По умолчанию **Astro не отправляет JavaScript на клиент**. Весь HTML генерируется на сервере при сборке.
- JavaScript загружается ТОЛЬКО для интерактивных компонентов (слайдеры, модалки, формы).
- Используй директивы `client:*` осознанно:
  - `client:load` — загрузить сразу (только для критичных элементов: прелоадер, меню)
  - `client:visible` — загрузить когда элемент появится в viewport (слайдеры, галереи)
  - `client:idle` — загрузить когда браузер простаивает (второстепенные виджеты)
  - `client:media="(max-width: 768px)"` — загрузить только на мобильных
  - `client:only="react"` — загрузить только на клиенте (без SSR, редко нужно)

### 2. Оптимизация изображений (astro:assets)
- **ВСЕГДА** используй компонент `<Image>` из `astro:assets`, а не обычный `<img>`.
- Astro автоматически:
  - Конвертирует в WebP/AVIF
  - Создает `srcset` для разных разрешений
  - Генерирует blur-плейсхолдеры
  - Добавляет `loading="lazy"` по умолчанию
- Для фоновых изображений используй `<Picture>` или тег `<img>` с `object-fit: cover`.
- **ОБЯЗАТЕЛЬНО** указывай `width` и `height` для предотвращения Cumulative Layout Shift (CLS).

### 3. Стили
- Используй **scoped CSS** внутри `.astro` файлов (тег `<style>` автоматически изолируется).
- Для глобальных стилей (шрифты, reset) — файл `src/styles/global.css` импортируется в layout.
- Поддерживаются: CSS Modules, Sass, Tailwind, Styled Components.
- **НЕ ИСПОЛЬЗУЙ** CSS-in-JS решения (styled-components, emotion) без крайней необходимости — они добавляют JS на клиент.

### 4. Роутинг
- Файловый роутинг: `src/pages/index.astro` → `/`
- Динамические маршруты: `src/pages/projects/[slug].astro` → `/projects/my-project`
- Используй `getStaticPaths()` для генерации страниц из данных.

### 5. Данные и контент
- Для проектов, услуг, новостей используй **Content Collections** (`src/content/`).
- Храни данные в Markdown/MDX или JSON/YAML.
- Это даст типизацию, валидацию и оптимизацию.

### 6. View Transitions API
- Для плавных переходов между страницами используй `<ViewTransitions />` из `astro:transitions/client`.
- Это даст эффект SPA без JavaScript-фреймворка.

---

## 🚫 АНТИПАТТЕРНЫ (ЧТО НЕЛЬЗЯ ДЕЛАТЬ)

### ❌ JavaScript-паразиты
1. **НЕ загружай React/Vue/Svelte для простых компонентов.** Если слайдер можно написать на 50 строках ванильного JS — пиши на ванильном.
2. **НЕ используй `client:load` на всём подряд.** Это убьет производительность.
3. **НЕ импортируй тяжелые библиотеки целиком:**
   ```javascript
   // ❌ ПЛОХО
   import _ from 'lodash';
   
   // ✅ ХОРОШО
   import debounce from 'lodash/debounce';
   ```
4. **НЕ используй jQuery.** В Astro он не нужен.
5. **НЕ делай `useEffect` с тяжелыми вычислениями** в React-компонентах без `useMemo`/`useCallback`.

### ❌ Изображения-паразиты
1. **НЕ используй обычные `<img src="/images/large.jpg">`** без оптимизации.
2. **НЕ забывай указывать `width` и `height`** — это вызовет layout shift.
3. **НЕ загружай все картинки сразу.** Используй `loading="lazy"` для всего, кроме первого экрана.
4. **НЕ используй фоновые изображения через CSS для критичного контента** — они не ленивятся. Используй `<img>` с `object-fit: cover`.

### ❌ CSS-паразиты
1. **НЕ импортируй весь Bootstrap/Tailwind**, если используешь 5% классов.
2. **НЕ используй `!important`** — это признак плохой архитектуры.
3. **НЕ дублируй стили** между компонентами — выноси в общие компоненты.
4. **НЕ загружай шрифты без `font-display: swap`** — это блокирует рендеринг.

### ❌ Архитектурные паразиты
1. **НЕ создавай монолитные компоненты** на 500+ строк. Разбивай на атомы/молекулы.
2. **НЕ храни данные в компонентах** — используй Content Collections или внешние API.
3. **НЕ делай клиентский роутинг** (React Router, Vue Router) — в Astro есть встроенный.
4. **НЕ используй SSR без необходимости.** Статическая генерация (SSG) быстрее.

---

## 🔥 ПАРАЗИТЫ ПРОИЗВОДИТЕЛЬНОСТИ (ЧТО ЛОМАЕТ САЙТ)

### 1. Cumulative Layout Shift (CLS)
**Причина:** Картинки без размеров, шрифты без `font-display: swap`, динамическая вставка контента.
**Решение:**
- Всегда указывай `width` и `height` для `<Image>`.
- Используй `font-display: swap` для шрифтов.
- Резервируй место для динамического контента через `min-height`.

### 2. Большой JavaScript Bundle
**Причина:** Тяжелые библиотеки, неиспользуемый код, отсутствие tree-shaking.
**Решение:**
- Анализируй bundle через `npm run build -- --stats` или плагин `astro-bundle-analyzer`.
- Используй динамические импорты для тяжелых компонентов:
  ```javascript
  const HeavyComponent = await import('./HeavyComponent.astro');
  ```

### 3. Блокирующие ресурсы
**Причина:** CSS/JS в `<head>` без `async`/`defer`, большие шрифты.
**Решение:**
- Astro автоматически минифицирует и оптимизирует ресурсы.
- Для внешних скриптов используй `<script defer>`.
- Шрифты загружай через `<link rel="preload">` для критичных начертаний.

### 4. Неоптимальные изображения
**Причина:** JPG/PNG вместо WebP, отсутствие `srcset`, загрузка всех картинок сразу.
**Решение:**
- Используй `<Image>` из `astro:assets`.
- Настраивай `quality` (75-85 оптимально).
- Для hero-изображений используй `fetchpriority="high"`.

### 5. Избыточные HTTP-запросы
**Причина:** Много мелких файлов, отсутствие кэширования.
**Решение:**
- Astro автоматически бандлит CSS/JS.
- Настраивай заголовки кэширования на хостинге (Vercel/Netlify делают это автоматически).
- Используй CDN для изображений (Astro Image CDN).

---

## 📝 ЗАДАЧИ ДЛЯ ПЕРЕПИСЫВАНИЯ (ПОШАГОВЫЙ ПЛАН)

### ЭТАП 1: Инициализация проекта
- [ ] Создать проект: `npm create astro@latest`
- [ ] Выбрать настройки:
  - TypeScript: **Strict**
  - ESLint: **Да**
  - Tailwind: **Нет** (используем scoped CSS)
  - React/Vue: **Только если нужно для сложных компонентов**
- [ ] Установить зависимости:
  ```bash
  npm install @astrojs/image sharp
  npm install -D astro-icon
  ```
- [ ] Настроить `astro.config.mjs`:
  ```javascript
  import { defineConfig } from 'astro/config';
  import image from '@astrojs/image';
  
  export default defineConfig({
    integrations: [image({
      serviceConfig: {
        quality: 80,
        format: ['webp', 'avif']
      }
    })],
    image: {
      domains: ['images.unsplash.com'],
      remotePatterns: [{ protocol: 'https', hostname: '**.unsplash.com' }]
    }
  });
  ```

### ЭТАП 2: Структура проекта
```
src/
├── assets/              # Локальные изображения
│   ├── images/
│   └── fonts/
├── components/          # Переиспользуемые компоненты
│   ├── ui/              # Кнопки, инпуты, иконки
│   ├── sections/        # Секции страницы (Hero, About, Projects)
│   └── layout/          # Header, Footer, SEO
├── content/             # Content Collections
│   ├── projects/        # Markdown файлы проектов
│   └── services/        # Markdown файлы услуг
├── layouts/             # Layouts (BaseLayout, ProjectLayout)
├── pages/               # Роутинг
│   ├── index.astro
│   ├── about.astro
│   └── projects/
│       └── [slug].astro
├── styles/              # Глобальные стили
│   ├── global.css
│   └── variables.css
└── utils/               # Утилиты (форматирование, даты)
```

### ЭТАП 3: Перенос HTML в Astro-компоненты
- [ ] Создать `BaseLayout.astro` с общим `<head>`, шрифтами, мета-тегами.
- [ ] Перенести `<header>` в `Header.astro`.
- [ ] Перенести `<footer>` в `Footer.astro`.
- [ ] Создать компоненты для каждой секции:
  - `Hero.astro` (с фоновым слайдером)
  - `About.astro`
  - `Services.astro`
  - `Projects.astro`
  - `Contact.astro`

### ЭТАП 4: Оптимизация изображений
- [ ] Заменить все `<img>` на `<Image>` из `astro:assets`:
  ```astro
  ---
  import { Image } from 'astro:assets';
  import heroImage from '../assets/hero.jpg';
  ---
  
  <Image 
    src={heroImage} 
    width={1920} 
    height={1080} 
    alt="Hero" 
    format="webp"
    quality={85}
    fetchpriority="high"
  />
  ```
- [ ] Для фоновых изображений использовать `<Picture>` или `<img>` с `object-fit: cover`.
- [ ] Настроить Content Collections для проектов с галереями изображений.

### ЭТАП 5: Перенос JavaScript
- [ ] Создать интерактивные компоненты (React/Vue или ванильный JS):
  - `BackgroundSlider.jsx` — слайдер фона (директива `client:visible`)
  - `Preloader.jsx` — прелоадер (директива `client:load`)
  - `Lightbox.jsx` — лайтбокс (директива `client:visible`)
  - `MobileMenu.jsx` — мобильное меню (директива `client:load`)
  - `ContactForm.jsx` — форма (директива `client:visible`)
- [ ] Убедиться, что неинтерактивные элементы (текст, статика) НЕ имеют JS.
- [ ] Использовать `IntersectionObserver` для анимаций при скролле.

### ЭТАП 6: Стили
- [ ] Перенести `style.css` в `src/styles/global.css`.
- [ ] Разбить на модули:
  - `variables.css` (цвета, шрифты, отступы)
  - `reset.css` (сброс стилей)
  - `typography.css` (шрифты)
  - `components.css` (кнопки, карточки)
- [ ] Использовать scoped CSS внутри компонентов для специфичных стилей.
- [ ] Оптимизировать шрифты:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
  ```

### ЭТАП 7: SEO и мета-теги
- [ ] Создать компонент `SEO.astro`:
  ```astro
  ---
  const { title, description, image, url } = Astro.props;
  ---
  <title>{title}</title>
  <meta name="description" content={description}>
  <meta property="og:title" content={title}>
  <meta property="og:description" content={description}>
  <meta property="og:image" content={image}>
  <meta property="og:url" content={url}>
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href={url}>
  ```
- [ ] Добавить `sitemap.xml` через `@astrojs/sitemap`.
- [ ] Добавить `robots.txt`.

### ЭТАП 8: Content Collections
- [ ] Создать схему для проектов:
  ```typescript
  // src/content/config.ts
  import { z, defineCollection } from 'astro:content';
  
  const projects = defineCollection({
    schema: z.object({
      title: z.string(),
      description: z.string(),
      category: z.enum(['investments', 'architecture', 'construction', 'tourism']),
      images: z.array(z.string()),
      year: z.number(),
      location: z.string()
    })
  });
  
  export const collections = { projects };
  ```
- [ ] Создать Markdown файлы для каждого проекта в `src/content/projects/`.
- [ ] Генерировать страницы проектов через `getStaticPaths()`.

### ЭТАП 9: Тестирование производительности
- [ ] Запустить `npm run build` и проверить размер bundle.
- [ ] Протестировать в Lighthouse:
  - Performance: **90+**
  - Accessibility: **90+**
  - Best Practices: **90+**
  - SEO: **90+**
- [ ] Проверить Core Web Vitals:
  - LCP (Largest Contentful Paint): **< 2.5s**
  - FID (First Input Delay): **< 100ms**
  - CLS (Cumulative Layout Shift): **< 0.1**
- [ ] Протестировать на мобильных устройствах (Chrome DevTools → Device Mode).

### ЭТАП 10: Деплой
- [ ] Выбрать хостинг: **Vercel** (рекомендуется) или **Netlify**.
- [ ] Настроить переменные окружения (если нужны).
- [ ] Настроить домен и SSL.
- [ ] Настроить кэширование через `vercel.json` или `netlify.toml`:
  ```json
  {
    "headers": [
      {
        "source": "/assets/(.*)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      }
    ]
  }
  ```

---

## ✅ ЧЕКЛИСТ ПЕРЕД РЕЛИЗОМ

- [ ] Все изображения оптимизированы (WebP/AVIF, правильные размеры)
- [ ] Нет `client:load` без крайней необходимости
- [ ] Все интерактивные компоненты имеют `client:visible` или `client:idle`
- [ ] Шрифты загружаются с `font-display: swap`
- [ ] Мета-теги заполнены для всех страниц
- [ ] Sitemap и robots.txt настроены
- [ ] Lighthouse Performance ≥ 90
- [ ] Сайт работает без JavaScript (прогрессивное улучшение)
- [ ] Мобильная версия адаптивна
- [ ] Формы валидируются на клиенте и сервере
- [ ] Нет консоли с ошибками
- [ ] Все ссылки рабочие (нет 404)

---

## 🎯 ИТОГОВЫЙ РЕЗУЛЬТАТ

После переписывания сайт должен:
1. Загружаться за **< 2 секунды** на мобильном интернете.
2. Иметь **0 JavaScript** для неинтерактивных элементов.
3. Автоматически оптимизировать все изображения.
4. Быть SEO-friendly (семантический HTML, мета-теги, sitemap).
5. Легко масштабироваться (добавление новых проектов через Markdown).
6. Иметь оценку **90+** в Google PageSpeed Insights.

---

**ВАЖНО:** Если агент не уверен в каком-то решении — пусть спрашивает. Лучше сделать медленнее, но правильно, чем быстро и с ошибками производительности.