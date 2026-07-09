import { useMemo } from "react";
import { useI18n } from "@/features/i18n/I18nProvider";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getPioneerLandingSnapshot } from "@/features/pioneers/api/pioneersApi";
import { PioneerChallengeCards } from "@/features/pioneers/components/PioneerChallengeCards";
import { PioneerFinalCTA } from "@/features/pioneers/components/PioneerFinalCTA";
import { PioneerHero } from "@/features/pioneers/components/PioneerHero";
import { PioneerLeaderboardPreview } from "@/features/pioneers/components/PioneerLeaderboardPreview";
import { PioneerRewards } from "@/features/pioneers/components/PioneerRewards";
import { PioneersPageShell } from "@/features/pioneers/components/PioneersPageShell";
import { PioneerVideoShowcase } from "@/features/pioneers/components/PioneerVideoShowcase";
import { PioneerWhatIs } from "@/features/pioneers/components/PioneerWhatIs";
import { WebMobileSystem } from "@/features/pioneers/components/WebMobileSystem";

export function PioneersPage() {
  const { t } = useI18n();
  const snapshot = useMemo(() => getPioneerLandingSnapshot(), []);

  usePageMeta({
    title: t("pioneer.meta.title"),
    description: t("pioneer.meta.description"),
    path: "/pioneros",
  });

  return (
    <main>
      <PioneersPageShell>
        <PioneerHero stats={snapshot.stats} />
        <PioneerWhatIs />
        <PioneerChallengeCards challenges={snapshot.challenges} />
        <PioneerLeaderboardPreview users={snapshot.leaderboardUsers} tabs={snapshot.leaderboardTabs} />
        <PioneerRewards rewards={snapshot.rewards} />
        <WebMobileSystem />
        <PioneerVideoShowcase videoCards={snapshot.videoCards} />
        <PioneerFinalCTA />
      </PioneersPageShell>
    </main>
  );
}

export default PioneersPage;
