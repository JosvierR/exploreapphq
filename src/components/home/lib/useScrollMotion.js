import { useEffect } from 'react';

export function useScrollMotion() {
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 769px)');
    const reveals = [...document.querySelectorAll('[data-reveal]')];
    const parallaxElements = [...document.querySelectorAll('[data-parallax]')];
    const visible = new Set();
    let raf = 0;

    const paint = () => {
      raf = 0;
      if (motion.matches || !desktop.matches) return;
      visible.forEach(element => {
        const rect = element.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
        const distance = element.dataset.parallax === 'image' ? 44 : 32;
        element.style.setProperty('--parallax-y', `${((progress - .5) * distance).toFixed(2)}px`);
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -7% 0px' });
    const parallaxObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      schedule();
    });
    const updatePreferences = () => {
      if (motion.matches) reveals.forEach(element => element.classList.add('is-visible'));
      if (motion.matches || !desktop.matches) parallaxElements.forEach(element => element.style.setProperty('--parallax-y', '0px'));
      else schedule();
    };
    reveals.forEach(element => revealObserver.observe(element));
    parallaxElements.forEach(element => parallaxObserver.observe(element));
    motion.addEventListener('change', updatePreferences);
    desktop.addEventListener('change', updatePreferences);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    updatePreferences();
    return () => {
      cancelAnimationFrame(raf);
      revealObserver.disconnect();
      parallaxObserver.disconnect();
      motion.removeEventListener('change', updatePreferences);
      desktop.removeEventListener('change', updatePreferences);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
}
