import { useEffect } from 'preact/hooks';

export default function ScrollAnimations() {
  useEffect(() => {
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -60px 0px' };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const sections = document.querySelectorAll('.section-header, .about-grid, .project-card, .service-card, .advantage-item, .cta-content, .stat-item');
    sections.forEach((el, index) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${(index % 4) * 0.1}s`;
      observer.observe(el);
    });
  }, []);

  return null;
}
