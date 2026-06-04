import { useEffect } from 'preact/hooks';

export default function ContactForm() {
  useEffect(() => {
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
  }, []);

  return null;
}
