import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Compass, Menu, Play, Route, Users, X } from 'lucide-react';
import HeroSequence from './HeroSequence';
import RevealTitle from './RevealTitle';
import { heroScrollProgress } from './lib/heroScroll';
import { useScrollMotion } from './lib/useScrollMotion';
import PhoneMockup from './PhoneMockup';
import Worldwide from './Worldwide';
import ExplorePhone from './ExplorePhone';
import { smoothstep } from './lib/routeGeometry';
import './App.css';

const demos = [{ id: 'discover', title: 'Descubre', Icon: Compass }, { id: 'record', title: 'Graba', Icon: Route }, { id: 'community', title: 'Conecta', Icon: Users }];

function entranceFrames(icon = false) {
  return Array.from({ length: 81 }, (_, index) => {
    const progress = index / 80;
    const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
    const remaining = 1 - eased;
    return { offset: progress, transform: icon ? `translateY(${remaining * 100}%) rotate(${remaining * -270}deg) scale(${1 - remaining * .7})` : `translateY(${remaining * 100}%) rotate(${remaining * 10}deg)`, opacity: icon ? eased : 1 };
  });
}

function PreviewDialog({ variant, setVariant, onClose }) {
  const dialog = useRef(null);
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
      <div className="preview-dialog-head"><div><span className="landing-eyebrow">Conoce Explore</span><RevealTitle id="preview-title" mutedFrom={2}>Tu próxima historia.</RevealTitle></div><button className="icon-button" onClick={onClose} aria-label="Cerrar vista previa"><X /></button></div>
      <div className="preview-tabs" role="tablist" aria-label="Vistas de Explore" onKeyDown={handleTabKey}>{demos.map(({ id, title, Icon }) => <button key={id} role="tab" tabIndex={variant === id ? 0 : -1} aria-selected={variant === id} aria-controls="preview-screen" id={`tab-${id}`} onClick={() => setVariant(id)}><Icon />{title}</button>)}</div>
      <div className="preview-screen" id="preview-screen" role="tabpanel" aria-labelledby={`tab-${variant}`}><ExplorePhone key={variant} variant={variant} interactive /></div>
      <p className="preview-note">Vista conceptual de Explore · Contenido ilustrativo</p>
    </dialog>
  );
}

export default function App() {
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
  }, []);

  return (
    <>
      <a className="skip-link" href="#descubre">Saltar al contenido</a>
      <main>
        <section className="hero-story" ref={hero} id="inicio" aria-labelledby="hero-title">
          <div className="landing-hero">
          <HeroSequence storyRef={hero} />
          <div className="hero-shade" aria-hidden="true" />
          <header className="landing-site-header landing-container">
            <a href="#inicio" aria-label="Explore, inicio" className="brand-link"><img src="/explore-home/brand/explore-brand.svg" alt="Explore" width="283" height="72" /></a>
            <button className="menu-toggle icon-button" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="main-nav">{menuOpen ? <X /> : <Menu />}</button>
            <nav id="main-nav" className={menuOpen ? "main-nav landing-is-open" : 'main-nav'} aria-label="Navegación principal"><a href="#descubre" onClick={() => setMenuOpen(false)}>Descubre</a><a href="#rutas" onClick={() => setMenuOpen(false)}>Rutas</a></nav>
            <button className="button button-small header-cta" onClick={() => openPreview()}>Ver Explore <ArrowRight /></button>
          </header>
          <div className="hero-intro landing-container">
            <h1 id="hero-title" className="landing-hero-title" ref={heading} aria-label="Conoce Explore"><span className="word-mask" aria-hidden="true"><span data-word>Conoce</span></span><span className="mark-mask" aria-hidden="true"><img className="hero-mark" src="/explore-home/brand/explore-symbol.svg" alt="" /></span><span className="word-mask" aria-hidden="true"><span data-word>Explore</span></span></h1>
            <div className="hero-actions" ref={heroActions}><a className="button" href="#descubre">Empieza a descubrir <ArrowRight /></a><button className="button button-ghost" onClick={() => openPreview()}><Play fill="currentColor" />Conoce la app</button></div>
          </div>
          <div className="earth-curtain" aria-hidden="true" />
          </div>
        </section>

        <section className="app-intro landing-container" id="descubre" aria-labelledby="app-intro-title">
          <div className="home-phone-window" ref={introPhone}><PhoneMockup /></div>
          <div className="app-intro-copy"><h2 id="app-intro-title" ref={introHeading} aria-label="Miles de rutas. Una sola app."><span className="intro-line" aria-hidden="true">{['Miles', 'de', 'rutas.'].map(word => <span className="word-mask" key={word}><span data-word>{word}</span></span>)}</span><span className="intro-line intro-line-muted" aria-hidden="true">{['Una', 'sola', 'app.'].map(word => <span className="word-mask" key={word}><span data-word>{word}</span></span>)}</span></h2></div>
        </section>

        <section className="overview landing-section landing-container" aria-labelledby="overview-title">
          <div className="section-heading" data-reveal><RevealTitle id="overview-title" mutedFrom={1}>Descubre. Graba. Conecta.</RevealTitle><p>Descubre, graba y comparte. Todo lo que te mueve,<br className="desktop-break" /> en un mismo lugar.</p></div>
          <div className="phone-showcase">{demos.map(({ id, title }, index) => <figure className={`showcase-item showcase-${id}`} data-reveal key={id}><div className="phone-panel" data-parallax="phone"><ExplorePhone variant={id} cleanFrame={index === 2} /></div><figcaption><button onClick={() => openPreview(id)}>{title}<ArrowRight /></button><span>{['Encuentra tu próximo lugar favorito.', 'Convierte el camino en una historia.', 'La aventura también son las personas.'][index]}</span></figcaption></figure>)}</div>
        </section>

        <Worldwide onDiscover={() => openPreview('discover')} onExplore={() => openPreview('community')} />

        <section className="feature-row feature-reverse landing-container" id="rutas" aria-labelledby="routes-title">
          <div className="feature-copy" data-reveal><span className="landing-eyebrow">Graba tu camino</span><RevealTitle id="routes-title" mutedFrom={3}>Cada ruta merece<br />ser recordada.</RevealTitle><p>El viaje empieza mucho antes de llegar. Graba tu recorrido, guarda lo que viviste y comparte esos pequeños descubrimientos que hicieron especial el camino.</p><ul className="feature-list"><li><Route />Tu recorrido, paso a paso</li><li><Camera />Lugares y experiencias en una historia</li><li><Users />Una nueva ruta para inspirar a otros</li></ul><button className="demo-link" onClick={() => openPreview('record')}><span><Play fill="currentColor" /></span><div><strong>Tu primera ruta empieza aquí</strong><small>Prueba la vista de recorrido</small></div><ArrowRight /></button></div>
          <div className="feature-visual recording-visual" data-reveal data-parallax="phone"><ExplorePhone variant="record" cleanFrame /><div className="floating-route" aria-hidden="true"><span><Check /></span><div><strong>Un camino. Tu historia.</strong><small>Recuerda lo que te hizo llegar.</small></div></div></div>
        </section>

        <section className="destinations-section landing-section landing-container" aria-labelledby="destinations-title">
          <div className="section-heading" data-reveal><span className="landing-eyebrow">Cambia de perspectiva</span><RevealTitle id="destinations-title" mutedFrom={2}>Sal de lo conocido.</RevealTitle><p>A veces, el mejor plan es descubrir un lugar<br className="desktop-break" /> que ni siquiera sabías que existía.</p></div>
          <div className="destination-grid">{[{image:'mountains',tag:'Naturaleza',title:'Donde empieza el sendero.',text:'Un nuevo camino. Otra forma de mirar.'},{image:'coast',tag:'Escapadas',title:'Un rincón junto al mar.',text:'Desconecta de lo de siempre.'},{image:'forest',tag:'Aventura',title:'Un mundo que te sorprende.',text:'Deja espacio para lo inesperado.'}].map(place => <button className="destination-card" data-reveal key={place.image} onClick={() => openPreview('discover')}><div className="destination-image" data-parallax="image"><img src={`/explore-home/images/destinations/${place.image}.jpg`} alt={place.image === 'coast' ? 'Playa de agua turquesa al atardecer' : place.image === 'forest' ? 'Bosque con fauna y montañas' : 'Valle entre montañas'} loading="lazy" /><span>{place.tag}</span><i><ArrowRight /></i></div><RevealTitle as="h3" mutedFrom={2}>{place.title}</RevealTitle><p>{place.text}</p></button>)}</div>
        </section>

        <section className="closing-section" aria-labelledby="closing-title"><div className="landing-container closing-inner" data-reveal><span className="app-icon"><img src="/explore-home/brand/explore-symbol.svg" alt="" /></span><RevealTitle id="closing-title" mutedFrom={3}>Tu próxima historia<br />está ahí fuera.</RevealTitle><p>Un lugar por descubrir. Una ruta por vivir.<br />Personas que todavía no conoces.</p><button className="button button-white" onClick={() => openPreview()}>Conoce Explore<ArrowRight /></button></div></section>
      </main>
      {preview && <PreviewDialog variant={preview} setVariant={setPreview} onClose={() => setPreview(null)} />}
    </>
  );
}
