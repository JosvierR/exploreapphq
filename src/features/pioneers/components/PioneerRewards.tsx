import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import type { PioneerReward } from "@/features/pioneers/types";

type PioneerRewardsProps = {
  rewards: PioneerReward[];
};

export function PioneerRewards({ rewards }: PioneerRewardsProps) {
  const reduceMotion = useReducedMotion();
  const featured = rewards.filter((reward) => reward.featured);
  const secondary = rewards.filter((reward) => !reward.featured);

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

          {/* Beneficios destacados: insignia, visibilidad, acceso anticipado */}
          <div className="pioneer-rewards-featured">
            {featured.map((reward, index) => (
                <motion.article
                    key={reward.id}
                    className="pioneer-reward-card pixel-reward-card pioneer-reward-card--featured pixel-reward-card--featured"
                    initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ delay: index * 0.05, duration: 0.42 }}
                >
                  <span className="pioneer-reward-card__rank" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="pioneer-reward-card__icon-wrap" aria-hidden="true">
                    <img src={reward.icon} alt="" loading="lazy" className="pioneer-reward-card__icon-img" />
                    {reward.id === "founding-badge" && (
                        <div
                            className="pixel-sprite pixel-sprite--sparkle pioneer-reward-card__sprite"
                            role="img"
                            aria-label="Efecto de logro desbloqueado"
                        />
                    )}
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
            ))}
          </div>

          {/* Beneficios adicionales: agrupados en tarjetas compactas */}
          <div className="pioneer-rewards-secondary">
            {secondary.map((reward, index) => (
                <motion.article
                    key={reward.id}
                    className="pioneer-reward-compact pixel-reward-compact"
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ delay: 0.15 + index * 0.05, duration: 0.4 }}
                >
                  <span className="pioneer-reward-compact__icon" aria-hidden="true">
                    <img src={reward.icon} alt="" loading="lazy" />
                  </span>
                  <div className="pioneer-reward-compact__body">
                    <h3>
                      <T k={reward.titleKey} />
                    </h3>
                    <p>
                      <T k={reward.descriptionKey} />
                    </p>
                    {reward.tagKey && (
                        <span className="pioneer-reward-compact__tag">
                          <T k={reward.tagKey} />
                        </span>
                    )}
                  </div>
                </motion.article>
            ))}
          </div>

          <div className="pioneer-rewards-note pixel-rewards-note">
            <span className="pixel-note-icon" aria-hidden="true">★</span>
            <p className="pixel-note-text">
              <T k="pioneer.rewards.note" />
            </p>
          </div>
        </div>
      </section>
  );
}
