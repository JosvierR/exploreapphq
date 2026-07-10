import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import { APP_SCREENS } from "@/lib/constants";
import type { PioneerReward } from "@/features/pioneers/types";

type PioneerRewardsProps = {
  rewards: PioneerReward[];
};

const REWARD_FALLBACK_IMAGES: Record<string, string> = {
  badge: APP_SCREENS.rewards.badge,
  profile: APP_SCREENS.rewards.profile,
  repost: APP_SCREENS.rewards.repost,
  ranking: APP_SCREENS.rewards.ranking,
  early: APP_SCREENS.rewards.early,
  creator: APP_SCREENS.rewards.creator,
};

export function PioneerRewards({ rewards }: PioneerRewardsProps) {
  const reduceMotion = useReducedMotion();

  return (
      <section
          className="pioneer-section pioneer-section--rewards"
          id="recompensas"
          aria-labelledby="pioneer-rewards-title"
      >
        <div className="container">
          <div className="pioneer-section-heading pioneer-section-heading--rewards">
            <p className="pioneer-eyebrow pixel-eyebrow">
              <T k="pioneer.rewards.eyebrow" />
            </p>
            <h2 id="pioneer-rewards-title" className="pioneer-section-title pixel-section-title">
              <T k="pioneer.rewards.title" />
            </h2>
            <p className="pioneer-section-lead pixel-section-lead">
              <T k="pioneer.rewards.lead" />
            </p>
          </div>

          <div className="pioneer-rewards-bento">
            {rewards.map((reward, index) => {
              const image =
                  reward.image || REWARD_FALLBACK_IMAGES[reward.id] || APP_SCREENS.hero;

              return (
                  <motion.article
                      key={reward.id}
                      className={`pioneer-reward-card pixel-reward-card ${
                          reward.featured ? "pioneer-reward-card--featured pixel-reward-card--featured" : ""
                      }`}
                      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ delay: index * 0.05, duration: 0.42 }}
                  >
                    <div className="pioneer-reward-card__media pixel-reward-media" aria-hidden="true">
                      <img src={image} alt="" loading="lazy" />
                      <span className="pioneer-reward-card__index pixel-reward-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                    </div>
                    <div className="pioneer-reward-card__body pixel-reward-body">
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

          <div className="pioneer-rewards-note pixel-rewards-note">
            <div className="pioneer-rewards-note__visual" aria-hidden="true">
              <img
                  src={APP_SCREENS.gallery[0]}
                  alt=""
                  loading="lazy"
                  className="pixel-note-img"
              />
              <img
                  src={APP_SCREENS.gallery[4]}
                  alt=""
                  loading="lazy"
                  className="pixel-note-img"
              />
              <img
                  src={APP_SCREENS.gallery[5]}
                  alt=""
                  loading="lazy"
                  className="pixel-note-img"
              />
            </div>
            <p className="pixel-note-text">
              <T k="pioneer.rewards.note" />
            </p>
          </div>
        </div>
      </section>
  );
}