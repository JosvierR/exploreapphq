import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "motion/react";
import { AvatarGroup, AvatarGroupTooltip } from "@/components/animate-ui/components/animate/avatar-group";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { T } from "@/components/ui/T";
import { useI18n } from "@/features/i18n/I18nProvider";
import { fetchLeaderboard } from "@/features/pioneers/api/pioneersApi";
import type { LeaderboardTab, PioneerContentEntry, PioneerLeaderboardEntry } from "@/features/pioneers/types";
import type { TranslationKey } from "@/locales/messages";

type PioneerLeaderboardPreviewProps = {
  users: PioneerLeaderboardEntry[];
  topVideos: PioneerContentEntry[];
  topPlaces: PioneerContentEntry[];
  topRoutes: PioneerContentEntry[];
  tabs: readonly LeaderboardTab[];
  source?: "mock" | "api";
};

const TAB_LABELS: Record<LeaderboardTab, TranslationKey> = {
  total: "pioneer.leaderboard.tab.total",
  videos: "pioneer.leaderboard.tab.videos",
  routes: "pioneer.leaderboard.tab.routes",
  places: "pioneer.leaderboard.tab.places",
};

const CONTENT_LABELS: Record<"video" | "place" | "route", TranslationKey> = {
  video: "pioneer.leaderboard.topVideos",
  place: "pioneer.leaderboard.topPlaces",
  route: "pioneer.leaderboard.topRoutes",
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

const medalForRank = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
};

function ContentLeaderboardColumn({
  type,
  items,
}: {
  type: "video" | "place" | "route";
  items: PioneerContentEntry[];
}) {
  return (
    <div className="pioneer-content-board">
      <div className="pioneer-content-board__head">
        <h3>
          <T k={CONTENT_LABELS[type]} />
        </h3>
        <span className="pioneer-content-board__count">{items.length}</span>
      </div>
      <div className="pioneer-content-board__list">
        {items.length === 0 ? (
          <p className="pioneer-empty-state">
            <T k="pioneer.leaderboard.emptyContent" />
          </p>
        ) : (
          items.map((item) => (
            <Link key={item.id} to={item.href} className="pioneer-content-row">
              <span className="pioneer-content-row__rank">{String(item.rank).padStart(2, "0")}</span>
              <div className="pioneer-content-row__thumb">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <span className={`pioneer-content-row__fallback pioneer-content-row__fallback--${type}`}>
                    {type === "video" ? "▶" : type === "place" ? "📍" : "↝"}
                  </span>
                )}
              </div>
              <div className="pioneer-content-row__copy">
                <strong>{item.title}</strong>
                <span>{item.creatorName || item.subtitle || "Explore"}</span>
              </div>
              <strong className="pioneer-content-row__metric">{item.metric}</strong>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export function PioneerLeaderboardPreview({
  users,
  topVideos,
  topPlaces,
  topRoutes,
  tabs,
  source = "mock",
}: PioneerLeaderboardPreviewProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("total");
  const [entries, setEntries] = useState(users);
  const [content, setContent] = useState({ topVideos, topPlaces, topRoutes });
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setEntries(users);
    setContent({ topVideos, topPlaces, topRoutes });
  }, [users, topVideos, topPlaces, topRoutes]);

  useEffect(() => {
    let cancelled = false;

    fetchLeaderboard({ range: "7d", category: activeTab }).then((response) => {
      if (cancelled) return;
      setEntries(response.entries);
      setContent({
        topVideos: response.topVideos,
        topPlaces: response.topPlaces,
        topRoutes: response.topRoutes,
      });
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
          {source === "api" && (
            <p className="pioneer-live-pill">
              <T k="pioneer.leaderboard.live" />
            </p>
          )}
        </div>

        <div className="pioneer-content-boards">
          <ContentLeaderboardColumn type="video" items={content.topVideos} />
          <ContentLeaderboardColumn type="place" items={content.topPlaces} />
          <ContentLeaderboardColumn type="route" items={content.topRoutes} />
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
            {entries.length === 0 ? (
              <p className="pioneer-empty-state">
                <T k="pioneer.leaderboard.emptyUsers" />
              </p>
            ) : (
              entries.slice(0, 10).map((entry) => (
                <article
                  key={entry.id}
                  className={`pioneer-rank-row pioneer-rank-row--${entry.rank <= 3 ? "podium" : "standard"}`}
                >
                  <span className="pioneer-rank-row__rank">
                    {medalForRank(entry.rank) || String(entry.rank).padStart(2, "0")}
                  </span>
                  <div className="pioneer-rank-row__avatar">
                    {entry.avatarUrl ? (
                      <img src={entry.avatarUrl} alt="" loading="lazy" />
                    ) : (
                      <span>{initials(entry.displayName)}</span>
                    )}
                  </div>
                  <div className="pioneer-rank-row__person">
                    <strong>{entry.displayName}</strong>
                    <span>{entry.handle}</span>
                  </div>
                  <div className="pioneer-rank-row__breakdown">
                    <span>
                      <T k="pioneer.leaderboard.metric.videos" />: {entry.videosCount}
                    </span>
                    <span>
                      <T k="pioneer.leaderboard.metric.places" />: {entry.placesCount}
                    </span>
                    <span>
                      <T k="pioneer.leaderboard.metric.routes" />: {entry.routesCount}
                    </span>
                  </div>
                  <strong className="pioneer-rank-row__score">
                    {reduceMotion ? (
                      metricForTab(entry, activeTab)
                    ) : (
                      <SlidingNumber number={metricForTab(entry, activeTab)} inView />
                    )}
                  </strong>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
