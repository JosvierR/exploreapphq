import { T } from "@/components/ui/T";
import type { PioneerReward } from "@/features/pioneers/types";

type PioneerRewardsProps = {
  rewards: PioneerReward[];
};

export function PioneerRewards({ rewards }: PioneerRewardsProps) {
  return (
    <section className="pioneer-section" id="recompensas" aria-labelledby="pioneer-rewards-title">
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
            <article key={reward.id} className="pioneer-reward-card">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>
                <T k={reward.titleKey} />
              </h3>
              <p>
                <T k={reward.descriptionKey} />
              </p>
            </article>
          ))}
        </div>
        <p className="pioneer-rewards-note">
          <T k="pioneer.rewards.note" />
        </p>
      </div>
    </section>
  );
}
