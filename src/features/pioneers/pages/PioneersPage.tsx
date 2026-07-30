import { useState } from "react";
import { useI18n } from "@/features/i18n/I18nProvider";
import { PioneerChallengeCards } from "@/features/pioneers/components/PioneerChallengeCards";
import { PioneerFinalCTA } from "@/features/pioneers/components/PioneerFinalCTA";
import { PioneerHero } from "@/features/pioneers/components/PioneerHero";
import { PioneerLeaderboardPreview } from "@/features/pioneers/components/PioneerLeaderboardPreview";
import { PioneerRewards } from "@/features/pioneers/components/PioneerRewards";
import { PioneersPageShell } from "@/features/pioneers/components/PioneersPageShell";
import { PioneerVideoShowcase } from "@/features/pioneers/components/PioneerVideoShowcase";
import { PioneerWhatIs } from "@/features/pioneers/components/PioneerWhatIs";
import { WebMobileSystem } from "@/features/pioneers/components/WebMobileSystem";
import { EMPTY_PIONEER_STATS } from "@/features/pioneers/api/pioneersApi";
import { usePioneerLanding } from "@/features/pioneers/hooks/usePioneerLanding";
import { LEADERBOARD_TABS, PIONEER_CHALLENGES, PIONEER_REWARDS, PIONEER_VIDEO_CARDS } from "@/features/pioneers/mocks/pioneerMock";
import type { LeaderboardTab } from "@/features/pioneers/types";
import { usePageMeta } from "@/hooks/usePageMeta";

export function PioneersPage() {
  const { t } = useI18n();
  const { snapshot, loading, refreshing } = usePioneerLanding();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("total");

  usePageMeta({
    title: t("pioneer.meta.title"),
    description: t("pioneer.meta.description"),
    path: "/",
  });

  const challenges = snapshot?.challenges ?? PIONEER_CHALLENGES;
  const rewards = snapshot?.rewards ?? PIONEER_REWARDS;
  const stats = snapshot?.stats ?? EMPTY_PIONEER_STATS;
  const videoCards = snapshot?.videoCards ?? PIONEER_VIDEO_CARDS;
  const source = snapshot?.source ?? "unavailable";

  return (
    <main>
      <PioneersPageShell>
        <PioneerHero stats={stats} loading={loading && !snapshot} source={source} />
        <PioneerWhatIs />
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
        <WebMobileSystem />
        <PioneerVideoShowcase
          videoCards={videoCards}
          topVideos={snapshot?.topVideos ?? []}
          topPlaces={snapshot?.topPlaces ?? []}
          topRoutes={snapshot?.topRoutes ?? []}
          source={source}
        />
        <PioneerFinalCTA />
      </PioneersPageShell>
    </main>
  );
}

export default PioneersPage;
