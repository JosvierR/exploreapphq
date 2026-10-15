import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Compass, Mountain, Pause, Play, Route, Users, Waves } from 'lucide-react';
import RevealTitle from './RevealTitle';
import './Worldwide.css';

// Map transforms and carousel timing adapted from Osmo's public Connect Worldwide section.
const destinations = [
  { code: 'uk', country: 'Reino Unido', interest: 'Lugares fuera de lo habitual', title: 'Lo mejor no siempre sale en las guías.', text: 'Un sendero escondido. Una playa que casi nadie conoce. Ese lugar que alguien encontró por casualidad y decidió compartir.', Icon: Compass, transform: 'translate(15%, 25%) scale(4)' },
  { code: 'swe', country: 'Suecia', interest: 'Inspiración para tu próxima escapada', title: 'La misma curiosidad. Otro horizonte.', text: 'Encuentra inspiración en quienes disfrutan perderse entre bosques, lagos y nuevos senderos.', Icon: Mountain, transform: 'translate(-5%, 45%) scale(3.5)' },
  { code: 'nl', country: 'Países Bajos', interest: 'Experiencias compartidas', title: 'Un lugar se descubre a través de su gente.', text: 'Explora experiencias que te acercan a un mundo que todavía te falta por conocer.', Icon: Users, transform: 'translate(8%, 40%) scale(5.5)' },
  { code: 'aus', country: 'Australia', interest: 'Junto al mar', title: 'Las ganas de explorar no tienen fronteras.', text: 'Desde una escapada junto al mar hasta un recorrido inesperado, una aventura puede acercarte a alguien.', Icon: Waves, transform: 'translate(-70%, -60%) scale(2)' },
  { code: 'ca', country: 'Canadá', interest: 'Rutas compartidas por la comunidad', title: 'Nuevos caminos. Nuevas conexiones.', text: 'Conecta con personas que comparten tu pasión por la naturaleza y descubre el mundo a través de sus recorridos.', Icon: Route, transform: 'translate(33%, 17%) scale(1.1)' },
  { code: 'vnm', country: 'Vietnam', interest: 'Experiencias locales', title: 'La próxima historia puede empezar lejos.', text: 'Comparte lo que viviste y conoce otra perspectiva. Un interés en común puede ser el comienzo de una conexión.', Icon: Users, transform: 'translate(-80%, -40%) scale(3)' },
];

export default function Worldwide({ onDiscover, onExplore }) {
  const section = useRef(null);
  const progress = useRef(null);
  const animation = useRef(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const current = destinations[active];

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .25 });
    observer.observe(section.current);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotion = event => setReducedMotion(event.matches);
    media.addEventListener('change', handleMotion);
    return () => { observer.disconnect(); media.removeEventListener('change', handleMotion); };
  }, []);

  useEffect(() => {
    const cycle = progress.current.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -1160 }], { duration: 4000, fill: 'both', easing: 'linear' });
    cycle.pause();
    animation.current = cycle;
    let cancelled = false;
    cycle.finished.then(() => { if (!cancelled) setActive(index => (index + 1) % destinations.length); }).catch(() => {});
    return () => { cancelled = true; cycle.cancel(); };
  }, [active]);

  useEffect(() => {
    if (visible && playing && !interacting && !reducedMotion) animation.current?.play();
    else animation.current?.pause();
  }, [active, visible, playing, interacting, reducedMotion]);

  const change = direction => setActive(index => (index + direction + destinations.length) % destinations.length);
  return (
    <section ref={section} className="worldwide-section landing-section landing-container" aria-labelledby="worldwide-title">
      <div className="worldwide-heading" data-reveal><div><span className="landing-eyebrow">Descubre lo inesperado</span><RevealTitle id="worldwide-title" mutedFrom={1}>Conecta. <span>Sin fronteras.</span></RevealTitle></div><p>Lugares fuera de lo habitual.<br />Personas con tu misma curiosidad.</p></div>
      <div className="worldwide-layout">
        <div className="worldwide-map-panel" data-reveal>
          <p><span>Conecta</span><br />Con el mundo</p>
          <div className="worldwide-globe" aria-hidden="true">
            <svg className="worldwide-ring" viewBox="0 0 380 380" fill="none"><circle cx="190" cy="190" r="184.5" stroke="#3a424f" strokeWidth="11" strokeDasharray="1 9" /><circle ref={progress} cx="190" cy="190" r="184.5" stroke="#0066ff" strokeWidth="11" strokeDasharray="1160" /></svg>
            <div className="worldwide-map-mask"><div className="worldwide-map-layer" style={{ transform: current.transform }}><img src="/explore-home/images/worldwide/map-base.avif" alt="" width="3030" height="1998" loading="lazy" />{destinations.map(destination => <img key={destination.code} className={destination.code === current.code ? "landing-is-active" : ''} src={`/explore-home/images/worldwide/map-${destination.code}.svg`} alt="" width="1010" height="666" loading="lazy" />)}</div></div>
          </div>
        </div>
        <div className="worldwide-slider" data-reveal role="region" aria-roledescription="carrusel" aria-label="Conexiones alrededor del mundo">
          <div className="worldwide-card-stage">{destinations.map(({ code, country, interest, title, text, Icon }, index) => {
            let distance = (index - active + destinations.length) % destinations.length;
            if (distance > destinations.length / 2) distance -= destinations.length;
            const position = Math.max(-2, Math.min(2, distance));
            return <article key={code} className={`worldwide-card${index === active ? " landing-is-active" : ''}`} aria-hidden={index !== active} style={{ '--card-position': position }}><span className="worldwide-location"><span />{country}</span><RevealTitle as="h3">{title}</RevealTitle><div className="worldwide-card-bottom"><div className="worldwide-interest"><Icon /><span>{interest}</span></div><p>{text}</p></div></article>;
          })}</div>
          <div className="worldwide-controls" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocus={() => setInteracting(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
            <div className="worldwide-pagination">{destinations.map((destination, index) => <button key={destination.code} aria-label={`Ver ${destination.country}`} aria-current={active === index ? 'true' : undefined} onClick={() => setActive(index)}><span /></button>)}</div>
            <div className="worldwide-arrows"><button aria-label="País anterior" onClick={() => change(-1)}><ArrowUp /></button><button aria-label={playing ? 'Pausar recorrido del mapa' : 'Reanudar recorrido del mapa'} onClick={() => { setPlaying(value => !value); if (!playing) setInteracting(false); }}>{playing ? <Pause /> : <Play />}</button><button aria-label="Siguiente país" onClick={() => change(1)}><ArrowDown /></button></div>
          </div>
        </div>
      </div>
      <div className="worldwide-footer"><p>Lugares distintos. Intereses en común.</p><div className="worldwide-actions"><button className="worldwide-link" onClick={onDiscover}>Descubre un nuevo lugar <ArrowRight /></button><button className="worldwide-link" onClick={onExplore}>Conoce la comunidad <ArrowRight /></button></div></div>
    </section>
  );
}
