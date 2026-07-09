import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import { APP_SCREENS } from "@/lib/constants";
import type { PioneerReward } from "@/features/pioneers/types";

type PioneerRewardsProps = {
  rewards: PioneerReward[];
};

const REWARD_FALLBACK_IMAGES: Record<string, string> = {
  badge: APP_SCREENS.gallery[6],
  profile: APP_SCREENS.hero,
  repost: APP_SCREENS.gallery[1],
  ranking: APP_SCREENS.routeMap,
  early: APP_SCREENS.gallery[5],
  creator: APP_SCREENS.gallery[3],
};

export function PioneerRewards({ rewards }: PioneerRewardsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="pioneer-section pioneer-section--rewards" id="recompensas" aria-labelledby="pioneer-rewards-title">
      <div className="container">
        <div className="pioneer-section-heading pioneer-section-heading--rewards">
          <p className="pioneer-eyebrow">
            <T k="pioneer.rewards.eyebrow" />
          </p>
          <h2 id="pioneer-rewards-title" className="pioneer-section-title">
            <T k="pioneer.rewards.title" />
          </h2>
          <p className="pioneer-section-lead">
            <T k="pioneer.rewards.lead" />
          </p>
        </div>

        <div className="pioneer-rewards-bento">
          {rewards.map((reward, index) => {
            const image = reward.image || REWARD_FALLBACK_IMAGES[reward.id] || APP_SCREENS.hero;

            return (
              <motion.article
                key={reward.id}
                className={`pioneer-reward-card pioneer-reward-card--${reward.id}${reward.featured ? " pioneer-reward-card--featured" : ""}`}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: index * 0.05, duration: 0.42 }}
              >
                <div className="pioneer-reward-card__media" aria-hidden="true">
                  <img src={image} alt="" loading="lazy" />
                  <span className="pioneer-reward-card__index">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="pioneer-reward-card__body">
                  <h3>
                    <T k={reward.titleKey} />
                  </h3>
                  <p>
                    <T k={reward.descriptionKey} />
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="pioneer-rewards-note">
          <div className="pioneer-rewards-note__visual" aria-hidden="true">
            <img src={APP_SCREENS.gallery[0]} alt="" loading="lazy" />
            <img src={APP_SCREENS.gallery[4]} alt="" loading="lazy" />
            <img src={APP_SCREENS.gallery[5]} alt="" loading="lazy" />
          </div>
          <p>
            <T k="pioneer.rewards.note" />
          </p>
        </div>
      </div>
    </section>
  );
}
