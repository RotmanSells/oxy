import { useEffect } from 'preact/hooks';

export default function Preloader() {
  useEffect(() => {
    const preloader = document.getElementById('preloader');
    const preloaderBar = document.getElementById('preloaderBar');
    const preloaderPercent = document.getElementById('preloaderPercent');
    const preloaderText = document.getElementById('preloaderText');
    if (!preloader) return;

    document.body.classList.add('loading');

    const phrases = [
      'Укладываем фундамент','Возводим каркас','Проектируем пространство',
      'Инвестируем в детали','Финишная отделка','Запускаем системы',
      'Вводим объект','Добро пожаловать'
    ];
    const MIN_DURATION = 5200;
    const PHRASE_DURATION = MIN_DURATION / phrases.length;
    let progress = 0;
    let resourcesLoaded = false;
    let startTime = performance.now();
    let animationFrame = null;
    let currentPhraseIndex = -1;

    function animateLoader() {
      const elapsed = performance.now() - startTime;
      const timeProgress = Math.min(elapsed / MIN_DURATION, 1);
      progress = Math.round(timeProgress * 100);
      if (preloaderBar) preloaderBar.style.width = progress + '%';
      if (preloaderPercent) preloaderPercent.textContent = progress + '%';
      const newPhraseIndex = Math.min(Math.floor(elapsed / PHRASE_DURATION), phrases.length - 1);
      if (newPhraseIndex !== currentPhraseIndex) {
        currentPhraseIndex = newPhraseIndex;
        if (preloaderText) preloaderText.textContent = phrases[currentPhraseIndex];
      }
      if (timeProgress < 1 || !resourcesLoaded) {
        animationFrame = requestAnimationFrame(animateLoader);
      } else {
        finishLoader();
      }
    }

    function finishLoader() {
      cancelAnimationFrame(animationFrame);
      if (preloaderBar) preloaderBar.style.width = '100%';
      if (preloaderPercent) preloaderPercent.textContent = '100%';
      if (preloaderText) preloaderText.textContent = phrases[phrases.length - 1];
      setTimeout(() => {
        if (preloader) preloader.classList.add('hidden');
        document.body.classList.remove('loading');
        window.dispatchEvent(new CustomEvent('app:ready'));
      }, 900);
    }

    let pendingResources = 0;
    function trackResource() { pendingResources++; }
    function resourceDone() { pendingResources--; if (pendingResources <= 0) resourcesLoaded = true; }

    document.querySelectorAll('img').forEach(img => {
      if (!img.complete) {
        trackResource();
        img.addEventListener('load', resourceDone, { once: true });
        img.addEventListener('error', resourceDone, { once: true });
      }
    });

    const bgEls = document.querySelectorAll('[style*="background-image"]');
    bgEls.forEach(el => {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundImage;
      if (bg && bg !== 'none') {
        const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (m) {
          trackResource();
          const img = new Image();
          img.onload = resourceDone;
          img.onerror = resourceDone;
          img.src = m[1];
        }
      }
    });

    window.addEventListener('load', () => { resourcesLoaded = true; });
    setTimeout(() => { resourcesLoaded = true; }, 6000);
    animationFrame = requestAnimationFrame(animateLoader);
  }, []);

  return null;
}
