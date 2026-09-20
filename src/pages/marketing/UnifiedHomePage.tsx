import { useState } from "react";
import { UnifiedFinalCTA } from "@/components/sections/UnifiedFinalCTA";
import { UnifiedHero } from "@/components/sections/UnifiedHero";
import { UnifiedHowItWorks } from "@/components/sections/UnifiedHowItWorks";
import { useI18n } from "@/features/i18n/I18nProvider";
import { PioneerChallengeCards } from "@/features/pioneers/components/PioneerChallengeCards";
import { PioneerLeaderboardPreview } from "@/features/pioneers/components/PioneerLeaderboardPreview";
import { PioneerRewards } from "@/features/pioneers/components/PioneerRewards";
import { usePioneerLanding } from "@/features/pioneers/hooks/usePioneerLanding";
import {
  LEADERBOARD_TABS,
  PIONEER_CHALLENGES,
  PIONEER_REWARDS,
} from "@/features/pioneers/mocks/pioneerMock";
import type { LeaderboardTab } from "@/features/pioneers/types";
import { usePageMeta } from "@/hooks/usePageMeta";
import "@/features/pioneers/styles/pioneers.css";
import "@/styles/unified-home.css";

/**
 * One public home: Explore app pitch + live community proof (challenges, ranking, rewards).
 * Single visual language (Explore brand); pioneer data reused without the arcade shell.
 */
export function UnifiedHomePage() {
  const { t } = useI18n();
  const { snapshot, loading, refreshing } = usePioneerLanding();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("total");

  usePageMeta({
    title: t("unified.meta.title"),
    description: t("unified.meta.description"),
    path: "/",
  });

  const challenges = snapshot?.challenges ?? PIONEER_CHALLENGES;
  const rewards = snapshot?.rewards ?? PIONEER_REWARDS;
  const source = snapshot?.source ?? "unavailable";

  return (
    <main className="unified-home">
      <UnifiedHero />
      <UnifiedHowItWorks />
      <div className="unified-home__community">
        <PioneerChallengeCards challenges={challenges} source={source} />
        <PioneerLeaderboardPreview
          users={snapshot?.leaderboardUsers ?? []}
          topVideos={snapshot?.topVideos ?? []}
          topPlaces={snapshot?.topPlaces ?? []}
          topRoutes={snapshot?.topRoutes ?? []}
          tabs={snapshot?.leaderboardTabs ?? LEADERBOARD_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          loading={loading && !snapshot}
          refreshing={refreshing}
          source={source}
        />
        <PioneerRewards rewards={rewards} />
      </div>
      <UnifiedFinalCTA />
    </main>
  );
}

export default UnifiedHomePage;
