import { useEffect } from 'preact/hooks';

export default function ProjectsSlider() {
  useEffect(() => {
    const slider = document.getElementById('projectsSlider');
    if (!slider) return;

    const slides = slider.querySelectorAll('.project-slide');
    const dots = slider.querySelectorAll('.project-slider-dots .dot');
    const prevBtn = slider.querySelector('.project-slider-btn.prev');
    const nextBtn = slider.querySelector('.project-slider-btn.next');

    let currentSlide = 0;
    let autoPlayInterval;
    let userInteracted = false;
    const totalSlides = slides.length;

    function goToSlide(index) {
      if (index < 0) index = totalSlides - 1;
      if (index >= totalSlides) index = 0;
      slides[currentSlide].classList.remove('active');
      dots[currentSlide]?.classList.remove('active');
      currentSlide = index;
      slides[currentSlide].classList.add('active');
      dots[currentSlide]?.classList.add('active');
    }

    function nextSlide() { goToSlide(currentSlide + 1); }
    function prevSlide() { goToSlide(currentSlide - 1); }

    function startAutoPlay() { if (userInteracted) return; autoPlayInterval = setInterval(nextSlide, 4000); }
    function stopAutoPlay() { clearInterval(autoPlayInterval); }
    function handleUserInteraction(callback) { userInteracted = true; stopAutoPlay(); callback(); }

    if (prevBtn) prevBtn.addEventListener('click', () => handleUserInteraction(prevSlide));
    if (nextBtn) nextBtn.addEventListener('click', () => handleUserInteraction(nextSlide));
    dots.forEach((dot, index) => { dot.addEventListener('click', () => handleUserInteraction(() => goToSlide(index))); });

    let touchStartX = 0;
    slider.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    slider.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) handleUserInteraction(() => diff > 0 ? nextSlide() : prevSlide());
    }, { passive: true });

    slider.addEventListener('mouseenter', stopAutoPlay);
    slider.addEventListener('mouseleave', startAutoPlay);
    startAutoPlay();
  }, []);

  return null;
}
