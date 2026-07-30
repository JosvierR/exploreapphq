import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import { APP_SCREENS } from "@/lib/constants";

const POINTS = [
  "pioneer.whatIs.point1",
  "pioneer.whatIs.point2",
  "pioneer.whatIs.point3",
] as const;

const CREATOR_MOSAIC = APP_SCREENS.whatIsMosaic;
const SLIDE_INTERVAL_MS = 3200;

function PioneerMosaicSlideshow({ images }: { images: readonly string[] }) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduceMotion || paused) return;
    const id = setInterval(() => {
      setActive((current) => (current + 1) % images.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduceMotion, paused, images.length]);

  return (
    <div
      className="pioneer-what__mosaic"
      aria-hidden="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {images.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className={`pioneer-what__mosaic-item${index === active ? " is-active" : ""}`}
        />
      ))}
      <div className="pioneer-what__mosaic-dots">
        {images.map((src, index) => (
          <span key={src} className={`pioneer-what__mosaic-dot${index === active ? " is-active" : ""}`} />
        ))}
      </div>
    </div>
  );
}

export function PioneerWhatIs() {
  const reduceMotion = useReducedMotion();

  return (
      <section
          className="pioneer-section pioneer-section--intro"
          aria-labelledby="pioneer-what-title"
      >
        <div className="container pioneer-what">
          {/* Columna izquierda: Texto */}
          <motion.div
              className="pioneer-what__copy"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45 }}
          >
            <p className="pioneer-eyebrow">
              <T k="pioneer.whatIs.eyebrow" />
            </p>
            <h2 id="pioneer-what-title" className="pioneer-section-title">
              <T k="pioneer.whatIs.title" />
            </h2>
            <p className="pioneer-section-lead">
              <T k="pioneer.whatIs.lead" />
            </p>

            {/* Señales convertidas en badges pixelados */}
            <div className="pioneer-what__signal">
            <span className="pixel-badge">
              <T k="pioneer.whatIs.signal1" />
            </span>
              <span className="pixel-badge">
              <T k="pioneer.whatIs.signal2" />
            </span>
              <span className="pixel-badge">
              <T k="pioneer.whatIs.signal3" />
            </span>
            </div>
          </motion.div>

          {/* Panel: imagen grande + contenido */}
          <motion.div
              className="pioneer-what__panel pixel-panel"
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: 0.08, duration: 0.5 }}
          >
            <div className="pioneer-what__panel-grid">
              {/* Slideshow de imágenes con desvanecimiento automático */}
              <PioneerMosaicSlideshow images={CREATOR_MOSAIC} />

              <div className="pioneer-what__panel-copy">
                {/* Cita destacada */}
                <blockquote className="pioneer-what__quote pixel-quote">
                  <T k="pioneer.whatIs.quote" />
                </blockquote>

                {/* Lista de puntos con iconos pixel */}
                <ul className="pioneer-check-list pioneer-what__list">
                  {POINTS.map((key) => (
                      <li key={key} className="pixel-list-item">
                        <T k={key} />
                      </li>
                  ))}
                </ul>

                {/* Tira del creador */}
                <div className="pioneer-what__creator-strip pixel-creator-strip">
                  <img
                      src={APP_SCREENS.hero}
                      alt=""
                      loading="lazy"
                      className="pixel-creator-avatar"
                  />
                  <div>
                    <strong>
                      <T k="pioneer.whatIs.creatorTitle" />
                    </strong>
                    <p>
                      <T k="pioneer.whatIs.creatorDesc" />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
  );
}