import { useEffect, useState } from 'react';
import {
  BatteryFull, Bell, Bookmark, Check, ChevronLeft, Compass, Heart,
  House, MapPin, MessageCircle, MoreHorizontal, Pause, Play, Plus,
  Route, Search, Signal, Users, Wifi,
} from 'lucide-react';
import './ExplorePhone.css';

const photos = {
  mountain: '/explore-home/images/destinations/mountains.jpg',
  coast: '/explore-home/images/destinations/coast.jpg',
  forest: '/explore-home/images/destinations/forest.jpg',
};

export function RouteMap({ className = '' }) {
  return (
    <svg className={`route-map ${className}`} viewBox="0 0 320 430" fill="none" aria-hidden="true">
      <rect width="320" height="430" fill="var(--map-background)" />
      <path d="M-25 76C42 30 95 56 111 119S186 158 225 119 306 91 350 147V-15H-25Z" fill="var(--map-land)" />
      <path d="M-26 313C44 254 115 349 176 281S278 282 348 209V453H-26Z" fill="var(--map-land)" />
      {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M-20 ${46 + i * 23}C65 ${i * 21} 45 ${115 + i * 18} 134 ${112 + i * 16}S264 ${42 + i * 26} 345 ${94 + i * 25}`} stroke="var(--map-contour)" strokeWidth="1" />)}
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M-20 ${275 + i * 24}C53 ${240 + i * 23} 94 ${374 + i * 10} 161 ${316 + i * 20}S264 ${280 + i * 21} 344 ${300 + i * 26}`} stroke="var(--map-contour)" strokeWidth="1" />)}
      <path d="M275-20C227 77 286 102 245 174S166 227 193 301 257 349 241 450" stroke="var(--map-water)" strokeWidth="23" />
      <path d="M-10 206C75 184 92 228 155 216S273 179 337 212" stroke="#fff" strokeWidth="10" />
      <path d="M-10 206C75 184 92 228 155 216S273 179 337 212" stroke="var(--map-road)" strokeWidth="1" strokeDasharray="3 3" />
      <path className="map-route-shadow" d="M74 325C60 303 100 298 91 274S133 255 120 229 160 209 149 188 118 185 128 158 176 144 163 117 202 103 192 81" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
      <path className="landing-map-route-line" d="M74 325C60 303 100 298 91 274S133 255 120 229 160 209 149 188 118 185 128 158 176 144 163 117 202 103 192 81" stroke="#0066ff" strokeWidth="5" strokeLinecap="round" />
      <circle cx="74" cy="325" r="9" fill="#0066ff" stroke="#fff" strokeWidth="4" />
      <circle cx="192" cy="81" r="11" fill="#0066ff" stroke="#fff" strokeWidth="4" />
      <circle cx="192" cy="81" r="3" fill="#fff" />
      <g fill="var(--map-label)" fontFamily="sans-serif" fontSize="8"><text x="39" y="125">EL MIRADOR</text><text x="178" y="365">SENDERO DEL BOSQUE</text></g>
    </svg>
  );
}

function PhoneControl({ interactive, children, ...props }) {
  return interactive ? <button type="button" {...props}>{children}</button> : <span className={props.className}>{children}</span>;
}

function DiscoverScreen({ interactive }) {
  const [category, setCategory] = useState('Naturaleza');
  const [saved, setSaved] = useState(false);
  const beach = category === 'Playas';
  return (
    <>
      <div className="ep-app-head"><img src="/explore-home/brand/explore-brand-blue.svg" alt="Explore" /><Bell /></div>
      <div className="ep-discover-copy"><small>Tu próxima historia</small><h3>Está ahí fuera.</h3></div>
      <div className="ep-search"><Search /><span>¿Qué quieres descubrir?</span></div>
      <div className="ep-categories">{['Naturaleza', 'Playas', 'Escapadas'].map(name => <PhoneControl interactive={interactive} key={name} className={category === name ? 'active' : ''} onClick={() => { setCategory(name); setSaved(false); }} aria-pressed={category === name}>{name}</PhoneControl>)}</div>
      <div className="ep-section-label"><strong>Fuera de lo de siempre</strong><span>Ver todo</span></div>
      <article className="ep-place-card">
        <div className="ep-place-photo"><img src={beach ? photos.coast : category === 'Escapadas' ? photos.forest : photos.mountain} alt={beach ? 'Una costa de aguas turquesa' : 'Paisaje de montaña'} /><span className="ep-place-tag"><MapPin />Por descubrir</span><PhoneControl interactive={interactive} className={`ep-save ${saved ? 'saved' : ''}`} onClick={() => setSaved(value => !value)} aria-label={saved ? 'Quitar de guardados' : 'Guardar lugar'} aria-pressed={saved}><Bookmark fill={saved ? 'currentColor' : 'none'} /></PhoneControl></div>
        <div className="ep-place-description"><h4>{beach ? 'Un rincón junto al mar' : category === 'Escapadas' ? 'Donde el tiempo se detiene' : 'El camino que no conocías'}</h4><span>{beach ? 'Costa · Una pausa para ti' : 'Senderismo · 6,4 km de descubrimientos'}</span><div className="ep-card-person"><span className="ep-avatar coral">M</span><span>Compartido por María</span><Heart /></div></div>
      </article>
      <div className="ep-bottom-photo"><img src={beach ? photos.mountain : photos.coast} alt="Otro paisaje por descubrir" /><span>Tu siguiente escapada</span></div>
    </>
  );
}

function RecordScreen({ interactive }) {
  const [recording, setRecording] = useState(false);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(interval);
  }, [recording]);
  const time = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  return (
    <div className={`ep-record-view${recording ? ' ep-recording' : ''}`}>
      <RouteMap />
      <div className="ep-map-toolbar"><span><ChevronLeft /></span><strong>Tu recorrido</strong><span><MoreHorizontal /></span></div>
      <div className={`ep-record-pill ${recording ? 'recording' : ''}`}>{recording ? <><i />Grabando tu historia</> : finished ? <><Check />Ruta guardada</> : <><Route />Ruta de montaña</>}</div>
      <span className="ep-map-location"><Compass /></span>
      <div className="ep-route-summary"><small>{finished ? 'Una nueva experiencia para compartir' : 'Cada paso cuenta'}</small><h3>Un camino para recordar.</h3><div className="ep-route-stats"><span><strong>6,4 <small>km</small></strong>Distancia</span><span><strong>{recording || finished ? time : '01:24'}</strong>Tiempo</span><span><strong>320 <small>m</small></strong>Desnivel</span></div><PhoneControl interactive={interactive} className="ep-record-button" onClick={() => { if (recording) { setRecording(false); setFinished(true); } else { setSeconds(0); setFinished(false); setRecording(true); } }}>{recording ? <><Pause />Finalizar recorrido</> : finished ? <><Plus />Grabar otra ruta</> : <><Play fill="currentColor" />Grabar mi ruta</>}</PhoneControl></div>
    </div>
  );
}

function CommunityScreen({ interactive }) {
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState(false);
  return (
    <>
      <div className="ep-app-head"><strong>Tu comunidad</strong><MessageCircle /></div>
      <div className="ep-community-copy"><h3>La aventura se comparte.</h3><span>Encuentra a tu gente.</span></div>
      <div className="ep-people-row">{[['M', 'María', 'coral'], ['J', 'Javier', 'mint'], ['L', 'Lucía', 'lilac'], ['A', 'Alex', 'blue']].map(([initial, name, color]) => <div key={name}><span className={`ep-avatar ${color}`}>{initial}</span><small>{name}</small></div>)}</div>
      <article className="ep-social-post"><div className="ep-post-head"><span className="ep-avatar coral">M</span><div><strong>María R.</strong><span>Senderismo · Naturaleza</span></div><PhoneControl interactive={interactive} className={`ep-follow ${following ? 'following' : ''}`} onClick={() => setFollowing(value => !value)} aria-pressed={following}>{following ? 'Siguiendo' : 'Seguir'}</PhoneControl></div><img className="ep-post-photo" src={photos.forest} alt="Un bosque y una montaña al atardecer" /><div className="ep-post-actions"><PhoneControl interactive={interactive} onClick={() => setLiked(value => !value)} aria-label={liked ? 'Quitar me gusta' : 'Me gusta'} aria-pressed={liked} className={liked ? 'liked' : ''}><Heart fill={liked ? 'currentColor' : 'none'} /></PhoneControl><MessageCircle /><Bookmark /></div><p>Hay lugares que te hacen detenerte. Este es uno de ellos. 🌿</p><span className="ep-post-route"><Route />Ver el recorrido<ChevronLeft /></span></article>
      <div className="ep-social-next"><span className="ep-avatar mint">J</span><div><strong>Javier A.</strong><small>Siempre buscando un nuevo camino</small></div></div>
    </>
  );
}

export default function ExplorePhone({ variant = 'discover', className = '', interactive = false, cleanFrame = false }) {
  return (
    <div className={`explore-phone ep-${variant} ${className}`} aria-hidden={interactive ? undefined : true}>
      <div className="ep-screen">
        <div className="ep-status"><strong>9:41</strong><span><Signal /><Wifi /><BatteryFull /></span></div>
        {cleanFrame && <span className="ep-dynamic-island" />}
        <div className="ep-content">{variant === 'record' ? <RecordScreen interactive={interactive} /> : variant === 'community' ? <CommunityScreen interactive={interactive} /> : <DiscoverScreen interactive={interactive} />}</div>
        <div className="ep-tabbar">{[[House, 'Inicio', 'discover'], [Route, 'Rutas', 'record'], [Plus, '', 'create'], [Users, 'Personas', 'community'], [Bookmark, 'Guardados', 'saved']].map(([Icon, name, tab]) => <span key={tab} className={variant === tab ? 'active' : tab === 'create' ? 'create' : ''}><Icon /><small>{name}</small></span>)}</div>
        <span className="ep-home-indicator" />
      </div>
      <img className="ep-frame" src={cleanFrame ? '/explore-home/images/family-iphone-frame-clean.png' : '/explore-home/images/family-iphone-frame.png'} alt="" width="381" height="751" loading="lazy" />
    </div>
  );
}
