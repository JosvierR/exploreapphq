import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import { APP_SCREENS } from "@/lib/constants";

const POINTS = [
  "pioneer.whatIs.point1",
  "pioneer.whatIs.point2",
  "pioneer.whatIs.point3",
] as const;

const CREATOR_MOSAIC = [APP_SCREENS.gallery[0], APP_SCREENS.gallery[4], APP_SCREENS.gallery[2], APP_SCREENS.hero] as const;

export function PioneerWhatIs() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="pioneer-section pioneer-section--intro" aria-labelledby="pioneer-what-title">
      <div className="container pioneer-what">
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
          <div className="pioneer-what__signal">
            <span>
              <T k="pioneer.whatIs.signal1" />
            </span>
            <span>
              <T k="pioneer.whatIs.signal2" />
            </span>
            <span>
              <T k="pioneer.whatIs.signal3" />
            </span>
          </div>
        </motion.div>

        <motion.div
          className="pioneer-what__panel"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: 0.08, duration: 0.5 }}
        >
          <div className="pioneer-what__mosaic" aria-hidden="true">
            {CREATOR_MOSAIC.map((src, index) => (
              <img key={src} src={src} alt="" loading="lazy" className={`pioneer-what__mosaic-item pioneer-what__mosaic-item--${index + 1}`} />
            ))}
          </div>
          <blockquote className="pioneer-what__quote">
            <T k="pioneer.whatIs.quote" />
          </blockquote>
          <ul className="pioneer-check-list pioneer-what__list">
            {POINTS.map((key) => (
              <li key={key}>
                <T k={key} />
              </li>
            ))}
          </ul>
          <div className="pioneer-what__creator-strip">
            <img src={APP_SCREENS.hero} alt="" loading="lazy" />
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
