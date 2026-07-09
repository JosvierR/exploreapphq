import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import type { PioneerVideoCard } from "@/features/pioneers/types";

type PioneerVideoShowcaseProps = {
  videoCards: PioneerVideoCard[];
};

export function PioneerVideoShowcase({ videoCards }: PioneerVideoShowcaseProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="pioneer-section" aria-labelledby="pioneer-showcase-title">
      <div className="container pioneer-showcase">
        <div className="pioneer-section-heading">
          <p className="pioneer-eyebrow">
            <T k="pioneer.showcase.eyebrow" />
          </p>
          <h2 id="pioneer-showcase-title" className="pioneer-section-title">
            <T k="pioneer.showcase.title" />
          </h2>
          <p className="pioneer-section-lead">
            <T k="pioneer.showcase.lead" />
          </p>
        </div>

        <div className="pioneer-video-strip">
          {videoCards.map((card, index) => (
            <motion.article
              key={card.id}
              className="pioneer-video-card"
              initial={reduceMotion ? false : { opacity: 0, x: 20 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.04, duration: 0.4 }}
            >
              <img src={card.image} alt="" loading="lazy" />
              <div>
                <span>
                  <T k={card.typeKey} />
                </span>
                <h3>
                  <T k={card.titleKey} />
                </h3>
                <p>{card.creator}</p>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="pioneer-social-note">
          <p>
            <T k="pioneer.showcase.social" />
          </p>
        </div>
      </div>
    </section>
  );
}
