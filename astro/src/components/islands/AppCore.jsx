import { useEffect } from 'preact/hooks';

export default function AppCore() {
  useEffect(() => {
    // Background Slider — changes on scroll
    class BackgroundSlider {
      constructor() {
        this.slides = document.querySelectorAll('.slide');
        this.currentSlide = 0;
        this.init();
      }
      init() { this.initScrollTrigger(); }
      initScrollTrigger() {
        const sections = document.querySelectorAll('section[id]');
        const slidesMap = new Map();
        this.slides.forEach((slide, index) => {
          const sectionId = slide.dataset.section;
          if (sectionId) slidesMap.set(sectionId, index);
        });
        const observerOptions = { threshold: 0.4, rootMargin: '-10% 0px -40% 0px' };
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute('id');
              if (slidesMap.has(id)) this.goToSlide(slidesMap.get(id));
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
        this.images.forEach((img, index) => {
          const sectionId = img.dataset.section;
          if (sectionId) this.imagesMap.set(sectionId, index);
        });
        this.updateActiveImage();
        window.addEventListener('scroll', () => { requestAnimationFrame(() => this.updateActiveImage()); }, { passive: true });
      }
      updateActiveImage() {
        const viewportCenter = window.innerHeight / 2;
        let closestSection = null, closestDistance = Infinity;
        this.sections.forEach(section => {
          const rect = section.getBoundingClientRect();
          const sectionCenter = rect.top + rect.height / 2;
          const distance = Math.abs(sectionCenter - viewportCenter);
          if (distance < closestDistance) { closestDistance = distance; closestSection = section; }
        });
        if (closestSection) {
          const id = closestSection.getAttribute('id');
          if (this.imagesMap.has(id)) this.goToImage(this.imagesMap.get(id));
        }
      }
      goToImage(index) {
        if (index === this.currentImage) return;
        this.images[this.currentImage].classList.remove('active');
        this.currentImage = index;
        this.images[this.currentImage].classList.add('active');
      }
    }

    function initHeaderScroll() {
      const header = document.getElementById('header');
      if (!header) return;
      window.addEventListener('scroll', () => {
        if (window.pageYOffset > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
      });
    }

    function initMobileMenu() {
      const menuToggle = document.querySelector('.menu-toggle');
      const mainNav = document.querySelector('.main-nav');
      if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => { mainNav.classList.toggle('active'); });
        mainNav.querySelectorAll('.nav-link').forEach(link => {
          link.addEventListener('click', () => { mainNav.classList.remove('active'); });
        });
      }
    }

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
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
          }
        });
      });
    }

    function initParallax() {
      const bgSlider = document.querySelector('.bg-slider');
      if (!bgSlider) return;
      window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        if (scrolled < window.innerHeight) bgSlider.style.transform = `translateY(${scrolled * 0.4}px)`;
      });
    }

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
          if (link.getAttribute('href') === `#${current}`) link.classList.add('active');
        });
      });
    }

    function initScrollIndicator() {
      const indicator = document.querySelector('.scroll-indicator');
      if (indicator) {
        indicator.addEventListener('click', () => {
          const aboutSection = document.getElementById('about');
          if (aboutSection) aboutSection.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }

    function initPhoneToggle() {
      const toggle = document.querySelector('.phone-toggle');
      const dropdown = document.querySelector('.phone-dropdown');
      if (!toggle || !dropdown) return;
      toggle.addEventListener('click', () => {
        const isOpen = dropdown.classList.contains('active');
        dropdown.classList.toggle('active');
        toggle.setAttribute('aria-expanded', String(!isOpen));
      });
      document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.remove('active');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const mainNav = document.querySelector('.main-nav');
        if (window.innerWidth > 768 && mainNav) mainNav.classList.remove('active');
      }, 250);
    });

    // I18N
    const translations = {
      ru: {
        preloader_text: 'Загрузка',
        nav_about: 'О нас', nav_projects: 'Проекты', nav_services: 'Услуги',
        nav_supply: 'Снабжение', nav_advantages: 'Преимущества', nav_tourism: 'Туризм',
        nav_partners: 'Партнеры', nav_contacts: 'Контакты',
        hero_cta: 'СВЯЗАТЬСЯ', hero_scroll: 'SCROLL',
        about_label: 'О КОМПАНИИ', about_title: 'Экспертность на каждом этапе',
        contact_name: 'Имя', contact_phone: 'Телефон', contact_email: 'Email',
        contact_service: 'Интересующее направление', contact_message: 'О проекте',
        contact_submit: 'ОТПРАВИТЬ ЗАЯВКУ', contact_sent: 'ОТПРАВЛЕНО!'
      },
      en: {
        preloader_text: 'Loading',
        nav_about: 'About', nav_projects: 'Projects', nav_services: 'Services',
        nav_supply: 'Supply', nav_advantages: 'Advantages', nav_tourism: 'Tourism',
        nav_partners: 'Partners', nav_contacts: 'Contacts',
        hero_cta: 'CONTACT US', hero_scroll: 'SCROLL',
        about_label: 'ABOUT', about_title: 'Expertise at Every Stage',
        contact_name: 'Name', contact_phone: 'Phone', contact_email: 'Email',
        contact_service: 'Service', contact_message: 'About project',
        contact_submit: 'SEND REQUEST', contact_sent: 'SENT!'
      },
      hy: {
        preloader_text: 'Բեռնում',
        nav_about: 'Մեր մասին', nav_projects: 'Նախագծեր', nav_services: 'Ծառայություններ',
        nav_supply: 'Ամբարում', nav_advantages: 'Առավելություններ', nav_tourism: 'Տուրիզմ',
        nav_partners: 'Գործընկերներ', nav_contacts: 'Կոնտակտներ',
        hero_cta: 'ԿԱՊՎԵԼ', hero_scroll: 'ՈՐՈՆԵԼ',
        about_label: 'ՄԵՐ ՄԱՍԻՆ', about_title: 'Փորձառություն յուրաքանչյուր փուլում',
        contact_name: 'Անուն', contact_phone: 'Հեռախոս', contact_email: 'Էլ․ փոստ',
        contact_service: 'Հետաքրքրող ծառայություն', contact_message: 'Նախագծի մասին',
        contact_submit: 'ՈՒՂԱՐԿԵԼ', contact_sent: 'ՈՒՂԱՐԿՎԱԾ!'
      }
    };

    let currentLang = localStorage.getItem('siteLang') || 'ru';

    function setLanguage(lang) {
      currentLang = lang;
      localStorage.setItem('siteLang', lang);
      document.documentElement.lang = lang;
      applyTranslations();
      updateLangSwitcher();
    }

    function applyTranslations() {
      const t = translations[currentLang];
      if (!t) return;
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key] !== undefined) {
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.placeholder) el.placeholder = t[key];
          } else if (el.tagName === 'OPTION') {
            el.textContent = t[key];
          } else {
            el.textContent = t[key];
          }
        }
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (t[key] !== undefined) el.placeholder = t[key];
      });
      document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.dataset.i18nAria;
        if (t[key] !== undefined) el.setAttribute('aria-label', t[key]);
      });
    }

    function updateLangSwitcher() {
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
      });
    }

    function initI18n() {
      applyTranslations();
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const lang = btn.dataset.lang;
          if (lang && lang !== currentLang) setLanguage(lang);
        });
      });
    }

    // Init
    new BackgroundSlider();
    new SectionImagesSlider();
    initHeaderScroll();
    initMobileMenu();
    initSmoothScroll();
    initParallax();
    initI18n();
    initActiveNav();
    initScrollIndicator();
    initPhoneToggle();
  }, []);

  return null;
}
