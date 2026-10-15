import {
  BatteryFull, Camera, CloudSun, Compass, CreditCard, Heart, ListTodo,
  MessageCircle, Music2, Navigation2, Newspaper, Phone, Rocket,
  Settings, Signal, Video, Wifi, Mail,
} from 'lucide-react';
import './PhoneMockup.css';

const apps = [
  { name: 'FaceTime', theme: 'green', Icon: Video },
  { name: 'Calendario', theme: 'calendar' },
  { name: 'Explore', theme: 'explore' },
  { name: 'Cámara', theme: 'camera', Icon: Camera },
  { name: 'Mail', theme: 'mail', Icon: Mail },
  { name: 'Notas', theme: 'notes' },
  { name: 'Recordatorios', theme: 'reminders', Icon: ListTodo },
  { name: 'Reloj', theme: 'clock' },
  { name: 'Noticias', theme: 'news', Icon: Newspaper },
  { name: 'TV', theme: 'tv' },
  { name: 'Juegos', theme: 'games', Icon: Rocket },
  { name: 'App Store', theme: 'store' },
  { name: 'Mapas', theme: 'maps', Icon: Navigation2 },
  { name: 'Salud', theme: 'health', Icon: Heart },
  { name: 'Wallet', theme: 'wallet', Icon: CreditCard },
  { name: 'Ajustes', theme: 'settings', Icon: Settings },
];

function AppIcon({ theme, Icon }) {
  return (
    <span className={`phone-app-icon phone-app-icon--${theme}`}>
      {Icon && <Icon strokeWidth={1.8} />}
      {theme === 'explore' && <img className="phone-explore-symbol" src="/explore-home/brand/explore-symbol.svg" alt="" />}
      {theme === 'calendar' && <><small>Sáb</small><strong>10</strong></>}
      {theme === 'notes' && <span className="note-lines" />}
      {theme === 'clock' && <span className="clock-face"><i /><b /></span>}
      {theme === 'tv' && <strong>tv</strong>}
      {theme === 'store' && <svg viewBox="0 0 64 64" fill="none"><path d="m24 13 24 40M40 13 16 53M11 43h42" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>}
    </span>
  );
}

export default function PhoneMockup() {
  return (
    <div className="phone-device" aria-hidden="true">
      <img className="phone-family-frame" src="/explore-home/images/family-iphone-frame.png" alt="" width="762" height="1502" />
      <div className="phone-screen">
        <div className="phone-status"><span>9:41</span><div><Signal /><Wifi /><BatteryFull /></div></div>
        <div className="phone-widgets">
          <div className="phone-widget-group">
            <div className="home-widget weather-widget"><strong>San Diego</strong><span className="weather-degrees">23°</span><CloudSun /><span>Parcialmente nublado</span><small>Máx: 24° Mín: 18°</small></div>
            <span className="widget-label">Tiempo</span>
          </div>
          <div className="phone-widget-group">
            <div className="home-widget calendar-widget"><small>SÁBADO</small><span className="calendar-date">10</span><span className="calendar-event">Tu próxima ruta</span><span className="calendar-note">El mundo te espera</span></div>
            <span className="widget-label">Calendario</span>
          </div>
        </div>
        <div className="phone-apps">
          {apps.map(app => <div className={`phone-app${app.theme === 'explore' ? ' phone-app--explore' : ''}`} key={app.name}><AppIcon {...app} /><span>{app.name}</span></div>)}
        </div>
        <div className="phone-search"><span />Buscar</div>
        <div className="phone-dock">
          <AppIcon theme="green" Icon={Phone} />
          <AppIcon theme="safari" Icon={Compass} />
          <AppIcon theme="green" Icon={MessageCircle} />
          <AppIcon theme="music" Icon={Music2} />
        </div>
        <div className="phone-home-indicator" />
      </div>
    </div>
  );
}
