import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Compass, Menu, Play, Route, Users, X } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useI18n } from '@/features/i18n/I18nProvider';
import { getHomeLanding } from '@/locales/homeLanding';
import HeroSequence from './HeroSequence';
import RevealTitle from './RevealTitle';
import { heroScrollProgress } from './lib/heroScroll';
import { useScrollMotion } from './lib/useScrollMotion';
import PhoneMockup from './PhoneMockup';
import Worldwide from './Worldwide';
import ExplorePhone from './ExplorePhone';
import { smoothstep } from './lib/routeGeometry';
import './App.css';

const DEMO_ICONS = { discover: Compass, record: Route, community: Users };
const FEATURE_ICONS = [Route, Camera, Users];

function withBreaks(text) {
  const parts = String(text).split('\n');
  return parts.flatMap((part, index) => (index === 0 ? [part] : [<br key={index} />, part]));
}

function entranceFrames(icon = false) {
  return Array.from({ length: 81 }, (_, index) => {
    const progress = index / 80;
    const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
    const remaining = 1 - eased;
    return { offset: progress, transform: icon ? `translateY(${remaining * 100}%) rotate(${remaining * -270}deg) scale(${1 - remaining * .7})` : `translateY(${remaining * 100}%) rotate(${remaining * 10}deg)`, opacity: icon ? eased : 1 };
  });
}

function PreviewDialog({ variant, setVariant, onClose, copy }) {
  const dialog = useRef(null);
  const demos = useMemo(
    () => copy.demos.map((demo) => ({ ...demo, Icon: DEMO_ICONS[demo.id] })),
    [copy.demos],
  );
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; element.close(); opener?.focus(); };
  }, []);
  const handleTabKey = event => {
    const index = demos.findIndex(demo => demo.id === variant);
    const next = event.key === 'ArrowRight' ? (index + 1) % demos.length
      : event.key === 'ArrowLeft' ? (index + demos.length - 1) % demos.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? demos.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setVariant(demos[next].id);
    event.currentTarget.querySelector(`#tab-${demos[next].id}`).focus();
  };
  return (
    <dialog ref={dialog} className="preview-dialog" aria-labelledby="preview-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="preview-dialog-head"><div><span className="landing-eyebrow">{copy.previewEyebrow}</span><RevealTitle id="preview-title" mutedFrom={2}>{copy.previewTitle}</RevealTitle></div><button className="icon-button" onClick={onClose} aria-label={copy.previewClose}><X /></button></div>
      <div className="preview-tabs" role="tablist" aria-label={copy.previewTabs} onKeyDown={handleTabKey}>{demos.map(({ id, title, Icon }) => <button key={id} role="tab" tabIndex={variant === id ? 0 : -1} aria-selected={variant === id} aria-controls="preview-screen" id={`tab-${id}`} onClick={() => setVariant(id)}><Icon />{title}</button>)}</div>
      <div className="preview-screen" id="preview-screen" role="tabpanel" aria-labelledby={`tab-${variant}`}><ExplorePhone key={variant} variant={variant} interactive /></div>
      <p className="preview-note">{copy.previewNote}</p>
    </dialog>
  );
}

export default function App() {
  const { locale } = useI18n();
  const t = getHomeLanding(locale);
  const demos = useMemo(
    () => t.demos.map((demo) => ({ ...demo, Icon: DEMO_ICONS[demo.id] })),
    [t.demos],
  );
  useScrollMotion();
  const heading = useRef(null);
  const hero = useRef(null);
  const introPhone = useRef(null);
  const introHeading = useRef(null);
  const heroActions = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const openPreview = (variant = 'discover') => { setMenuOpen(false); setPreview(variant); };
  useEffect(() => {
    let cancelled = false;
    let animations = [];
    const introStates = new Map();
    document.fonts.ready.then(() => {
      if (cancelled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      animations.push(...[...heading.current.querySelectorAll('[data-word]')].map((word, index) => word.animate(entranceFrames(), { duration: 1200, delay: 250 + index * 50, fill: 'both', easing: 'linear' })));
      animations.push(heading.current.querySelector('.hero-mark').animate(entranceFrames(true), { duration: 1200, delay: 250, fill: 'both', easing: 'linear' }));
    });
    const updateHero = () => {
      const element = hero.current;
      const progress = heroScrollProgress(element);
      element.style.setProperty('--wipe-progress', smoothstep(.15, .9, progress));
    };
    const introObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const previous = introStates.get(entry.target);
        if (previous?.inView === entry.isIntersecting) return;
        previous?.animations.forEach(animation => animation.cancel());
        const state = { inView: entry.isIntersecting, animations: [] };
        introStates.set(entry.target, state);
        if (!state.inView) {
          entry.target.classList.remove('is-visible');
          return;
        }
        document.fonts.ready.then(() => {
          if (cancelled || introStates.get(entry.target) !== state) return;
          entry.target.classList.add('is-visible');
          if (entry.target !== introHeading.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          state.animations = [...entry.target.querySelectorAll('[data-word]')].map((word, index) => word.animate(entranceFrames(), { duration: 1200, delay: index * 50, fill: 'both', easing: 'linear' }));
        });
      });
    }, { threshold: .12, rootMargin: '0px 0px -5% 0px' });
    introObserver.observe(introPhone.current);
    introObserver.observe(introHeading.current);
    introObserver.observe(heroActions.current);
    window.addEventListener('scroll', updateHero, { passive: true });
    window.addEventListener('resize', updateHero);
    updateHero();
    return () => { cancelled = true; animations.forEach(animation => animation.cancel()); introStates.forEach(state => state.animations.forEach(animation => animation.cancel())); introObserver.disconnect(); window.removeEventListener('scroll', updateHero); window.removeEventListener('resize', updateHero); };
  }, [locale]);

  return (
    <>
      <a className="skip-link" href="#descubre">{t.skip}</a>
      <main>
        <section className="hero-story" ref={hero} id="inicio" aria-labelledby="hero-title">
          <div className="landing-hero">
          <HeroSequence storyRef={hero} />
          <div className="hero-shade" aria-hidden="true" />
          <header className="landing-site-header landing-container">
            <a href="#inicio" aria-label={t.brandAria} className="brand-link"><img src="/explore-home/brand/explore-brand.svg" alt="Explore" width="283" height="72" /></a>
            <button className="menu-toggle icon-button" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? t.menuClose : t.menuOpen} aria-expanded={menuOpen} aria-controls="main-nav">{menuOpen ? <X /> : <Menu />}</button>
            <nav id="main-nav" className={menuOpen ? "main-nav landing-is-open" : 'main-nav'} aria-label="Primary"><a href="#descubre" onClick={() => setMenuOpen(false)}>{t.navDiscover}</a><a href="#rutas" onClick={() => setMenuOpen(false)}>{t.navRoutes}</a></nav>
            <LanguageSwitcher className="landing-lang-switch" />
            <button className="button button-small header-cta" onClick={() => openPreview()}>{t.headerCta} <ArrowRight /></button>
          </header>
          <div className="hero-intro landing-container">
            <h1 id="hero-title" className="landing-hero-title" ref={heading} aria-label={t.heroAria}><span className="word-mask" aria-hidden="true"><span data-word>{t.heroWord1}</span></span><span className="mark-mask" aria-hidden="true"><img className="hero-mark" src="/explore-home/brand/explore-symbol.svg" alt="" /></span><span className="word-mask" aria-hidden="true"><span data-word>{t.heroWord2}</span></span></h1>
            <div className="hero-actions" ref={heroActions}><a className="button" href="#descubre">{t.ctaStart} <ArrowRight /></a><button className="button button-ghost" onClick={() => openPreview()}><Play fill="currentColor" />{t.ctaApp}</button></div>
          </div>
          <div className="earth-curtain" aria-hidden="true" />
          </div>
        </section>

        <section className="app-intro landing-container" id="descubre" aria-labelledby="app-intro-title">
          <div className="home-phone-window" ref={introPhone}><PhoneMockup /></div>
          <div className="app-intro-copy"><h2 id="app-intro-title" ref={introHeading} aria-label={t.introAria}><span className="intro-line" aria-hidden="true">{t.introLine1.map(word => <span className="word-mask" key={word}><span data-word>{word}</span></span>)}</span><span className="intro-line intro-line-muted" aria-hidden="true">{t.introLine2.map(word => <span className="word-mask" key={word}><span data-word>{word}</span></span>)}</span></h2></div>
        </section>

        <section className="overview landing-section landing-container" aria-labelledby="overview-title">
          <div className="section-heading" data-reveal><RevealTitle id="overview-title" mutedFrom={1}>{t.overviewTitle}</RevealTitle><p>{t.overviewLead}</p></div>
          <div className="phone-showcase">{demos.map(({ id, title, caption }) => <figure className={`showcase-item showcase-${id}`} data-reveal key={id}><div className="phone-panel" data-parallax="phone"><ExplorePhone variant={id} cleanFrame={id === 'community'} /></div><figcaption><button onClick={() => openPreview(id)}>{title}<ArrowRight /></button><span>{caption}</span></figcaption></figure>)}</div>
        </section>

        <Worldwide onDiscover={() => openPreview('discover')} onExplore={() => openPreview('community')} />

        <section className="feature-row feature-reverse landing-container" id="rutas" aria-labelledby="routes-title">
          <div className="feature-copy" data-reveal><span className="landing-eyebrow">{t.routesEyebrow}</span><RevealTitle id="routes-title" mutedFrom={3}>{withBreaks(t.routesTitle)}</RevealTitle><p>{t.routesLead}</p><ul className="feature-list">{t.routesBullets.map((bullet, index) => { const Icon = FEATURE_ICONS[index] || Route; return <li key={bullet}><Icon />{bullet}</li>; })}</ul><button className="demo-link" onClick={() => openPreview('record')}><span><Play fill="currentColor" /></span><div><strong>{t.routesDemoTitle}</strong><small>{t.routesDemoSub}</small></div><ArrowRight /></button></div>
          <div className="feature-visual recording-visual" data-reveal data-parallax="phone"><ExplorePhone variant="record" cleanFrame /><div className="floating-route" aria-hidden="true"><span><Check /></span><div><strong>{t.routesFloatTitle}</strong><small>{t.routesFloatSub}</small></div></div></div>
        </section>

        <section className="destinations-section landing-section landing-container" aria-labelledby="destinations-title">
          <div className="section-heading" data-reveal><span className="landing-eyebrow">{t.destinationsEyebrow}</span><RevealTitle id="destinations-title" mutedFrom={2}>{t.destinationsTitle}</RevealTitle><p>{t.destinationsLead}</p></div>
          <div className="destination-grid">{t.destinations.map(place => <button className="destination-card" data-reveal key={place.image} onClick={() => openPreview('discover')}><div className="destination-image" data-parallax="image"><img src={`/explore-home/images/destinations/${place.image}.jpg`} alt={place.alt} loading="lazy" /><span>{place.tag}</span><i><ArrowRight /></i></div><RevealTitle as="h3" mutedFrom={2}>{place.title}</RevealTitle><p>{place.text}</p></button>)}</div>
        </section>

        <section className="closing-section" aria-labelledby="closing-title"><div className="landing-container closing-inner" data-reveal><span className="app-icon"><img src="/explore-home/brand/explore-symbol.svg" alt="" /></span><RevealTitle id="closing-title" mutedFrom={3}>{withBreaks(t.closingTitle)}</RevealTitle><p>{withBreaks(t.closingLead)}</p><button className="button button-white" onClick={() => openPreview()}>{t.closingCta}<ArrowRight /></button></div></section>
      </main>
      {preview && <PreviewDialog variant={preview} setVariant={setPreview} onClose={() => setPreview(null)} copy={t} />}
    </>
  );
}
