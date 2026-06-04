// ========================================
//   PRELOADER
// ========================================
document.body.classList.add('loading');

const preloader = document.getElementById('preloader');
const preloaderBar = document.getElementById('preloaderBar');
const preloaderPercent = document.getElementById('preloaderPercent');
const preloaderText = document.getElementById('preloaderText');

// Construction-themed phrases
const phrases = [
    'Укладываем фундамент',      // 0%
    'Возводим каркас',           // 14%
    'Проектируем пространство',  // 29%
    'Инвестируем в детали',      // 43%
    'Финишная отделка',          // 57%
    'Запускаем системы',         // 71%
    'Вводим объект',             // 86%
    'Добро пожаловать'           // 100%
];

const MIN_DURATION = 5200; // 5.2s — enough to read all phrases
const PHRASE_DURATION = MIN_DURATION / phrases.length; // ~650ms each

let progress = 0;
let resourcesLoaded = false;
let startTime = performance.now();
let animationFrame = null;
let currentPhraseIndex = -1;

function animateLoader() {
    const elapsed = performance.now() - startTime;
    const timeProgress = Math.min(elapsed / MIN_DURATION, 1);

    // Linear progress (no ease-out)
    progress = Math.round(timeProgress * 100);

    // Bar & percent
    preloaderBar.style.width = progress + '%';
    preloaderPercent.textContent = progress + '%';

    // Phrase by time
    const newPhraseIndex = Math.min(Math.floor(elapsed / PHRASE_DURATION), phrases.length - 1);
    if (newPhraseIndex !== currentPhraseIndex) {
        currentPhraseIndex = newPhraseIndex;
        preloaderText.textContent = phrases[currentPhraseIndex];
    }

    if (timeProgress < 1 || !resourcesLoaded) {
        animationFrame = requestAnimationFrame(animateLoader);
    } else {
        finishLoader();
    }
}

function finishLoader() {
    cancelAnimationFrame(animationFrame);
    progress = 100;
    preloaderBar.style.width = '100%';
    preloaderPercent.textContent = '100%';
    preloaderText.textContent = phrases[phrases.length - 1];

    setTimeout(() => {
        preloader.classList.add('hidden');
        document.body.classList.remove('loading');
        initApp();
    }, 900);
}

// Track actual resource loading
let pendingResources = 0;

function trackResource() {
    pendingResources++;
}
function resourceDone() {
    pendingResources--;
    checkResources();
}
function checkResources() {
    if (pendingResources <= 0) {
        resourcesLoaded = true;
    }
}

// Track images
const images = document.querySelectorAll('img');
images.forEach(img => {
    if (!img.complete) {
        trackResource();
        img.addEventListener('load', resourceDone);
        img.addEventListener('error', resourceDone);
    }
});

// Track background images
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

// Window load = CSS + fonts ready
window.addEventListener('load', () => {
    resourcesLoaded = true;
});

// Fallback: force finish if resources hang
setTimeout(() => {
    resourcesLoaded = true;
}, 6000);

// Start
animationFrame = requestAnimationFrame(animateLoader);

// ========================================
//   MAIN APP
// ========================================
function initApp() {
    new BackgroundSlider();
    new SectionImagesSlider();
    initHeaderScroll();
    initMobileMenu();
    initSmoothScroll();
    initParallax();
    initLanguageSwitcher();
    initScrollAnimations();
    initActiveNav();
    initScrollIndicator();
    initContactForm();
    initPhoneToggle();
    preloadImages();
    animateHeroFacts();
    initSupplyCarousel();
    initLightbox();
    initProjectsSlider();
    initFullscreenSections();
}

// Animate hero facts numbers
function animateHeroFacts() {
    const factNumbers = document.querySelectorAll('.fact-number[data-count]');
    if (!factNumbers.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.count, 10);
                const suffix = el.dataset.suffix || '';
                const duration = 2000; // 2 seconds
                const startTime = performance.now();
                const startValue = 0;

                function update(currentTime) {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    // Ease out quad
                    const ease = 1 - (1 - progress) * (1 - progress);
                    const current = Math.round(startValue + (target - startValue) * ease);
                    el.textContent = current + suffix;

                    if (progress < 1) {
                        requestAnimationFrame(update);
                    }
                }

                requestAnimationFrame(update);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    factNumbers.forEach(el => observer.observe(el));
}

// Section Images Slider — switches images on scroll
class SectionImagesSlider {
    constructor() {
        this.images = document.querySelectorAll('.section-img');
        this.sections = document.querySelectorAll('section[id]');
        this.currentImage = 0;
        this.imagesMap = new Map();
        this.init();
    }

    init() {
        // Build map: section id -> image index
        this.images.forEach((img, index) => {
            const sectionId = img.dataset.section;
            if (sectionId) {
                this.imagesMap.set(sectionId, index);
            }
        });

        // Use scroll-based detection for reliability
        this.updateActiveImage();
        window.addEventListener('scroll', () => {
            requestAnimationFrame(() => this.updateActiveImage());
        }, { passive: true });
    }

    updateActiveImage() {
        const viewportCenter = window.innerHeight / 2;
        let closestSection = null;
        let closestDistance = Infinity;

        this.sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const sectionCenter = rect.top + rect.height / 2;
            const distance = Math.abs(sectionCenter - viewportCenter);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestSection = section;
            }
        });

        if (closestSection) {
            const id = closestSection.getAttribute('id');
            if (this.imagesMap.has(id)) {
                this.goToImage(this.imagesMap.get(id));
            }
        }
    }

    goToImage(index) {
        if (index === this.currentImage) return;
        this.images[this.currentImage].classList.remove('active');
        this.currentImage = index;
        this.images[this.currentImage].classList.add('active');
    }
}

// Background Slider — changes on scroll
class BackgroundSlider {
    constructor() {
        this.slides = document.querySelectorAll('.slide');
        this.currentSlide = 0;
        this.init();
    }

    init() {
        this.initScrollTrigger();
    }

    initScrollTrigger() {
        const sections = document.querySelectorAll('section[id]');
        const slidesMap = new Map();

        this.slides.forEach((slide, index) => {
            const sectionId = slide.dataset.section;
            if (sectionId) {
                slidesMap.set(sectionId, index);
            }
        });

        const observerOptions = {
            threshold: 0.4,
            rootMargin: '-10% 0px -40% 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    if (slidesMap.has(id)) {
                        this.goToSlide(slidesMap.get(id));
                    }
                }
            });
        }, observerOptions);

        sections.forEach(section => observer.observe(section));
    }

    goToSlide(index) {
        if (index === this.currentSlide) return;
        this.slides[this.currentSlide].classList.remove('active');
        this.currentSlide = index;
        this.slides[this.currentSlide].classList.add('active');
    }
}

// Header scroll effect
function initHeaderScroll() {
    const header = document.getElementById('header');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });
}

// Mobile menu
function initMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const mainNav = document.querySelector('.main-nav');

    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
        });

        // Close menu when clicking a link
        const navLinks = mainNav.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('active');
            });
        });
    }
}

// Smooth scroll for anchor links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Parallax Effect
function initParallax() {
    const bgSlider = document.querySelector('.bg-slider');
    if (!bgSlider) return;

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        if (scrolled < window.innerHeight) {
            bgSlider.style.transform = `translateY(${scrolled * 0.4}px)`;
        }
    });
}

// Language Switcher
function initLanguageSwitcher() {
    const langLinks = document.querySelectorAll('.lang-link');

    langLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            langLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

// Scroll Animations (Intersection Observer)
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -60px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Add reveal class to section elements and observe them
    const sections = document.querySelectorAll('.section-header, .about-grid, .project-card, .service-card, .advantage-item, .cta-content, .stat-item');
    sections.forEach((el, index) => {
        el.classList.add('reveal');
        el.style.transitionDelay = `${(index % 4) * 0.1}s`;
        observer.observe(el);
    });
}

// Active nav link highlighting
function initActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        let current = '';
        const scrollPos = window.pageYOffset + 200;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// Scroll indicator click
function initScrollIndicator() {
    const indicator = document.querySelector('.scroll-indicator');
    if (indicator) {
        indicator.addEventListener('click', () => {
            const aboutSection = document.getElementById('about');
            if (aboutSection) {
                aboutSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// Preload background images
function preloadImages() {
    const images = [
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920',
        'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1920',
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920',
        'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920'
    ];

    images.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}



// Form handling
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = form.querySelector('.form-submit');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>ОТПРАВЛЕНО!</span>';
        btn.style.background = '#4ade80';
        btn.style.borderColor = '#4ade80';
        btn.style.color = '#0a0a0a';

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
            form.reset();
        }, 2500);
    });
}

// Phone toggle dropdown
function initPhoneToggle() {
    const toggle = document.querySelector('.phone-toggle');
    const dropdown = document.querySelector('.phone-dropdown');
    if (!toggle || !dropdown) return;

    toggle.addEventListener('click', () => {
        const isOpen = dropdown.classList.contains('active');
        dropdown.classList.toggle('active');
        toggle.setAttribute('aria-expanded', String(!isOpen));
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
        }
    });
}

// Debounced resize handler
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const mainNav = document.querySelector('.main-nav');
        if (window.innerWidth > 768 && mainNav) {
            mainNav.classList.remove('active');
        }
    }, 250);
});

// ========================================
//   CARD IMAGE CAROUSEL (supply + tourism)
// ========================================
function initSupplyCarousel() {
    const selectors = ['.supply-visual', '.tourism-visual', '.service-visual.carousel'];

    selectors.forEach(selector => {
        const visuals = document.querySelectorAll(selector);

        visuals.forEach(visual => {
            const images = visual.querySelectorAll('img');
            if (images.length <= 1) return;

            let currentIndex = 0;
            let autoPlayInterval;

            function showImage(index) {
                images.forEach((img, i) => {
                    img.classList.toggle('active', i === index);
                });
            }

            function nextImage() {
                currentIndex = (currentIndex + 1) % images.length;
                showImage(currentIndex);
            }

            function startAutoPlay() {
                autoPlayInterval = setInterval(nextImage, 2000);
            }

            // Pause on hover
            visual.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
            visual.addEventListener('mouseleave', startAutoPlay);

            // Open lightbox on click
            visual.addEventListener('click', () => {
                const card = visual.closest('.supply-card, .tourism-card, .service-card');
                const cardImages = card.querySelectorAll('.supply-visual img, .tourism-visual img, .service-visual img');
                openLightbox(cardImages, currentIndex);
            });

            startAutoPlay();
        });
    });
}

// ========================================
//   LIGHTBOX
// ========================================
function initLightbox() {
    window.openLightbox = function(images, startIndex) {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightboxImg');
        const currentSpan = document.getElementById('lightboxCurrent');
        const totalSpan = document.getElementById('lightboxTotal');

        if (!lightbox || !lightboxImg) return;

        // Build array from clicked card's images
        window.lightboxImages = [];
        images.forEach(img => {
            window.lightboxImages.push({
                src: img.src,
                alt: img.alt
            });
        });

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
        if (lightbox) {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        }
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

    // Event listeners
    const lightbox = document.getElementById('lightbox');
    const closeBtn = lightbox?.querySelector('.lightbox-close');
    const prevBtn = lightbox?.querySelector('.lightbox-nav.prev');
    const nextBtn = lightbox?.querySelector('.lightbox-nav.next');
    const backdrop = lightbox?.querySelector('.lightbox-backdrop');

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', prevLightbox);
    if (nextBtn) nextBtn.addEventListener('click', nextLightbox);
    if (backdrop) backdrop.addEventListener('click', closeLightbox);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox || !lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') prevLightbox();
        if (e.key === 'ArrowRight') nextLightbox();
    });

    // Touch/swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    if (lightbox) {
        lightbox.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        lightbox.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    }

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) nextLightbox();
            else prevLightbox();
        }
    }
}

// ========================================
//   PROJECTS SLIDER
// ========================================
function initProjectsSlider() {
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
        dots[currentSlide].classList.remove('active');

        currentSlide = index;

        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }

    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    function prevSlide() {
        goToSlide(currentSlide - 1);
    }

    function startAutoPlay() {
        if (userInteracted) return;
        autoPlayInterval = setInterval(nextSlide, 4000);
    }

    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
    }

    function handleUserInteraction(callback) {
        userInteracted = true;
        stopAutoPlay();
        callback();
    }

    if (prevBtn) prevBtn.addEventListener('click', () => handleUserInteraction(prevSlide));
    if (nextBtn) nextBtn.addEventListener('click', () => handleUserInteraction(nextSlide));

    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => handleUserInteraction(() => goToSlide(index)));
    });

    // Touch/swipe inside slider
    let touchStartX = 0;
    slider.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
            handleUserInteraction(() => diff > 0 ? nextSlide() : prevSlide());
        }
    }, { passive: true });

    // Hover still pauses but doesn't mark as user interaction
    slider.addEventListener('mouseenter', stopAutoPlay);
    slider.addEventListener('mouseleave', startAutoPlay);

    startAutoPlay();
}

// ========================================
//   FULLSCREEN SECTIONS NAVIGATION
// ========================================
function initFullscreenSections() {
    const sections = document.querySelectorAll('.hero, .section, .cta-section');
    const navUp = document.querySelector('.nav-btn.up');
    const navDown = document.querySelector('.nav-btn.down');
    const navDotsContainer = document.getElementById('navDots');
    let currentIndex = 0;
    let isAnimating = false;

    if (sections.length === 0) return;

    // Build nav dots
    if (navDotsContainer) {
        navDotsContainer.innerHTML = '';
        sections.forEach((_, i) => {
            const dot = document.createElement('span');
            dot.className = 'nav-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => goToSection(i));
            navDotsContainer.appendChild(dot);
        });
    }

    // Make first section active
    sections.forEach((sec, i) => {
        sec.classList.toggle('active', i === 0);
    });

    function updateNav() {
        if (navUp) navUp.disabled = currentIndex <= 0;
        if (navDown) navDown.disabled = currentIndex >= sections.length - 1;
        const dots = navDotsContainer?.querySelectorAll('.nav-dot');
        dots?.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentIndex);
        });
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector('.nav-link[data-section="' + currentIndex + '"]');
        if (activeLink) activeLink.classList.add('active');
    }

    function goToSection(index) {
        if (isAnimating || index === currentIndex || index < 0 || index >= sections.length) return;
        isAnimating = true;

        sections[currentIndex].classList.remove('active');
        currentIndex = index;
        sections[currentIndex].classList.add('active');
        updateNav();

        setTimeout(() => { isAnimating = false; }, 800);
    }

    function nextSection() {
        goToSection(currentIndex + 1);
    }

    function prevSection() {
        goToSection(currentIndex - 1);
    }

    // Menu links click handler — smooth scroll to section
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const idx = parseInt(link.dataset.section);
            if (idx >= 0 && idx < sections.length) {
                sections[idx].scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Keyboard navigation — arrows scroll to adjacent section
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            const prev = Math.max(currentIndex - 1, 0);
            sections[prev]?.scrollIntoView({ behavior: 'smooth' });
        }
        if (e.key === 'ArrowDown') {
            const next = Math.min(currentIndex + 1, sections.length - 1);
            sections[next]?.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Nav buttons scroll to section smoothly
    if (navUp) {
        navUp.addEventListener('click', () => {
            const prev = Math.max(currentIndex - 1, 0);
            sections[prev]?.scrollIntoView({ behavior: 'smooth' });
        });
    }
    if (navDown) {
        navDown.addEventListener('click', () => {
            const next = Math.min(currentIndex + 1, sections.length - 1);
            sections[next]?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Update active dot on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const idx = Array.from(sections).indexOf(entry.target);
                if (idx !== -1) {
                    currentIndex = idx;
                    updateNav();
                }
            }
        });
    }, { threshold: 0.5 });

    sections.forEach(s => observer.observe(s));

    updateNav();
}
