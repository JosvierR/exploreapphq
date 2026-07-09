import { motion, useReducedMotion } from "motion/react";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { T } from "@/components/ui/T";
import type { PioneerChallenge } from "@/features/pioneers/types";

type PioneerChallengeCardsProps = {
  challenges: PioneerChallenge[];
};

export function PioneerChallengeCards({ challenges }: PioneerChallengeCardsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="pioneer-section" id="retos" aria-labelledby="pioneer-challenges-title">
      <div className="container">
        <div className="pioneer-section-heading">
          <p className="pioneer-eyebrow">
            <T k="pioneer.challenges.eyebrow" />
          </p>
          <h2 id="pioneer-challenges-title" className="pioneer-section-title">
            <T k="pioneer.challenges.title" />
          </h2>
          <p className="pioneer-section-lead">
            <T k="pioneer.challenges.lead" />
          </p>
        </div>

        <div className="pioneer-challenge-grid">
          {challenges.map((challenge, index) => (
            <motion.article
              key={challenge.id}
              className="pioneer-challenge-card"
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.08, duration: 0.45 }}
              whileHover={reduceMotion ? undefined : { y: -6 }}
            >
              <div className="pioneer-challenge-card__top">
                <span className="pioneer-challenge-card__icon">{challenge.iconLabel}</span>
                <span className="pioneer-challenge-card__points">
                  +{reduceMotion ? challenge.points : <SlidingNumber number={challenge.points} inView />}{" "}
                  <T k="pioneer.points.short" />
                </span>
              </div>
              <h3>
                <T k={challenge.titleKey} />
              </h3>
              <p>
                <T k={challenge.descriptionKey} />
              </p>
              <div className="pioneer-progress">
                <div className="pioneer-progress__meta">
                  <span>
                    {challenge.progressCurrent}/{challenge.progressTarget}
                  </span>
                  <span>
                    <T k={challenge.badgeLabelKey} />
                  </span>
                </div>
                <div className="pioneer-progress__track">
                  <span style={{ width: `${(challenge.progressCurrent / challenge.progressTarget) * 100}%` }} />
                </div>
              </div>
              <small>
                <T k={challenge.microcopyKey} />
              </small>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
