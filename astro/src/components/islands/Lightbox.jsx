import { useEffect } from 'preact/hooks';

export default function Lightbox() {
  useEffect(() => {
    window.openLightbox = function(images, startIndex) {
      const lightbox = document.getElementById('lightbox');
      const lightboxImg = document.getElementById('lightboxImg');
      const currentSpan = document.getElementById('lightboxCurrent');
      const totalSpan = document.getElementById('lightboxTotal');
      if (!lightbox || !lightboxImg) return;

      window.lightboxImages = [];
      images.forEach(img => { window.lightboxImages.push({ src: img.src, alt: img.alt }); });
      window.currentLightboxIndex = startIndex || 0;
      window.totalLightboxImages = window.lightboxImages.length;
      if (totalSpan) totalSpan.textContent = window.totalLightboxImages;
      updateLightboxImage();
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    window.updateLightboxImage = function() {
      const lightboxImg = document.getElementById('lightboxImg');
      const currentSpan = document.getElementById('lightboxCurrent');
      if (!lightboxImg || !window.lightboxImages || window.lightboxImages.length === 0) return;
      const image = window.lightboxImages[window.currentLightboxIndex];
      lightboxImg.src = image.src;
      lightboxImg.alt = image.alt;
      if (currentSpan) currentSpan.textContent = window.currentLightboxIndex + 1;
    };

    window.closeLightbox = function() {
      const lightbox = document.getElementById('lightbox');
      if (lightbox) { lightbox.classList.remove('active'); document.body.style.overflow = ''; }
    };

    window.nextLightbox = function() {
      if (!window.lightboxImages) return;
      window.currentLightboxIndex = (window.currentLightboxIndex + 1) % window.totalLightboxImages;
      updateLightboxImage();
    };

    window.prevLightbox = function() {
      if (!window.lightboxImages) return;
      window.currentLightboxIndex = (window.currentLightboxIndex - 1 + window.totalLightboxImages) % window.totalLightboxImages;
      updateLightboxImage();
    };

    const lightbox = document.getElementById('lightbox');
    const closeBtn = lightbox?.querySelector('.lightbox-close');
    const prevBtn = lightbox?.querySelector('.lightbox-nav.prev');
    const nextBtn = lightbox?.querySelector('.lightbox-nav.next');
    const backdrop = lightbox?.querySelector('.lightbox-backdrop');

    if (closeBtn) closeBtn.addEventListener('click', window.closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', window.prevLightbox);
    if (nextBtn) nextBtn.addEventListener('click', window.nextLightbox);
    if (backdrop) backdrop.addEventListener('click', window.closeLightbox);

    document.addEventListener('keydown', (e) => {
      if (!lightbox || !lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') window.closeLightbox();
      if (e.key === 'ArrowLeft') window.prevLightbox();
      if (e.key === 'ArrowRight') window.nextLightbox();
    });

    let touchStartX = 0, touchEndX = 0;
    if (lightbox) {
      lightbox.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
      lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) { if (diff > 0) window.nextLightbox(); else window.prevLightbox(); }
      }, { passive: true });
    }
  }, []);

  return null;
}
