import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { AvatarGroup, AvatarGroupTooltip } from "@/components/animate-ui/components/animate/avatar-group";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { T } from "@/components/ui/T";
import { useI18n } from "@/features/i18n/I18nProvider";
import { fetchLeaderboard } from "@/features/pioneers/api/pioneersApi";
import type { LeaderboardTab, PioneerLeaderboardEntry } from "@/features/pioneers/types";
import type { TranslationKey } from "@/locales/messages";

type PioneerLeaderboardPreviewProps = {
  users: PioneerLeaderboardEntry[];
  tabs: readonly LeaderboardTab[];
};

const TAB_LABELS: Record<LeaderboardTab, TranslationKey> = {
  total: "pioneer.leaderboard.tab.total",
  videos: "pioneer.leaderboard.tab.videos",
  routes: "pioneer.leaderboard.tab.routes",
  places: "pioneer.leaderboard.tab.places",
};

const metricForTab = (entry: PioneerLeaderboardEntry, tab: LeaderboardTab) => {
  if (tab === "videos") return entry.videosCount;
  if (tab === "routes") return entry.routesCount;
  if (tab === "places") return entry.placesCount;
  return entry.totalPoints;
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .replace(".", "")
    .slice(0, 2)
    .toUpperCase();

export function PioneerLeaderboardPreview({ users, tabs }: PioneerLeaderboardPreviewProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("total");
  const [entries, setEntries] = useState(users);
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;

    fetchLeaderboard({ range: "7d", category: activeTab }).then((response) => {
      if (!cancelled) setEntries(response.entries);
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const topFive = useMemo(() => entries.slice(0, 5), [entries]);

  return (
    <section className="pioneer-section pioneer-section--ranking" id="ranking" aria-labelledby="pioneer-ranking-title">
      <div className="container pioneer-ranking">
        <div className="pioneer-section-heading">
          <p className="pioneer-eyebrow">
            <T k="pioneer.leaderboard.eyebrow" />
          </p>
          <h2 id="pioneer-ranking-title" className="pioneer-section-title">
            <T k="pioneer.leaderboard.title" />
          </h2>
          <p className="pioneer-section-lead">
            <T k="pioneer.leaderboard.lead" />
          </p>
        </div>

        <div className="pioneer-ranking__panel">
          <div className="pioneer-ranking__summary">
            <div>
              <span className="pioneer-ranking__label">
                <T k="pioneer.leaderboard.topFive" />
              </span>
              <AvatarGroup className="pioneer-avatar-group">
                {topFive.map((user) => (
                  <div className="pioneer-avatar" key={user.id}>
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" loading="lazy" /> : <span>{initials(user.displayName)}</span>}
                    <AvatarGroupTooltip>{user.displayName}</AvatarGroupTooltip>
                  </div>
                ))}
              </AvatarGroup>
            </div>
            <div className="pioneer-ranking__tabs" role="tablist" aria-label={t("pioneer.leaderboard.aria")}>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? "is-active" : ""}
                  onClick={() => setActiveTab(tab)}
                  role="tab"
                  aria-selected={activeTab === tab}
                >
                  <T k={TAB_LABELS[tab]} />
                </button>
              ))}
            </div>
          </div>

          <div className="pioneer-ranking__list">
            {entries.slice(0, 6).map((entry) => (
              <article key={entry.id} className={`pioneer-rank-row pioneer-rank-row--${entry.rank <= 3 ? "podium" : "standard"}`}>
                <span className="pioneer-rank-row__rank">{String(entry.rank).padStart(2, "0")}</span>
                <div className="pioneer-rank-row__person">
                  <strong>{entry.displayName}</strong>
                  <span>{entry.handle}</span>
                </div>
                <div className="pioneer-rank-row__badges">
                  {entry.badges.slice(0, 3).map((badge) => (
                    <span key={badge}>{badge.replace("badge-", "")}</span>
                  ))}
                </div>
                <strong className="pioneer-rank-row__score">
                  {reduceMotion ? metricForTab(entry, activeTab) : <SlidingNumber number={metricForTab(entry, activeTab)} inView />}
                </strong>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
