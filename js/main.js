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
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
};

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
        
        this.minDuration = 5200;
        this.phraseDuration = this.minDuration / this.phrases.length;
        this.progress = 0;
        this.resourcesLoaded = false;
        this.startTime = performance.now();
        this.animationFrame = null;
        this.currentPhraseIndex = -1;
        
        this.init();
    }
    
    init() {
        document.body.classList.add('loading');
        this.trackResources();
        this.startAnimation();
        
        setTimeout(() => {
            this.resourcesLoaded = true;
        }, 8000);
    }
    
    trackResources() {
        const resources = [];
        
        Utils.qsa('img').forEach(img => {
            if (!img.complete) {
                resources.push(
                    new Promise(resolve => {
                        img.addEventListener('load', resolve, { once: true });
                        img.addEventListener('error', resolve, { once: true });
                    })
                );
            }
        });
        
        Utils.qsa('[style*="background-image"]').forEach(el => {
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
        const animate = () => {
            const elapsed = performance.now() - this.startTime;
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
        
        this.progress = 100;
        if (this.bar) this.bar.style.width = '100%';
        if (this.percent) this.percent.textContent = '100%';
        if (this.text) this.text.textContent = this.phrases[this.phrases.length - 1];
        
        setTimeout(() => {
            if (this.preloader) {
                this.preloader.classList.add('hidden');
            }
            document.body.classList.remove('loading');
            
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
        const startTime = performance.now();
        
        const update = (currentTime) => {
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
        this.currentImage = 0;
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
        
        if (this.images[this.currentImage]) {
            this.images[this.currentImage].classList.remove('active');
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
        this.currentSlide = 0;
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
        
        if (this.slides[this.currentSlide]) {
            this.slides[this.currentSlide].classList.remove('active');
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
        this.init();
    }
    
    init() {
        if (!this.header) return;
        
        window.addEventListener('scroll', Utils.rafThrottle(() => this.update()), { passive: true });
        this.update();
    }
    
    update() {
        const currentScroll = window.pageYOffset;
        this.header.classList.toggle('scrolled', currentScroll > this.scrollThreshold);
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
        this.init();
    }
    
    init() {
        if (!this.toggle || !this.nav) return;
        
        this.toggle.addEventListener('click', () => this.toggleMenu());
        
        this.links.forEach(link => {
            link.addEventListener('click', () => this.closeMenu());
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.closeMenu();
        });
        
        window.addEventListener('resize', Utils.debounce(() => {
            if (window.innerWidth > 768 && this.isOpen) this.closeMenu();
        }, 250));
    }
    
    toggleMenu() {
        this.isOpen = !this.isOpen;
        this.nav.classList.toggle('active', this.isOpen);
        this.toggle.setAttribute('aria-expanded', String(this.isOpen));
        this.toggle.setAttribute('aria-label', this.isOpen ? 'Закрыть меню' : 'Открыть меню');
    }
    
    closeMenu() {
        this.isOpen = false;
        this.nav.classList.remove('active');
        this.toggle.setAttribute('aria-expanded', 'false');
        this.toggle.setAttribute('aria-label', 'Открыть меню');
    }
}

// ========================================
//   SMOOTH SCROLL
// ========================================
class SmoothScroll {
    constructor() {
        this.links = Utils.qsa('a[href^="#"]');
        this.init();
    }
    
    init() {
        this.links.forEach(link => {
            link.addEventListener('click', (e) => this.handleClick(e, link));
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
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: Utils.prefersReducedMotion() ? 'auto' : 'smooth'
        });
    }
}

// ========================================
//   PARALLAX
// ========================================
class Parallax {
    constructor() {
        this.bgSlider = Utils.qs('.bg-slider');
        this.init();
    }
    
    init() {
        if (!this.bgSlider || Utils.prefersReducedMotion()) return;
        
        window.addEventListener('scroll', Utils.rafThrottle(() => this.update()), { passive: true });
    }
    
    update() {
        const scrolled = window.pageYOffset;
        if (scrolled < window.innerHeight) {
            this.bgSlider.style.transform = `translateY(${scrolled * 0.4}px)`;
        }
    }
}

// ========================================
//   LANGUAGE SWITCHER
// ========================================
class LanguageSwitcher {
    constructor() {
        this.links = Utils.qsa('.lang-link');
        this.init();
    }
    
    init() {
        this.links.forEach(link => {
            link.addEventListener('click', (e) => this.handleClick(e, link));
        });
    }
    
    handleClick(e, link) {
        e.preventDefault();
        this.links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        const lang = link.dataset.lang;
        if (lang) {
            document.documentElement.lang = lang;
            localStorage.setItem('preferredLanguage', lang);
        }
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
                        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
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
        });
    }
}

// ========================================
//   CONTACT FORM
// ========================================
class ContactForm {
    constructor() {
        this.form = Utils.qs('#contactForm');
        this.submitBtn = this.form ? Utils.qs('.form-submit', this.form) : null;
        this.init();
    }
    
    init() {
        if (!this.form || !this.submitBtn) return;
        
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.form.addEventListener('input', Utils.debounce(() => this.validate(), 300));
    }
    
    validate() {
        const inputs = Utils.qsa('input, textarea, select', this.form);
        let isValid = true;
        
        inputs.forEach(input => {
            if (input.required && !input.value.trim()) {
                isValid = false;
                input.classList.add('invalid');
            } else {
                input.classList.remove('invalid');
            }
            
            if (input.type === 'email' && input.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input.value)) {
                    isValid = false;
                    input.classList.add('invalid');
                }
            }
        });
        
        return isValid;
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validate()) {
            console.warn('Пожалуйста, заполните все поля корректно');
            return;
        }
        
        const apiUrl = window.API_URL || 'http://localhost:3000/api/contact';
        const formData = new FormData(this.form);
        const payload = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            email: formData.get('email') || undefined,
            service: formData.get('service') || undefined,
            message: formData.get('message') || undefined,
        };
        
        const originalText = this.submitBtn.innerHTML;
        this.submitBtn.innerHTML = '<span>ОТПРАВКА...</span>';
        this.submitBtn.disabled = true;
        
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            const data = await res.json();
            
            if (data.ok) {
                this.submitBtn.innerHTML = '<span>ОТПРАВЛЕНО!</span>';
                this.submitBtn.style.background = '#4ade80';
                this.submitBtn.style.borderColor = '#4ade80';
                this.submitBtn.style.color = '#0a0a0a';
                this.form.reset();
                
                setTimeout(() => {
                    this.submitBtn.innerHTML = originalText;
                    this.submitBtn.style.background = '';
                    this.submitBtn.style.borderColor = '';
                    this.submitBtn.style.color = '';
                    this.submitBtn.disabled = false;
                }, 3000);
            } else {
                throw new Error(data.error || 'Server error');
            }
        } catch (err) {
            console.error('Submit error:', err);
            this.submitBtn.innerHTML = '<span>ОШИБКА, ПОПРОБУЙТЕ ПОЗЖЕ</span>';
            this.submitBtn.style.background = '#ef4444';
            this.submitBtn.style.borderColor = '#ef4444';
            
            setTimeout(() => {
                this.submitBtn.innerHTML = originalText;
                this.submitBtn.style.background = '';
                this.submitBtn.style.borderColor = '';
                this.submitBtn.disabled = false;
            }, 3000);
        }
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
        this.init();
    }
    
    init() {
        if (!this.toggle || !this.dropdown) return;
        
        this.toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        document.addEventListener('click', (e) => {
            if (!this.toggle.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.closeDropdown();
        });
    }
    
    toggleDropdown() {
        this.isOpen = !this.isOpen;
        this.dropdown.classList.toggle('active', this.isOpen);
        this.toggle.setAttribute('aria-expanded', String(this.isOpen));
    }
    
    closeDropdown() {
        this.isOpen = false;
        this.dropdown.classList.remove('active');
        this.toggle.setAttribute('aria-expanded', 'false');
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
        this.init();
    }

    init() {
        if (this.items.length <= 1) return;

        this.showItem(this.currentIndex);

        this.setupVisibilityObserver();

        this.visual.addEventListener('mouseenter', () => this.handleMouseEnter());
        this.visual.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.visual.addEventListener('click', () => this.handleClick());
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
            rootMargin: '100px',
            threshold: 0.1
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
        if (!this.isVisible) return;

        if (this.timeoutId) clearTimeout(this.timeoutId);

        const item = this.items[this.currentIndex];

        if (item.tagName === 'VIDEO') {
            item.onended = () => {
                item.onended = null;
                if (!this.isHovering && this.isVisible) {
                    this.nextItem();
                }
            };
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
            item.onended = null;
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

        const card = this.visual.closest('.supply-card, .tourism-card, .service-card');
        if (!card) return;

        const cardImages = Array.from(card.querySelectorAll('.supply-visual img, .tourism-visual img, .service-visual.carousel img'));
        if (cardImages.length === 0) return;

        let imgIndex = 0;
        for (let i = this.currentIndex; i >= 0; i--) {
            if (this.items[i] && this.items[i].tagName === 'IMG') {
                imgIndex = cardImages.indexOf(this.items[i]);
                if (imgIndex === -1) imgIndex = 0;
                break;
            }
        }

        if (typeof window.openLightbox === 'function') {
            window.openLightbox(cardImages, imgIndex);
        }
    }

    destroy() {
        this.stopAutoPlay();
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

class SupplyCarousel {
    constructor() {
        this.selectors = ['.supply-visual', '.tourism-visual', '.service-visual.carousel'];
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
        
        this.init();
    }
    
    init() {
        if (!this.lightbox || !this.lightboxImg) return;
        
        window.openLightbox = (images, startIndex) => this.open(images, startIndex);
        window.closeLightbox = () => this.close();
        window.nextLightbox = () => this.next();
        window.prevLightbox = () => this.prev();
        
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.prev());
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.next());
        if (this.backdrop) this.backdrop.addEventListener('click', () => this.close());
        
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        this.lightbox.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        this.lightbox.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
    }
    
    open(images, startIndex = 0) {
        this.images = Array.from(images).map(img => ({
            src: img.src,
            alt: img.alt
        }));
        
        this.currentIndex = startIndex;
        
        if (this.totalSpan) {
            this.totalSpan.textContent = this.images.length;
        }
        
        this.updateImage();
        this.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        if (this.lightbox) {
            this.lightbox.classList.remove('active');
            document.body.style.overflow = '';
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
        
        if (e.key === 'Escape') this.close();
        if (e.key === 'ArrowLeft') this.prev();
        if (e.key === 'ArrowRight') this.next();
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
        
        this.init();
    }
    
    init() {
        if (!this.slider || !this.slides.length) return;
        
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.handleUserInteraction(() => this.prevSlide()));
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.handleUserInteraction(() => this.nextSlide()));
        
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.handleUserInteraction(() => this.goToSlide(index)));
        });
        
        this.slider.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        this.slider.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
        
        this.slider.addEventListener('mouseenter', () => this.stopAutoPlay());
        this.slider.addEventListener('mouseleave', () => this.startAutoPlay());
        
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
        
        this.init();
    }
    
    init() {
        if (!this.sections.length) return;
        
        this.buildNavDots();
        this.setInitialActive();
        
        if (this.navUp) {
            this.navUp.addEventListener('click', () => this.scrollToSection(this.currentIndex - 1));
        }
        
        if (this.navDown) {
            this.navDown.addEventListener('click', () => this.scrollToSection(this.currentIndex + 1));
        }
        
        Utils.qsa('.nav-link[data-section]').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavLinkClick(e, link));
        });
        
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
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
            dot.addEventListener('click', () => this.scrollToSection(i));
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
        
        Utils.qsa('.nav-link').forEach(link => link.classList.remove('active'));
        const activeLink = Utils.qs(`.nav-link[data-section="${this.currentIndex}"]`);
        if (activeLink) activeLink.classList.add('active');
    }
    
    scrollToSection(index) {
        if (index < 0 || index >= this.sections.length) return;
        
        this.sections[index].scrollIntoView({ 
            behavior: Utils.prefersReducedMotion() ? 'auto' : 'smooth' 
        });
    }
    
    handleNavLinkClick(e, link) {
        e.preventDefault();
        const idx = parseInt(link.dataset.section, 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.sections.length) {
            this.scrollToSection(idx);
        }
    }
    
    handleKeydown(e) {
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
    }
}

// ========================================
//   VIDEO AUTOPLAY OBSERVER
// ========================================
class AutoplayVideoObserver {
    constructor() {
        this.videos = Utils.qsa('video[data-autoplay-when-visible]');
        if (!this.videos.length) return;
        
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
        this.components.backgroundSlider = new BackgroundSlider();
        this.components.sectionImagesSlider = new SectionImagesSlider();
        this.components.headerScroll = new HeaderScroll();
        this.components.mobileMenu = new MobileMenu();
        this.components.smoothScroll = new SmoothScroll();
        this.components.parallax = new Parallax();
        this.components.languageSwitcher = new LanguageSwitcher();
        this.components.scrollAnimations = new ScrollAnimations();
        this.components.activeNav = new ActiveNav();
        this.components.scrollIndicator = new ScrollIndicator();
        this.components.contactForm = new ContactForm();
        this.components.phoneToggle = new PhoneToggle();
        this.components.supplyCarousel = new SupplyCarousel();
        this.components.lightbox = new Lightbox();
        this.components.projectsSlider = new ProjectsSlider();
        this.components.fullscreenSections = new FullscreenSections();
        this.components.heroFacts = new HeroFacts();
        this.components.autoplayVideo = new AutoplayVideoObserver();
        
        this.preloadImages();
    }
    
    preloadImages() {
        const images = [
            'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920',
            'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1920',
            'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920',
            'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920'
        ];
        
        images.forEach(src => {
            Utils.loadImage(src).catch(() => {});
        });
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
const preloader = new Preloader(() => {
    window.app = new App();
});