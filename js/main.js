// ========================================
//   UTILITIES
// ========================================
const Utils = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    rafThrottle(func) {
        let rafId = null;
        return function(...args) {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                func.apply(this, args);
                rafId = null;
            });
        };
    },

    qs(selector, parent = document) {
        return parent.querySelector(selector);
    },

    qsa(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    },

    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    loadImage(src) {
        return new Promise((resolve, reject) => {
            if (!src) {
                reject(new Error('Image source is empty'));
                return;
            }
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    t(key, fallback = '') {
        const lang = document.documentElement.lang || 'ru';
        try {
            if (typeof translations !== 'undefined' && translations[lang]?.[key] !== undefined) {
                return translations[lang][key];
            }
            if (typeof translations !== 'undefined' && translations.ru?.[key] !== undefined) {
                return translations.ru[key];
            }
        } catch (err) {
        }
        return fallback || key;
    }
};

// ========================================
//   IMAGE LOADING MANAGER
// ========================================
class ImageLoadingManager {
    constructor() {
        this.cache = new Map();
        this.loadedSources = new Set();
        this.sectionOrder = [];
        this.sectionSources = new Map();
        this.sectionObserver = null;
        this.nearViewportObserver = null;
        this.abortController = new AbortController();
        this.init();
    }

    init() {
        this.collectSectionSources();
        this.prioritizeInitialImages();
        this.preloadCriticalImages();
        this.setupSectionPreloadObserver();
        this.setupNearViewportObserver();
        this.preloadWhenIdle(() => this.preloadInitialWindow());
    }

    applyDeferredBackground(element) {
        const bgSrc = element?.dataset?.bgSrc;
        if (!bgSrc || element.style.backgroundImage) return;

        element.style.backgroundImage = `url('${bgSrc}')`;
    }

    collectSectionSources() {
        this.sectionOrder = Utils.qsa('section[id]').map(section => section.id);
        this.sectionSources.clear();

        this.sectionOrder.forEach(sectionId => {
            const sources = new Set();

            Utils.qsa(`[data-section="${sectionId}"]`).forEach(element => {
                this.getElementImageSources(element).forEach(src => sources.add(src));
                Utils.qsa('img, [style*="background-image"], [data-bg-src]', element).forEach(child => {
                    this.getElementImageSources(child).forEach(src => sources.add(src));
                });
            });

            const section = document.getElementById(sectionId);
            if (section) {
                Utils.qsa('img, [style*="background-image"], [data-bg-src]', section).forEach(element => {
                    this.getElementImageSources(element).forEach(src => sources.add(src));
                });
            }

            this.sectionSources.set(sectionId, Array.from(sources));
        });
    }

    prioritizeInitialImages() {
        const criticalImages = Utils.qsa('.section-img.active img, .section-img[data-section="hero"] img, .section-img[data-section="about"] img');

        criticalImages.forEach(img => {
            img.loading = 'eager';
            img.fetchPriority = 'high';
            if (!img.decoding || img.closest('.section-img')?.dataset.section !== 'hero') {
                img.decoding = 'async';
            }
        });
    }

    preloadCriticalImages() {
        this.preloadSectionById('hero', { priority: 'high' });
        this.preloadSectionById('about', { priority: 'high' });
    }

    preloadInitialWindow() {
        this.sectionOrder.slice(0, 3).forEach(sectionId => {
            this.preloadSectionById(sectionId, { priority: 'low' });
        });
    }

    setupSectionPreloadObserver() {
        if (!('IntersectionObserver' in window)) {
            this.preloadAllInBackground();
            return;
        }

        this.sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const sectionId = entry.target.id;
                this.preloadSectionNeighborhood(sectionId);
            });
        }, { rootMargin: '125% 0px 125% 0px', threshold: 0.01 });

        Utils.qsa('section[id]').forEach(section => this.sectionObserver.observe(section));
    }

    setupNearViewportObserver() {
        if (!('IntersectionObserver' in window)) return;

        this.nearViewportObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                this.getElementImageSources(entry.target).forEach(src => {
                    this.preload(src, { priority: 'low' });
                });

                this.nearViewportObserver.unobserve(entry.target);
            });
        }, { rootMargin: '900px 0px', threshold: 0.01 });

        Utils.qsa('img[loading="lazy"], [style*="background-image"], [data-bg-src]').forEach(element => {
            if (element.closest('.bg-slider, .section-images-layer')) return;
            this.nearViewportObserver.observe(element);
        });
    }

    preloadSectionNeighborhood(sectionId) {
        const index = this.sectionOrder.indexOf(sectionId);
        if (index === -1) return;

        [index - 1, index, index + 1, index + 2].forEach(sectionIndex => {
            const nextSectionId = this.sectionOrder[sectionIndex];
            if (nextSectionId) this.preloadSectionById(nextSectionId, { priority: 'low' });
        });
    }

    preloadSectionById(sectionId, options = {}) {
        const sources = this.sectionSources.get(sectionId) || [];
        sources.forEach(src => this.preload(src, options));
    }

    preloadAllInBackground() {
        this.preloadWhenIdle(() => {
            this.sectionOrder.forEach(sectionId => this.preloadSectionById(sectionId, { priority: 'low' }));
        });
    }

    preload(src, options = {}) {
        const normalizedSrc = this.normalizeSrc(src);
        if (!normalizedSrc) return Promise.resolve();
        if (this.cache.has(normalizedSrc)) return this.cache.get(normalizedSrc);

        const promise = new Promise(resolve => {
            const img = new Image();
            if ('fetchPriority' in img) img.fetchPriority = options.priority || 'low';
            img.decoding = 'async';
            img.onload = () => {
                this.loadedSources.add(normalizedSrc);
                resolve(true);
            };
            img.onerror = () => resolve(false);
            img.src = normalizedSrc;
        });

        this.cache.set(normalizedSrc, promise);
        return promise;
    }

    isLoaded(src) {
        const normalizedSrc = this.normalizeSrc(src);
        if (!normalizedSrc) return true;
        return this.loadedSources.has(normalizedSrc);
    }

    async ensureSectionReady(sectionId) {
        if (!sectionId) return true;

        const sources = this.sectionSources.get(sectionId) || [];
        if (!sources.length) return true;

        const results = await Promise.all(sources.map(src => this.preload(src)));
        return results.some(Boolean);
    }

    async ensureElementReady(element) {
        if (!element) return true;

        const sources = new Set(this.getElementImageSources(element));
        Utils.qsa('img, [style*="background-image"], [data-bg-src]', element).forEach(child => {
            this.getElementImageSources(child).forEach(src => sources.add(src));
        });

        if (!sources.size) return true;

        const results = await Promise.all(Array.from(sources).map(src => this.preload(src)));
        const isReady = results.some(Boolean);

        if (isReady) {
            this.applyDeferredBackground(element);
            Utils.qsa('[data-bg-src]', element).forEach(child => this.applyDeferredBackground(child));
        }

        return isReady;
    }

    refresh() {
        this.collectSectionSources();
        this.prioritizeInitialImages();
        this.preloadCriticalImages();

        if (this.nearViewportObserver) {
            Utils.qsa('img[loading="lazy"], [style*="background-image"], [data-bg-src]').forEach(element => {
                if (element.closest('.bg-slider, .section-images-layer')) return;
                this.nearViewportObserver.observe(element);
            });
        }
    }

    getElementImageSources(element) {
        const sources = new Set();

        if (element.matches?.('img')) {
            const src = element.currentSrc || element.getAttribute('src');
            if (src) sources.add(src);
        }

        const inlineBackground = element.style?.backgroundImage;
        this.extractBackgroundSources(inlineBackground).forEach(src => sources.add(src));

        const deferredBackground = element.dataset?.bgSrc;
        if (deferredBackground) sources.add(deferredBackground);

        return Array.from(sources);
    }

    extractBackgroundSources(backgroundImage) {
        if (!backgroundImage || backgroundImage === 'none') return [];

        return Array.from(backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g))
            .map(match => match[1])
            .filter(Boolean);
    }

    normalizeSrc(src) {
        const cleanSrc = String(src || '').trim();
        if (!cleanSrc || cleanSrc.startsWith('data:')) return '';

        try {
            return new URL(cleanSrc, window.location.href).href;
        } catch (err) {
            return cleanSrc;
        }
    }

    preloadWhenIdle(callback) {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(callback, { timeout: 1500 });
            return;
        }

        window.setTimeout(callback, 250);
    }

    destroy() {
        this.abortController.abort();
        if (this.sectionObserver) this.sectionObserver.disconnect();
        if (this.nearViewportObserver) this.nearViewportObserver.disconnect();
    }
}

// ========================================
//   PRELOADER
// ========================================
class Preloader {
    constructor(onComplete) {
        this.onComplete = onComplete;
        this.preloader = Utils.qs('#preloader');
        this.bar = Utils.qs('#preloaderBar');
        this.percent = Utils.qs('#preloaderPercent');
        this.text = Utils.qs('#preloaderText');
        
        this.phrases = [
            'Укладываем фундамент',
            'Возводим каркас',
            'Проектируем пространство',
            'Инвестируем в детали',
            'Финишная отделка',
            'Запускаем системы',
            'Вводим объект',
            'Добро пожаловать'
        ];
        
        this.hasSeenPreloader = false;
        try {
            this.hasSeenPreloader = sessionStorage.getItem('preloaderSeen') === '1';
        } catch (err) {
            this.hasSeenPreloader = false;
        }

        this.minDuration = Utils.prefersReducedMotion() ? 350 : (this.hasSeenPreloader ? 900 : 2400);
        this.phraseDuration = this.minDuration / this.phrases.length;
        this.progress = 0;
        this.resourcesLoaded = false;
        this.startTime = null;
        this.animationFrame = null;
        this.currentPhraseIndex = -1;
        this.fallbackTimeout = null;
        
        this.init();
    }
    
    init() {
        document.body.classList.add('loading');
        this.trackResources();
        this.startAnimation();
        
        // Fallback to prevent infinite loading if resources hang
        this.fallbackTimeout = setTimeout(() => {
            this.resourcesLoaded = true;
        }, 3500);
    }
    
    trackResources() {
        const resources = [];
        
        Utils.qsa('img[loading="eager"], img[fetchpriority="high"], .section-img.active img').forEach(img => {
            if (!img.complete) {
                resources.push(
                    new Promise(resolve => {
                        img.addEventListener('load', resolve, { once: true });
                        img.addEventListener('error', resolve, { once: true });
                    })
                );
            }
        });
        
        Utils.qsa('[style*="background-image"].active, .hero [style*="background-image"]').forEach(el => {
            const bg = window.getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none') {
                const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
                if (match) {
                    resources.push(Utils.loadImage(match[1]).catch(() => {}));
                }
            }
        });
        
        resources.push(new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve, { once: true });
            }
        }));
        
        Promise.all(resources).then(() => {
            this.resourcesLoaded = true;
        });
    }
    
    startAnimation() {
        const animate = (timestamp) => {
            if (!this.startTime) this.startTime = timestamp;
            const elapsed = timestamp - this.startTime;
            const timeProgress = Math.min(elapsed / this.minDuration, 1);
            
            this.progress = Math.round(timeProgress * 100);
            
            if (this.bar) this.bar.style.width = `${this.progress}%`;
            if (this.percent) this.percent.textContent = `${this.progress}%`;
            
            const newPhraseIndex = Math.min(Math.floor(elapsed / this.phraseDuration), this.phrases.length - 1);
            if (newPhraseIndex !== this.currentPhraseIndex) {
                this.currentPhraseIndex = newPhraseIndex;
                if (this.text) this.text.textContent = this.phrases[this.currentPhraseIndex];
            }
            
            if (timeProgress < 1 || !this.resourcesLoaded) {
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                this.finish();
            }
        };
        
        this.animationFrame = requestAnimationFrame(animate);
    }
    
    finish() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.fallbackTimeout) {
            clearTimeout(this.fallbackTimeout);
        }
        
        this.progress = 100;
        if (this.bar) this.bar.style.width = '100%';
        if (this.percent) this.percent.textContent = '100%';
        if (this.text) this.text.textContent = this.phrases[this.phrases.length - 1];
        
        setTimeout(() => {
            if (this.preloader) {
                this.preloader.classList.add('hidden');
            }
            document.body.classList.remove('loading');
            try {
                sessionStorage.setItem('preloaderSeen', '1');
            } catch (err) {
            }
            
            if (typeof this.onComplete === 'function') {
                this.onComplete();
            }
        }, 900);
    }
}

// ========================================
//   HERO FACTS ANIMATION
// ========================================
class HeroFacts {
    constructor() {
        this.numbers = Utils.qsa('.stat-number[data-count]');
        this.observer = null;
        this.init();
    }
    
    init() {
        if (!this.numbers.length) return;
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateNumber(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        this.numbers.forEach(el => this.observer.observe(el));
    }
    
    animateNumber(el) {
        const target = parseInt(el.dataset.count, 10);
        if (isNaN(target)) return;
        
        const suffix = el.dataset.suffix || '';
        const duration = Utils.prefersReducedMotion() ? 0 : 2000;
        let startTime = null;
        
        const update = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 2);
            const current = Math.round(target * ease);
            
            el.textContent = current + suffix;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        if (duration === 0) {
            el.textContent = target + suffix;
        } else {
            requestAnimationFrame(update);
        }
    }
    
    destroy() {
        if (this.observer) this.observer.disconnect();
    }
}

// ========================================
//   SECTION IMAGES SLIDER
// ========================================
class SectionImagesSlider {
    constructor() {
        this.images = Utils.qsa('.section-img');
        this.sections = Utils.qsa('section[id]');
        this.currentImage = -1; // Changed to -1 to force initial activation
        this.pendingImageRequest = 0;
        this.imagesMap = new Map();
        this.observer = null;
        this.init();
    }
    
    init() {
        if (!this.images.length || !this.sections.length) return;
        
        this.images.forEach((img, index) => {
            const sectionId = img.dataset.section;
            if (sectionId) this.imagesMap.set(sectionId, index);
        });
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    if (this.imagesMap.has(id)) {
                        this.goToImage(this.imagesMap.get(id));
                    }
                }
            });
        }, { threshold: 0, rootMargin: '-35% 0px -35% 0px' });
        
        this.sections.forEach(section => this.observer.observe(section));
    }

    goToImage(index) {
        if (index === this.currentImage || !this.images[index]) return;

        const targetImage = this.images[index];
        const sectionId = targetImage.dataset.section;
        const requestId = ++this.pendingImageRequest;
        const loader = window.app?.components?.imageLoadingManager;

        if (loader) {
            if (sectionId) loader.preloadSectionNeighborhood(sectionId);

            loader.ensureElementReady(targetImage).then(isReady => {
                if (requestId !== this.pendingImageRequest || !isReady) return;
                this.activateImage(index);
            });
            return;
        }

        this.activateImage(index);
    }

    activateImage(index) {
        if (this.currentImage >= 0 && this.images[this.currentImage]) {
            this.images[this.currentImage].classList.remove('active');
        } else {
            this.images.forEach((image, imageIndex) => {
                if (imageIndex !== index) image.classList.remove('active');
            });
        }
        
        this.currentImage = index;
        this.images[this.currentImage].classList.add('active');
    }
    
    destroy() {
        if (this.observer) this.observer.disconnect();
    }
}

// ========================================
//   BACKGROUND SLIDER
// ========================================
class BackgroundSlider {
    constructor() {
        this.slides = Utils.qsa('.slide');
        this.sections = Utils.qsa('section[id]');
        this.currentSlide = -1; // Changed to -1 to force initial activation
        this.pendingSlideRequest = 0;
        this.slidesMap = new Map();
        this.observer = null;
        this.init();
    }
    
    init() {
        if (!this.slides.length || !this.sections.length) return;
        
        this.slides.forEach((slide, index) => {
            const sectionId = slide.dataset.section;
            if (sectionId) this.slidesMap.set(sectionId, index);
        });
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    if (this.slidesMap.has(id)) {
                        this.goToSlide(this.slidesMap.get(id));
                    }
                }
            });
        }, { threshold: 0.4, rootMargin: '-10% 0px -40% 0px' });
        
        this.sections.forEach(section => this.observer.observe(section));
    }

    goToSlide(index) {
        if (index === this.currentSlide || !this.slides[index]) return;

        const targetSlide = this.slides[index];
        const sectionId = targetSlide.dataset.section;
        const requestId = ++this.pendingSlideRequest;
        const loader = window.app?.components?.imageLoadingManager;

        if (loader) {
            if (sectionId) loader.preloadSectionNeighborhood(sectionId);

            loader.ensureElementReady(targetSlide).then(isReady => {
                if (requestId !== this.pendingSlideRequest || !isReady) return;
                this.activateSlide(index);
            });
            return;
        }

        this.activateSlide(index);
    }

    activateSlide(index) {
        if (this.currentSlide >= 0 && this.slides[this.currentSlide]) {
            this.slides[this.currentSlide].classList.remove('active');
        } else {
            this.slides.forEach((slide, slideIndex) => {
                if (slideIndex !== index) slide.classList.remove('active');
            });
        }
        
        this.currentSlide = index;
        this.slides[this.currentSlide].classList.add('active');
    }
    
    destroy() {
        if (this.observer) this.observer.disconnect();
    }
}

// ========================================
//   HEADER SCROLL
// ========================================
class HeaderScroll {
    constructor() {
        this.header = Utils.qs('#header');
        this.scrollThreshold = 50;
        this.abortController = new AbortController();
        this.init();
    }
    
    init() {
        if (!this.header) return;
        
        window.addEventListener('scroll', Utils.rafThrottle(() => this.update()), { 
            passive: true, 
            signal: this.abortController.signal 
        });
        this.update();
    }
    
    update() {
        const currentScroll = window.scrollY;
        this.header.classList.toggle('scrolled', currentScroll > this.scrollThreshold);
    }

    destroy() {
        this.abortController.abort();
    }
}

// ========================================
//   MOBILE MENU
// ========================================
class MobileMenu {
    constructor() {
        this.toggle = Utils.qs('.menu-toggle');
        this.nav = Utils.qs('.main-nav');
        this.links = this.nav ? Utils.qsa('.nav-link', this.nav) : [];
        this.isOpen = false;
        this.abortController = new AbortController();
        this.previouslyFocused = null;
        this.init();
    }
    
    init() {
        if (!this.toggle || !this.nav) return;
        
        const signal = this.abortController.signal;
        
        this.toggle.addEventListener('click', () => this.toggleMenu(), { signal });
        
        this.links.forEach(link => {
            link.addEventListener('click', () => this.closeMenu(), { signal });
        });
        
        document.addEventListener('keydown', (e) => this.handleKeydown(e), { signal });
        
        window.addEventListener('resize', Utils.debounce(() => {
            if (window.innerWidth > 1024 && this.isOpen) this.closeMenu();
        }, 250), { signal });
    }
    
    toggleMenu() {
        this.isOpen = !this.isOpen;
        this.nav.classList.toggle('active', this.isOpen);
        this.toggle.setAttribute('aria-expanded', String(this.isOpen));
        this.toggle.setAttribute('aria-label', this.isOpen ? 'Закрыть меню' : 'Открыть меню');

        if (this.isOpen) {
            this.previouslyFocused = document.activeElement;
            const firstLink = this.links[0];
            if (firstLink) firstLink.focus({ preventScroll: true });
        } else {
            this.returnFocus();
        }
    }
    
    closeMenu({ returnFocus = false } = {}) {
        this.isOpen = false;
        this.nav.classList.remove('active');
        this.toggle.setAttribute('aria-expanded', 'false');
        this.toggle.setAttribute('aria-label', 'Открыть меню');
        if (returnFocus) this.returnFocus();
    }

    handleKeydown(e) {
        if (!this.isOpen) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeMenu({ returnFocus: true });
            return;
        }

        if (e.key !== 'Tab') return;

        const focusable = this.getFocusable();
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus({ preventScroll: true });
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus({ preventScroll: true });
        }
    }

    getFocusable() {
        return Utils.qsa('a[href], button:not([disabled])', this.nav).filter(el => el.offsetParent !== null);
    }

    returnFocus() {
        const target = this.previouslyFocused instanceof HTMLElement ? this.previouslyFocused : this.toggle;
        if (target) target.focus({ preventScroll: true });
    }

    destroy() {
        this.abortController.abort();
    }
}

// ========================================
//   SMOOTH SCROLL
// ========================================
class SmoothScroll {
    constructor() {
        this.links = Utils.qsa('a[href^="#"]');
        this.abortController = new AbortController();
        this.init();
    }
    
    init() {
        const signal = this.abortController.signal;
        this.links.forEach(link => {
            link.addEventListener('click', (e) => this.handleClick(e, link), { signal });
        });
    }
    
    handleClick(e, link) {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        
        const target = Utils.qs(href);
        if (!target) return;
        
        e.preventDefault();
        
        const header = Utils.qs('#header');
        const offset = header ? header.offsetHeight : 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.scrollY - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: Utils.prefersReducedMotion() ? 'auto' : 'smooth'
        });

        if (target.hasAttribute('tabindex')) {
            target.focus({ preventScroll: true });
        }
    }

    destroy() {
        this.abortController.abort();
    }
}

// ========================================
//   PARALLAX
// ========================================
class Parallax {
    constructor() {
        this.bgSlider = Utils.qs('.bg-slider');
        this.abortController = new AbortController();
        this.init();
    }
    
    init() {
        if (!this.bgSlider || Utils.prefersReducedMotion()) return;
        
        window.addEventListener('scroll', Utils.rafThrottle(() => this.update()), { 
            passive: true, 
            signal: this.abortController.signal 
        });
    }
    
    update() {
        const scrolled = window.scrollY;
        if (scrolled < window.innerHeight) {
            this.bgSlider.style.transform = `translateY(${scrolled * 0.4}px)`;
        }
    }

    destroy() {
        this.abortController.abort();
    }
}

// ========================================
//   SCROLL ANIMATIONS
// ========================================
class ScrollAnimations {
    constructor() {
        this.selectors = [
            '.section-header', '.about-grid', '.project-card',
            '.service-card', '.advantage-item', '.cta-content', '.stat-item'
        ];
        this.elements = [];
        this.observer = null;
        this.init();
    }
    
    init() {
        if (Utils.prefersReducedMotion()) return;
        
        this.selectors.forEach(selector => {
            this.elements.push(...Utils.qsa(selector));
        });
        
        if (!this.elements.length) return;
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    this.observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
        
        this.elements.forEach((el, index) => {
            el.classList.add('reveal');
            el.style.transitionDelay = `${(index % 4) * 0.1}s`;
            this.observer.observe(el);
        });
    }
    
    destroy() {
        if (this.observer) this.observer.disconnect();
    }
}

// ========================================
//   ACTIVE NAV
// ========================================
class ActiveNav {
    constructor() {
        this.sections = Utils.qsa('section[id]');
        this.navLinks = Utils.qsa('.nav-link');
        this.observer = null;
        this.init();
    }
    
    init() {
        if (!this.sections.length || !this.navLinks.length) return;
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    this.navLinks.forEach(link => {
                        const isActive = link.getAttribute('href') === `#${id}`;
                        link.classList.toggle('active', isActive);
                        if (isActive) {
                            link.setAttribute('aria-current', 'page');
                        } else {
                            link.removeAttribute('aria-current');
                        }
                    });
                }
            });
        }, { threshold: 0.3, rootMargin: '-10% 0px -40% 0px' });
        
        this.sections.forEach(section => this.observer.observe(section));
    }
    
    destroy() {
        if (this.observer) this.observer.disconnect();
    }
}

// ========================================
//   SCROLL INDICATOR
// ========================================
class ScrollIndicator {
    constructor() {
        this.indicator = Utils.qs('.scroll-indicator');
        this.abortController = new AbortController();
        this.init();
    }
    
    init() {
        if (!this.indicator) return;
        
        this.indicator.addEventListener('click', () => {
            const aboutSection = Utils.qs('#about');
            if (aboutSection) {
                aboutSection.scrollIntoView({ 
                    behavior: Utils.prefersReducedMotion() ? 'auto' : 'smooth' 
                });
            }
        }, { signal: this.abortController.signal });
    }

    destroy() {
        this.abortController.abort();
    }
}


// ========================================
//   SITE ANALYTICS
// ========================================
class DynamicContent {
    constructor() {
        this.apiBase = this.getApiBase();
        this.abortController = new AbortController();
        this.init();
    }

    init() {
        if (!this.apiBase || this.getLanguage() !== 'ru') return;
        this.load();
    }

    getApiBase() {
        const explicitBase = String(window.API_BASE || '').trim();
        if (explicitBase) return explicitBase.replace(/\/$/, '');

        const apiUrl = String(window.API_URL || '').trim();
        if (!apiUrl || apiUrl === '#' || /your-api|example\.com|localhost:3000\/api\/contact/i.test(apiUrl)) return '';
        return apiUrl.replace(/\/api\/contact\/?$/, '').replace(/\/$/, '');
    }

    getLanguage() {
        return (document.documentElement.lang || 'ru').toLowerCase().slice(0, 2);
    }

    async load() {
        try {
            const response = await fetch(`${this.apiBase}/api/content`, {
                method: 'GET',
                signal: this.abortController.signal,
            });
            if (!response.ok) return;

            const data = await response.json();
            if (!data || data.ok !== true) return;

            this.applyContent(data.content || {});
            this.applyMedia(data.media || {});
        } catch (err) {
        }
    }

    applyContent(content) {
        Utils.qsa('[data-content]').forEach((element) => {
            const key = element.getAttribute('data-content');
            const item = key && content[key];
            if (!item || typeof item.value !== 'string' || !item.value.trim()) return;

            this.applyText(element, key, item.value);
            this.applyContactHref(element, key, item.value);
        });
    }

    applyText(element, key, value) {
        if (key === 'hero_title') {
            const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const titleLines = Utils.qsa('.title-line', element);
            if (titleLines.length) {
                titleLines.forEach((lineElement, index) => {
                    lineElement.textContent = lines[index] || '';
                });
                return;
            }
        }

        if (element.matches('a')) {
            const label = element.querySelector('span[data-i18n]');
            if (label) label.textContent = this.getContactLabel(key, value);
            return;
        }

        element.textContent = value;
    }

    applyContactHref(element, key, value) {
        if (!element.matches('a')) return;

        if (key === 'contacts_phone') {
            element.href = `tel:${this.normalizePhone(value)}`;
            element.textContent = value;
        }

        if (key === 'contacts_telegram') {
            element.href = this.toTelegramUrl(value);
        }

        if (key === 'contacts_whatsapp') {
            element.href = this.toWhatsappUrl(value);
        }
    }

    getContactLabel(key, value) {
        if (key === 'contacts_telegram') return 'Telegram';
        if (key === 'contacts_whatsapp') return 'WhatsApp';
        return value;
    }

    normalizePhone(value) {
        const trimmed = String(value || '').trim();
        const plus = trimmed.startsWith('+') ? '+' : '';
        return plus + trimmed.replace(/\D/g, '');
    }

    toTelegramUrl(value) {
        const trimmed = String(value || '').trim();
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `https://t.me/${trimmed.replace(/^@/, '')}`;
    }

    toWhatsappUrl(value) {
        const trimmed = String(value || '').trim();
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `https://wa.me/${trimmed.replace(/\D/g, '')}`;
    }

    applyMedia(media) {
        Utils.qsa('[data-media-src]').forEach((element) => {
            const key = element.getAttribute('data-media-src');
            const item = key && media[key];
            if (item && item.publicUrl && element.matches('img')) {
                element.src = this.resolvePublicUrl(item.publicUrl);
            }
        });

        Utils.qsa('[data-media-bg]').forEach((element) => {
            const key = element.getAttribute('data-media-bg');
            const item = key && media[key];
            if (item && item.publicUrl) {
                const publicUrl = this.resolvePublicUrl(item.publicUrl);

                if (element.dataset.bgSrc !== undefined && !element.classList.contains('active')) {
                    element.dataset.bgSrc = publicUrl;
                    element.style.removeProperty('background-image');
                    return;
                }

                element.style.backgroundImage = `url('${publicUrl}')`;
            }
        });

        window.app?.components?.imageLoadingManager?.refresh();
    }

    resolvePublicUrl(url) {
        if (/^https?:\/\//i.test(url)) return url;
        return `${this.apiBase}${String(url).startsWith('/') ? '' : '/'}${url}`;
    }

    destroy() {
        this.abortController.abort();
    }
}

class SiteAnalytics {
    constructor() {
        this.apiBase = this.getApiBase();
        this.sessionId = this.getSessionId();
        this.abortController = new AbortController();
        this.maxScrollDepth = 0;
        this.sentScrollDepths = new Set();
        this.sectionObserver = null;
        window.siteAnalytics = this;
        this.init();
    }

    init() {
        if (!this.apiBase) return;

        this.sendVisit();
        this.bindClicks();
        this.bindLanguageChanges();
        this.trackSections();
        this.trackScrollDepth();
    }

    getApiBase() {
        const explicitBase = String(window.API_BASE || '').trim();
        if (explicitBase) return explicitBase.replace(/\/$/, '');

        const apiUrl = String(window.API_URL || '').trim();
        if (!apiUrl || apiUrl === '#' || /your-api|example\.com/i.test(apiUrl)) return '';
        return apiUrl.replace(/\/api\/contact\/?$/, '').replace(/\/$/, '');
    }

    getSessionId() {
        try {
            const key = 'integra_session_id';
            const existing = sessionStorage.getItem(key);
            if (existing) return existing;
            const next = (crypto.randomUUID && crypto.randomUUID()) || `s_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            sessionStorage.setItem(key, next);
            return next;
        } catch (err) {
            return `s_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        }
    }

    sendVisit() {
        this.post('/api/visit', {
            sessionId: this.sessionId,
            path: location.pathname + location.search,
            referrer: document.referrer,
            language: document.documentElement.lang || navigator.language || 'ru',
            screenWidth: window.screen && window.screen.width,
            screenHeight: window.screen && window.screen.height,
        });
    }

    track(eventType, data = {}) {
        if (!this.apiBase) return;
        this.post('/api/events', {
            sessionId: this.sessionId,
            eventType,
            path: location.pathname + location.search,
            ...data,
        });
    }

    post(endpoint, payload) {
        const url = `${this.apiBase}${endpoint}`;
        const body = JSON.stringify(payload);

        if (navigator.sendBeacon) {
            try {
                const blob = new Blob([body], { type: 'application/json' });
                if (navigator.sendBeacon(url, blob)) return;
            } catch (err) {
            }
        }

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
            signal: this.abortController.signal,
        }).catch(() => {});
    }

    bindClicks() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest && event.target.closest('a, button');
            if (!link) return;

            const href = link.getAttribute('href') || '';
            const label = (link.innerText || link.getAttribute('aria-label') || href || link.className || 'click').trim().slice(0, 120);
            const section = link.closest('section')?.id || '';

            if (/t\.me|telegram/i.test(href) || link.classList.contains('telegram')) {
                this.track('messenger_click', { eventName: 'telegram', section, label, value: href });
            } else if (/wa\.me|whatsapp/i.test(href) || link.classList.contains('whatsapp')) {
                this.track('messenger_click', { eventName: 'whatsapp', section, label, value: href });
            } else if (/^tel:/i.test(href)) {
                this.track('phone_click', { eventName: 'phone', section, label, value: href });
            } else if (link.matches('a[href^="#"], .cta-button, .form-submit, button')) {
                this.track('cta_click', { eventName: 'cta', section, label, value: href });
            }
        }, { signal: this.abortController.signal });
    }

    bindLanguageChanges() {
        document.addEventListener('click', (event) => {
            const button = event.target.closest && event.target.closest('[data-lang]');
            if (!button) return;
            this.track('language_change', {
                eventName: 'language',
                label: button.getAttribute('data-lang') || '',
            });
        }, { signal: this.abortController.signal });
    }

    trackSections() {
        if (!('IntersectionObserver' in window)) return;

        this.sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting || entry.intersectionRatio < 0.45) return;
                const section = entry.target.id || entry.target.getAttribute('data-section') || '';
                if (!section) return;
                this.track('section_view', { eventName: 'section', section, label: section });
            });
        }, { threshold: 0.45 });

        Utils.qsa('section[id]').forEach(section => this.sectionObserver.observe(section));
    }

    trackScrollDepth() {
        const handler = Utils.throttle(() => {
            const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
            const depth = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
            this.maxScrollDepth = Math.max(this.maxScrollDepth, depth);

            [25, 50, 75, 90, 100].forEach(mark => {
                if (this.maxScrollDepth >= mark && !this.sentScrollDepths.has(mark)) {
                    this.sentScrollDepths.add(mark);
                    this.track('scroll_depth', { eventName: 'scroll', value: String(mark) });
                }
            });
        }, 1000);

        window.addEventListener('scroll', handler, { passive: true, signal: this.abortController.signal });
        handler();
    }

    destroy() {
        if (this.sectionObserver) this.sectionObserver.disconnect();
        this.abortController.abort();
    }
}

// ========================================
//   CONTACT FORM
// ========================================
class ContactForm {
    constructor() {
        this.form = Utils.qs('#contactForm');
        this.submitBtn = this.form ? Utils.qs('.form-submit', this.form) : null;
        this.submitLabel = this.submitBtn ? Utils.qs('span', this.submitBtn) : null;
        this.status = Utils.qs('#formStatus');
        this.activeRequest = null;
        this.abortController = new AbortController();
        this.init();
    }
    
    init() {
        if (!this.form || !this.submitBtn) return;
        
        const signal = this.abortController.signal;
        this.form.addEventListener('submit', (e) => this.handleSubmit(e), { signal });
        this.submitBtn.addEventListener('click', (e) => this.handleSubmit(e), { signal });
        this.form.addEventListener('input', Utils.debounce(() => this.validate(), 300), { signal });
    }
    
    validate() {
        const inputs = Utils.qsa('input, textarea, select', this.form);
        let isValid = true;
        
        inputs.forEach(input => {
            const invalid = this.getFieldError(input);
            input.classList.toggle('invalid', invalid);
            input.setAttribute('aria-invalid', String(invalid));
            this.toggleFieldError(input, invalid);
            if (invalid) isValid = false;
        });
        
        return isValid;
    }

    getFieldError(input) {
        if (input.required && !input.value.trim()) return true;
        if (input.type === 'checkbox' && input.required) {
            return !input.checked;
        }
        if (input.type === 'email' && input.value.trim()) {
            return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
        }
        return false;
    }

    toggleFieldError(input, invalid) {
        const id = input.getAttribute('aria-describedby');
        if (!id) return;

        const error = Utils.qs(`#${id}`);
        if (!error) return;

        error.classList.toggle('active', invalid);
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validate()) {
            this.setStatus('form_validation_error', 'error', 'Пожалуйста, заполните обязательные поля корректно.');
            const firstInvalid = Utils.qs('.invalid', this.form);
            if (firstInvalid) firstInvalid.focus({ preventScroll: false });
            return;
        }
        
        const apiUrl = this.getApiUrl();

        if (!this.isApiConfigured(apiUrl)) {
            this.setStatus('form_fallback', 'info', 'Сейчас форма не подключена к API. Напишите нам в WhatsApp или Telegram — мы быстро ответим.');
            return;
        }

        const formData = new FormData(this.form);
        const payload = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            email: formData.get('email') || undefined,
            service: formData.get('service') || undefined,
            message: formData.get('message') || undefined,
            sessionId: window.siteAnalytics?.sessionId,
            path: location.pathname + location.search,
        };

        window.siteAnalytics?.track('form_submit_attempt', {
            eventName: 'contact_form',
            section: 'contact',
            label: payload.service || 'contact',
        });
        
        this.setSubmitting(true);
        this.setStatus('form_sending', 'info', 'Отправляем заявку...');
        const requestController = new AbortController();
        const timeoutId = setTimeout(() => requestController.abort(), 10000);
        this.activeRequest = requestController;
        
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: requestController.signal
            });

            const contentType = res.headers.get('content-type') || '';
            const data = contentType.includes('application/json') ? await res.json() : {};
            
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Server error');
            }

            window.siteAnalytics?.track('form_submit_success', {
                eventName: 'contact_form',
                section: 'contact',
                label: payload.service || 'contact',
            });
            this.form.reset();
            this.setButtonFeedback('success', 'form_success', 'ОТПРАВЛЕНО!');
            this.setStatus('form_success_message', 'success', 'Спасибо! Мы свяжемся с вами в течение 24 часов.');
        } catch (err) {
            console.error('Submit error:', err);
            window.siteAnalytics?.track('form_submit_error', {
                eventName: 'contact_form',
                section: 'contact',
                label: err.message || 'error',
            });
            const isTimeout = err.name === 'AbortError';
            this.setButtonFeedback('error', isTimeout ? 'form_timeout_button' : 'form_error_button', isTimeout ? 'ТАЙМАУТ' : 'ОШИБКА');
            this.setStatus(isTimeout ? 'form_timeout' : 'form_error', 'error', isTimeout ? 'Сервер не ответил вовремя. Попробуйте ещё раз или напишите в мессенджер.' : 'Не удалось отправить заявку. Попробуйте позже или напишите в мессенджер.');
        } finally {
            clearTimeout(timeoutId);
            this.activeRequest = null;
            setTimeout(() => this.resetButton(), 3000);
        }
    }

    getApiUrl() {
        return String(window.API_URL || '').trim();
    }

    isApiConfigured(apiUrl) {
        if (!apiUrl || apiUrl === '#') return false;
        return !/your-api|example\.com|localhost:3000\/api\/contact/i.test(apiUrl);
    }

    setSubmitting(isSubmitting) {
        this.submitBtn.disabled = isSubmitting;
        this.submitBtn.classList.remove('success', 'error');
        this.setSubmitText(isSubmitting ? Utils.t('form_sending', 'ОТПРАВКА...') : Utils.t('form_submit', 'ОТПРАВИТЬ ЗАЯВКУ'));
    }

    setButtonFeedback(className, key, fallback) {
        this.submitBtn.disabled = true;
        this.submitBtn.classList.remove('success', 'error');
        this.submitBtn.classList.add(className);
        this.setSubmitText(Utils.t(key, fallback));
    }

    resetButton() {
        this.submitBtn.disabled = false;
        this.submitBtn.classList.remove('success', 'error');
        this.setSubmitText(Utils.t('form_submit', 'ОТПРАВИТЬ ЗАЯВКУ'));
    }

    setSubmitText(text) {
        if (this.submitLabel) this.submitLabel.textContent = text;
    }

    setStatus(key, type, fallback) {
        if (!this.status) return;
        this.status.textContent = Utils.t(key, fallback);
        this.status.className = `form-status ${type || ''}`.trim();
    }

    destroy() {
        if (this.activeRequest) this.activeRequest.abort();
        this.abortController.abort();
    }
}

// ========================================
//   PHONE TOGGLE
// ========================================
class PhoneToggle {
    constructor() {
        this.toggle = Utils.qs('.phone-toggle');
        this.dropdown = Utils.qs('.phone-dropdown');
        this.isOpen = false;
        this.abortController = new AbortController();
        this.init();
    }
    
    init() {
        if (!this.toggle || !this.dropdown) return;
        
        const signal = this.abortController.signal;
        
        this.toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        }, { signal });
        
        document.addEventListener('click', (e) => {
            if (!this.toggle.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.closeDropdown();
            }
        }, { signal });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.closeDropdown();
        }, { signal });
    }
    
    toggleDropdown() {
        this.isOpen = !this.isOpen;
        this.dropdown.classList.toggle('active', this.isOpen);
        this.dropdown.hidden = !this.isOpen;
        this.toggle.setAttribute('aria-expanded', String(this.isOpen));
    }
    
    closeDropdown() {
        this.isOpen = false;
        this.dropdown.classList.remove('active');
        this.dropdown.hidden = true;
        this.toggle.setAttribute('aria-expanded', 'false');
    }

    destroy() {
        this.abortController.abort();
    }
}

// ========================================
//   SUPPLY CAROUSEL
// ========================================
class Carousel {
    constructor(visual) {
        this.visual = visual;
        this.items = Utils.qsa('img, video', visual);
        this.currentIndex = 0;
        this.timeoutId = null;
        this.isHovering = false;
        this.isVisible = false;
        this.observer = null;
        this.abortController = new AbortController();
        this.endedHandler = null;
        this.init();
    }

    init() {
        if (this.items.length <= 1) return;

        this.showItem(this.currentIndex);
        if (!Utils.prefersReducedMotion()) {
            this.setupVisibilityObserver();
        }

        const signal = this.abortController.signal;
        this.visual.addEventListener('mouseenter', () => this.handleMouseEnter(), { signal });
        this.visual.addEventListener('mouseleave', () => this.handleMouseLeave(), { signal });
        this.visual.addEventListener('click', () => this.handleClick(), { signal });
    }

    setupVisibilityObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.isVisible = true;
                    const active = this.items[this.currentIndex];
                    if (active && active.tagName === 'VIDEO' && !this.isHovering) {
                        active.play().catch(() => {});
                    }
                    if (!this.isHovering) {
                        this.scheduleNext();
                    }
                } else {
                    this.isVisible = false;
                    this.stopAutoPlay();
                }
            });
        }, {
            rootMargin: '0px',
            threshold: 0.35
        });

        this.observer.observe(this.visual);
    }

    showItem(index) {
        this.items.forEach((item, i) => {
            const isActive = i === index;
            item.classList.toggle('active', isActive);

            if (item.tagName === 'VIDEO') {
                if (isActive) {
                    item.currentTime = 0;
                    if (this.isVisible) {
                        item.play().catch(() => {});
                    }
                } else {
                    item.pause();
                }
            }
        });
    }

    nextItem() {
        this.currentIndex = (this.currentIndex + 1) % this.items.length;
        this.showItem(this.currentIndex);

        if (this.isVisible && !this.isHovering) {
            this.scheduleNext();
        }
    }

    scheduleNext() {
        if (!this.isVisible || Utils.prefersReducedMotion()) return;

        if (this.timeoutId) clearTimeout(this.timeoutId);

        const item = this.items[this.currentIndex];

        if (item.tagName === 'VIDEO') {
            if (this.endedHandler) {
                item.removeEventListener('ended', this.endedHandler);
            }
            this.endedHandler = () => {
                item.removeEventListener('ended', this.endedHandler);
                this.endedHandler = null;
                if (!this.isHovering && this.isVisible) {
                    this.nextItem();
                }
            };
            item.addEventListener('ended', this.endedHandler);
        } else {
            this.timeoutId = setTimeout(() => {
                if (!this.isHovering && this.isVisible) {
                    this.nextItem();
                }
            }, 2000);
        }
    }

    stopAutoPlay() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        const item = this.items[this.currentIndex];
        if (item && item.tagName === 'VIDEO') {
            if (this.endedHandler) {
                item.removeEventListener('ended', this.endedHandler);
                this.endedHandler = null;
            }
            item.pause();
        }
    }

    handleMouseEnter() {
        this.isHovering = true;
        this.stopAutoPlay();
        const active = this.items[this.currentIndex];
        if (active && active.tagName === 'VIDEO') active.pause();
    }

    handleMouseLeave() {
        this.isHovering = false;
        const active = this.items[this.currentIndex];
        if (active && active.tagName === 'VIDEO' && this.isVisible) {
            active.play().catch(() => {});
        }
        if (this.isVisible) {
            this.scheduleNext();
        }
    }

    handleClick() {
        this.stopAutoPlay();

        const card = this.visual.closest('.tourism-card, .service-card, .supply-card');
        if (!card) return;

        const cardImages = Array.from(card.querySelectorAll('.tourism-visual img, .service-visual.carousel img, .supply-visual img'));
        if (cardImages.length === 0) return;

        let imgIndex = 0;
        for (let i = this.currentIndex; i >= 0; i--) {
            if (this.items[i] && this.items[i].tagName === 'IMG') {
                imgIndex = cardImages.indexOf(this.items[i]);
                if (imgIndex === -1) imgIndex = 0;
                break;
            }
        }

        // Call Lightbox safely through the App instance if available
        if (window.app?.components?.lightbox) {
            window.app.components.lightbox.open(cardImages, imgIndex);
        } else if (typeof window.openLightbox === 'function') {
            window.openLightbox(cardImages, imgIndex);
        }
    }

    destroy() {
        this.stopAutoPlay();
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.abortController.abort();
    }
}

class CardCarousel {
    constructor() {
        this.selectors = ['.tourism-visual', '.service-visual.carousel', '.supply-visual'];
        this.carousels = [];
        this.init();
    }
    
    init() {
        this.selectors.forEach(selector => {
            Utils.qsa(selector).forEach(visual => {
                this.carousels.push(new Carousel(visual));
            });
        });
    }
    
    destroy() {
        this.carousels.forEach(carousel => carousel.destroy());
    }
}

// ========================================
//   LIGHTBOX
// ========================================
class Lightbox {
    constructor() {
        this.lightbox = Utils.qs('#lightbox');
        this.lightboxImg = Utils.qs('#lightboxImg');
        this.currentSpan = Utils.qs('#lightboxCurrent');
        this.totalSpan = Utils.qs('#lightboxTotal');
        this.closeBtn = this.lightbox ? Utils.qs('.lightbox-close', this.lightbox) : null;
        this.prevBtn = this.lightbox ? Utils.qs('.lightbox-nav.prev', this.lightbox) : null;
        this.nextBtn = this.lightbox ? Utils.qs('.lightbox-nav.next', this.lightbox) : null;
        this.backdrop = this.lightbox ? Utils.qs('.lightbox-backdrop', this.lightbox) : null;
        
        this.images = [];
        this.currentIndex = 0;
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.previouslyFocused = null;
        this.abortController = new AbortController();
        
        this.init();
    }
    
    init() {
        if (!this.lightbox || !this.lightboxImg) return;
        
        // Bind global functions safely
        window.openLightbox = this.open.bind(this);
        window.closeLightbox = this.close.bind(this);
        window.nextLightbox = this.next.bind(this);
        window.prevLightbox = this.prev.bind(this);
        
        const signal = this.abortController.signal;
        
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close(), { signal });
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.prev(), { signal });
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.next(), { signal });
        if (this.backdrop) this.backdrop.addEventListener('click', () => this.close(), { signal });
        
        document.addEventListener('keydown', (e) => this.handleKeydown(e), { signal });
        
        this.lightbox.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true, signal });
        this.lightbox.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true, signal });
    }
    
    open(images, startIndex = 0) {
        this.images = Array.from(images).map(img => ({
            src: img.src,
            alt: img.alt
        }));
        
        this.currentIndex = startIndex;
        this.previouslyFocused = document.activeElement;
        
        if (this.totalSpan) {
            this.totalSpan.textContent = this.images.length;
        }
        
        this.updateImage();
        this.lightbox.classList.add('active');
        this.lightbox.setAttribute('aria-hidden', 'false');
        document.body.classList.add('lightbox-open');

        const focusTarget = this.closeBtn || this.lightbox;
        focusTarget.focus({ preventScroll: true });
    }
    
    close() {
        if (this.lightbox) {
            this.lightbox.classList.remove('active');
            this.lightbox.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('lightbox-open');
            if (this.lightboxImg) this.lightboxImg.removeAttribute('src');
            if (this.previouslyFocused instanceof HTMLElement) {
                this.previouslyFocused.focus({ preventScroll: true });
            }
        }
    }
    
    next() {
        if (!this.images.length) return;
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.updateImage();
    }
    
    prev() {
        if (!this.images.length) return;
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.updateImage();
    }
    
    updateImage() {
        if (!this.images.length || !this.lightboxImg) return;
        
        const image = this.images[this.currentIndex];
        this.lightboxImg.src = image.src;
        this.lightboxImg.alt = image.alt;
        
        if (this.currentSpan) {
            this.currentSpan.textContent = this.currentIndex + 1;
        }
    }
    
    handleKeydown(e) {
        if (!this.lightbox || !this.lightbox.classList.contains('active')) return;
        
        if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.prev();
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.next();
        }
        if (e.key === 'Tab') this.trapFocus(e);
    }

    trapFocus(e) {
        const focusable = Utils.qsa('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])', this.lightbox)
            .filter(el => el.offsetParent !== null);

        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus({ preventScroll: true });
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus({ preventScroll: true });
        }
    }
    
    handleTouchStart(e) {
        this.touchStartX = e.changedTouches[0].screenX;
    }
    
    handleTouchEnd(e) {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
    }
    
    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) this.next();
            else this.prev();
        }
    }

    destroy() {
        this.abortController.abort();
    }
}

// ========================================
//   PROJECTS SLIDER
// ========================================
class ProjectsSlider {
    constructor() {
        this.slider = Utils.qs('#projectsSlider');
        this.slides = this.slider ? Utils.qsa('.project-slide', this.slider) : [];
        this.dots = this.slider ? Utils.qsa('.project-slider-dots .dot', this.slider) : [];
        this.prevBtn = this.slider ? Utils.qs('.project-slider-btn.prev', this.slider) : null;
        this.nextBtn = this.slider ? Utils.qs('.project-slider-btn.next', this.slider) : null;
        
        this.currentSlide = 0;
        this.autoPlayInterval = null;
        this.userInteracted = false;
        this.touchStartX = 0;
        this.abortController = new AbortController();
        
        this.init();
    }
    
    init() {
        if (!this.slider || !this.slides.length) return;
        
        const signal = this.abortController.signal;
        
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.handleUserInteraction(() => this.prevSlide()), { signal });
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.handleUserInteraction(() => this.nextSlide()), { signal });
        
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.handleUserInteraction(() => this.goToSlide(index)), { signal });
        });
        
        this.slider.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true, signal });
        this.slider.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true, signal });
        
        this.slider.addEventListener('mouseenter', () => this.stopAutoPlay(), { signal });
        this.slider.addEventListener('mouseleave', () => this.startAutoPlay(), { signal });
        
        this.startAutoPlay();
    }
    
    goToSlide(index) {
        if (index < 0) index = this.slides.length - 1;
        if (index >= this.slides.length) index = 0;
        
        if (this.slides[this.currentSlide]) {
            this.slides[this.currentSlide].classList.remove('active');
        }
        if (this.dots[this.currentSlide]) {
            this.dots[this.currentSlide].classList.remove('active');
        }
        
        this.currentSlide = index;
        
        if (this.slides[this.currentSlide]) {
            this.slides[this.currentSlide].classList.add('active');
        }
        if (this.dots[this.currentSlide]) {
            this.dots[this.currentSlide].classList.add('active');
        }
    }
    
    nextSlide() {
        this.goToSlide(this.currentSlide + 1);
    }
    
    prevSlide() {
        this.goToSlide(this.currentSlide - 1);
    }
    
    startAutoPlay() {
        if (this.userInteracted || Utils.prefersReducedMotion()) return;
        this.autoPlayInterval = setInterval(() => this.nextSlide(), 4000);
    }
    
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }
    
    handleUserInteraction(callback) {
        this.userInteracted = true;
        this.stopAutoPlay();
        callback();
    }
    
    handleTouchStart(e) {
        this.touchStartX = e.changedTouches[0].screenX;
    }
    
    handleTouchEnd(e) {
        const diff = this.touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
            this.handleUserInteraction(() => diff > 0 ? this.nextSlide() : this.prevSlide());
        }
    }
    
    destroy() {
        this.stopAutoPlay();
        this.abortController.abort();
    }
}

// ========================================
//   FULLSCREEN SECTIONS
// ========================================
class FullscreenSections {
    constructor() {
        this.sections = Utils.qsa('.hero, .section, .cta-section');
        this.navUp = Utils.qs('.nav-btn.up');
        this.navDown = Utils.qs('.nav-btn.down');
        this.navDotsContainer = Utils.qs('#navDots');
        this.currentIndex = 0;
        this.observer = null;
        this.abortController = new AbortController();
        
        this.init();
    }
    
    init() {
        if (!this.sections.length) return;
        
        this.buildNavDots();
        this.setInitialActive();
        
        const signal = this.abortController.signal;
        
        if (this.navUp) {
            this.navUp.addEventListener('click', () => this.scrollToSection(this.currentIndex - 1), { signal });
        }
        
        if (this.navDown) {
            this.navDown.addEventListener('click', () => this.scrollToSection(this.currentIndex + 1), { signal });
        }
        
        document.addEventListener('keydown', (e) => this.handleKeydown(e), { signal });
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const idx = this.sections.indexOf(entry.target);
                    if (idx !== -1) {
                        this.currentIndex = idx;
                        this.updateNav();
                    }
                }
            });
        }, { threshold: 0.5 });
        
        this.sections.forEach(section => this.observer.observe(section));
        
        this.updateNav();
    }
    
    buildNavDots() {
        if (!this.navDotsContainer) return;
        
        this.navDotsContainer.innerHTML = '';
        this.sections.forEach((_, i) => {
            const dot = document.createElement('span');
            dot.className = 'nav-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => this.scrollToSection(i), { signal: this.abortController.signal });
            this.navDotsContainer.appendChild(dot);
        });
    }
    
    setInitialActive() {
        this.sections.forEach((sec, i) => {
            sec.classList.toggle('active', i === 0);
        });
    }
    
    updateNav() {
        if (this.navUp) this.navUp.disabled = this.currentIndex <= 0;
        if (this.navDown) this.navDown.disabled = this.currentIndex >= this.sections.length - 1;
        
        const dots = this.navDotsContainer ? Utils.qsa('.nav-dot', this.navDotsContainer) : [];
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentIndex);
        });
        
        const activeId = this.sections[this.currentIndex]?.id;
        Utils.qsa('.nav-link').forEach(link => {
            const isActive = activeId && link.getAttribute('href') === `#${activeId}`;
            link.classList.toggle('active', Boolean(isActive));
            if (isActive) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }
    
    scrollToSection(index) {
        if (index < 0 || index >= this.sections.length) return;
        
        this.sections[index].scrollIntoView({ 
            behavior: Utils.prefersReducedMotion() ? 'auto' : 'smooth' 
        });
    }
    
    handleNavLinkClick(e, link) {
        e.preventDefault();
        const targetId = link.getAttribute('href')?.slice(1);
        const idx = this.sections.findIndex(section => section.id === targetId);
        if (idx >= 0) {
            this.scrollToSection(idx);
        }
    }
    
    handleKeydown(e) {
        // Prevent intercepting keyboard navigation inside form inputs
        const tag = e.target.tagName.toLowerCase();
        if (['input', 'textarea', 'select'].includes(tag)) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.scrollToSection(Math.max(this.currentIndex - 1, 0));
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.scrollToSection(Math.min(this.currentIndex + 1, this.sections.length - 1));
        }
    }
    
    destroy() {
        if (this.observer) this.observer.disconnect();
        this.abortController.abort();
    }
}

// ========================================
//   VIDEO AUTOPLAY OBSERVER
// ========================================
class AutoplayVideoObserver {
    constructor() {
        this.videos = Utils.qsa('video[data-autoplay-when-visible]');
        if (!this.videos.length || Utils.prefersReducedMotion()) return;
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                if (entry.isIntersecting) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            });
        }, {
            rootMargin: '0px',
            threshold: 0.5
        });
        
        this.videos.forEach(video => this.observer.observe(video));
    }
    
    destroy() {
        if (this.observer) this.observer.disconnect();
    }
}

// ========================================
//   MAIN APP
// ========================================
class App {
    constructor() {
        this.components = {};
        this.init();
    }
    
    init() {
        this.register('imageLoadingManager', () => new ImageLoadingManager());
        this.register('dynamicContent', () => new DynamicContent());
        this.register('analytics', () => new SiteAnalytics());
        this.register('backgroundSlider', () => new BackgroundSlider());
        this.register('sectionImagesSlider', () => new SectionImagesSlider());
        this.register('headerScroll', () => new HeaderScroll());
        this.register('mobileMenu', () => new MobileMenu());
        this.register('smoothScroll', () => new SmoothScroll());
        this.register('parallax', () => new Parallax());
        this.register('scrollAnimations', () => new ScrollAnimations());
        this.register('activeNav', () => new ActiveNav());
        this.register('scrollIndicator', () => new ScrollIndicator());
        this.register('contactForm', () => new ContactForm());
        this.register('phoneToggle', () => new PhoneToggle());
        this.register('cardCarousel', () => new CardCarousel());
        this.register('lightbox', () => new Lightbox());
        this.register('projectsSlider', () => new ProjectsSlider());
        this.register('fullscreenSections', () => new FullscreenSections());
        this.register('heroFacts', () => new HeroFacts());
        this.register('autoplayVideo', () => new AutoplayVideoObserver());
        
        this.preloadImages();
    }

    register(name, factory) {
        try {
            this.components[name] = factory();
        } catch (err) {
            console.error(`[INTEGRA] Component failed: ${name}`, err);
        }
    }
    
    preloadImages() {
        const images = Utils.qsa('img[loading="eager"], img[fetchpriority="high"]')
            .map(img => img.currentSrc || img.src)
            .filter(Boolean);

        images.forEach(src => Utils.loadImage(src).catch(() => {}));
    }
    
    destroy() {
        Object.values(this.components).forEach(component => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });
    }
}

// ========================================
//   INITIALIZATION
// ========================================
function bootApp() {
    if (window.app) return;

    try {
        window.app = new App();
        document.documentElement.classList.add('app-ready');
    } catch (err) {
        console.error('[INTEGRA] App initialization failed', err);
    }
}

try {
    window.preloader = new Preloader(bootApp);
} catch (err) {
    console.error('[INTEGRA] Preloader failed', err);
    document.body.classList.remove('loading');
    bootApp();
}
