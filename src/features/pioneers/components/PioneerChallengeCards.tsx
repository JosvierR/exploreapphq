import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { OpenExploreMissionButton } from "@/features/pioneers/components/OpenExploreMissionButton";
import type { ChallengeType } from "@/features/pioneers/lib/exploreAppLink";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { T } from "@/components/ui/T";
import { STORE_URLS } from "@/lib/constants";
import type { PioneerChallenge } from "@/features/pioneers/types";

type PioneerChallengeCardsProps = {
  challenges: PioneerChallenge[];
  source?: "mock" | "api";
};

export function PioneerChallengeCards({ challenges, source = "mock" }: PioneerChallengeCardsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="pioneer-section pioneer-section--challenges" id="retos" aria-labelledby="pioneer-challenges-title">
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
          {source === "api" && (
            <p className="pioneer-live-pill">
              <T k="pioneer.challenges.live" />
            </p>
          )}
        </div>

        <div className="pioneer-challenge-grid">
          {challenges.map((challenge, index) => {
            const progressPct = Math.min(100, (challenge.progressCurrent / challenge.progressTarget) * 100);

            return (
              <motion.article
                key={challenge.id}
                className={`pioneer-challenge-card pioneer-challenge-card--${challenge.id}`}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                whileHover={reduceMotion ? undefined : { y: -6 }}
              >
                <div className="pioneer-challenge-card__header">
                  <span className="pioneer-challenge-card__icon" aria-hidden="true">
                    {challenge.iconLabel}
                  </span>
                  <div className="pioneer-challenge-card__meta">
                    <span className="pioneer-challenge-card__points">
                      +{reduceMotion ? challenge.points : <SlidingNumber number={challenge.points} inView />}{" "}
                      <T k="pioneer.points.short" />
                    </span>
                    <span className="pioneer-challenge-card__badge">
                      <T k={challenge.badgeLabelKey} />
                    </span>
                  </div>
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
                      <T k="pioneer.challenge.community" /> {challenge.communityCount ?? challenge.progressCurrent}/
                      {challenge.progressTarget}
                    </span>
                    <span>{Math.round(progressPct)}%</span>
                  </div>
                  <div className="pioneer-progress__track">
                    <span style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                <small>
                  <T k={challenge.microcopyKey} />
                </small>

                <div className="pioneer-challenge-card__actions">
                  <OpenExploreMissionButton
                    challengeId={challenge.id as ChallengeType}
                    className="pioneer-liquid-button pioneer-liquid-button--block"
                  />
                  <Link className="pioneer-secondary-button pioneer-secondary-button--block" to="/explorar">
                    <T k="pioneer.challenge.learnMore" />
                  </Link>
                  <a className="pioneer-challenge-card__store" href={STORE_URLS.apple} target="_blank" rel="noopener noreferrer">
                    <T k="pioneer.challenge.getApp" />
                  </a>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
