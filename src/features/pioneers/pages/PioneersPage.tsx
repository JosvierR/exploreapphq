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
import { usePioneerLanding } from "@/features/pioneers/hooks/usePioneerLanding";
import { usePageMeta } from "@/hooks/usePageMeta";

export function PioneersPage() {
  const { t } = useI18n();
  const { snapshot, loading } = usePioneerLanding();

  usePageMeta({
    title: t("pioneer.meta.title"),
    description: t("pioneer.meta.description"),
    path: "/",
  });

  return (
    <main>
      <PioneersPageShell>
        <PioneerHero stats={snapshot.stats} loading={loading} source={snapshot.source} />
        <PioneerWhatIs />
        <PioneerChallengeCards challenges={snapshot.challenges} source={snapshot.source} />
        <PioneerLeaderboardPreview
          users={snapshot.leaderboardUsers}
          topVideos={snapshot.topVideos}
          topPlaces={snapshot.topPlaces}
          topRoutes={snapshot.topRoutes}
          tabs={snapshot.leaderboardTabs}
          source={snapshot.source}
        />
        <PioneerRewards rewards={snapshot.rewards} />
        <WebMobileSystem />
        <PioneerVideoShowcase
          videoCards={snapshot.videoCards}
          topVideos={snapshot.topVideos}
          topPlaces={snapshot.topPlaces}
          topRoutes={snapshot.topRoutes}
          source={snapshot.source}
        />
        <PioneerFinalCTA />
      </PioneersPageShell>
    </main>
  );
}

export default PioneersPage;
