import { useEffect } from 'preact/hooks';

export default function HeroFacts() {
  useEffect(() => {
    const factNumbers = document.querySelectorAll('.fact-number[data-count]');
    if (!factNumbers.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          const suffix = el.dataset.suffix || '';
          const duration = 2000;
          const startTime = performance.now();

          function update(currentTime) {
            const elapsed = currentTime - startTime;
            const p = Math.min(elapsed / duration, 1);
            const ease = 1 - (1 - p) * (1 - p);
            const current = Math.round(0 + (target - 0) * ease);
            el.textContent = current + suffix;
            if (p < 1) requestAnimationFrame(update);
          }

          requestAnimationFrame(update);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    factNumbers.forEach(el => observer.observe(el));
  }, []);

  return null;
}
