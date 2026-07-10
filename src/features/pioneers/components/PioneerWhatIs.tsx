import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import { APP_SCREENS } from "@/lib/constants";

const POINTS = [
  "pioneer.whatIs.point1",
  "pioneer.whatIs.point2",
  "pioneer.whatIs.point3",
] as const;

const CREATOR_MOSAIC = APP_SCREENS.whatIsMosaic;

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

          {/* Columna derecha: Panel interactivo */}
          <motion.div
              className="pioneer-what__panel pixel-panel"
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: 0.08, duration: 0.5 }}
          >
            {/* Mosaico de imágenes con estilo pixelado */}
            <div className="pioneer-what__mosaic pixel-mosaic" aria-hidden="true">
              {CREATOR_MOSAIC.map((src, index) => (
                  <img
                      key={src}
                      src={src}
                      alt=""
                      loading="lazy"
                      className={`pioneer-what__mosaic-item pixel-mosaic__item pixel-mosaic__item--${index + 1}`}
                  />
              ))}
            </div>

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
          </motion.div>
        </div>
      </section>
  );
}