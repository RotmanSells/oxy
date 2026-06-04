import { useEffect } from 'preact/hooks';

export default function SupplyCarousel() {
  useEffect(() => {
    const selectors = ['.supply-visual', '.tourism-visual'];
    selectors.forEach(selector => {
      const visuals = document.querySelectorAll(selector);
      visuals.forEach(visual => {
        const images = visual.querySelectorAll('img');
        if (images.length <= 1) return;
        let currentIndex = 0;
        let autoPlayInterval;

        function showImage(index) {
          images.forEach((img, i) => { img.classList.toggle('active', i === index); });
        }

        function nextImage() {
          currentIndex = (currentIndex + 1) % images.length;
          showImage(currentIndex);
        }

        function startAutoPlay() { autoPlayInterval = setInterval(nextImage, 2000); }

        visual.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
        visual.addEventListener('mouseleave', startAutoPlay);
        visual.addEventListener('click', () => {
          const card = visual.closest('.supply-card, .tourism-card');
          const cardImages = card.querySelectorAll('.supply-visual img, .tourism-visual img');
          if (window.openLightbox) window.openLightbox(cardImages, currentIndex);
        });

        startAutoPlay();
      });
    });
  }, []);

  return null;
}
