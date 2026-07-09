import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import type { PioneerReward } from "@/features/pioneers/types";

type PioneerRewardsProps = {
  rewards: PioneerReward[];
};

const REWARD_ICONS: Record<string, string> = {
  badge: "★",
  profile: "◎",
  repost: "↗",
  ranking: "▲",
  early: "⚡",
  creator: "◉",
};

export function PioneerRewards({ rewards }: PioneerRewardsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="pioneer-section pioneer-section--rewards" id="recompensas" aria-labelledby="pioneer-rewards-title">
      <div className="container">
        <div className="pioneer-section-heading">
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
        <div className="pioneer-rewards-grid">
          {rewards.map((reward, index) => (
            <motion.article
              key={reward.id}
              className={`pioneer-reward-card pioneer-reward-card--${reward.id}`}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: index * 0.06, duration: 0.42 }}
              whileHover={reduceMotion ? undefined : { y: -4 }}
            >
              <div className="pioneer-reward-card__shine" aria-hidden="true" />
              <div className="pioneer-reward-card__top">
                <span className="pioneer-reward-card__icon" aria-hidden="true">
                  {REWARD_ICONS[reward.id] || "✦"}
                </span>
                <span className="pioneer-reward-card__index">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3>
                <T k={reward.titleKey} />
              </h3>
              <p>
                <T k={reward.descriptionKey} />
              </p>
            </motion.article>
          ))}
        </div>
        <div className="pioneer-rewards-note">
          <span className="pioneer-rewards-note__mark" aria-hidden="true" />
          <p>
            <T k="pioneer.rewards.note" />
          </p>
        </div>
      </div>
    </section>
  );
}
