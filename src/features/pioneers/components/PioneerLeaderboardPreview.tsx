import { useMemo } from "react";
import { Link } from "react-router-dom";
import { T } from "@/components/ui/T";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { LeaderboardTab, PioneerContentEntry, PioneerLeaderboardEntry } from "@/features/pioneers/types";
import type { TranslationKey } from "@/locales/messages";

type PioneerLeaderboardPreviewProps = {
  users: PioneerLeaderboardEntry[];
  topVideos: PioneerContentEntry[];
  topPlaces: PioneerContentEntry[];
  topRoutes: PioneerContentEntry[];
  tabs: readonly LeaderboardTab[];
  activeTab: LeaderboardTab;
  onTabChange: (tab: LeaderboardTab) => void;
  loading?: boolean;
  refreshing?: boolean;
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

const sortUsersForTab = (users: PioneerLeaderboardEntry[], tab: LeaderboardTab) =>
  [...users]
    .sort((a, b) => metricForTab(b, tab) - metricForTab(a, tab) || a.rank - b.rank)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

const initials = (name: string) =>
  (name || "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .replace(".", "")
    .slice(0, 2)
    .toUpperCase() || "?";

const CONTENT_ICONS: Record<"video" | "place" | "route", string> = {
  video: "▶",
  place: "📍",
  route: "↝",
};

const METRIC_LABELS: Record<"video" | "place" | "route", TranslationKey> = {
  video: "pioneer.leaderboard.metricLabel.likes",
  place: "pioneer.leaderboard.metricLabel.rating",
  route: "pioneer.leaderboard.metricLabel.stops",
};

function ContentLeaderboardColumn({
  type,
  items,
  loading = false,
}: {
  type: "video" | "place" | "route";
  items: PioneerContentEntry[];
  loading?: boolean;
}) {
  return (
    <div className={`pioneer-content-board pioneer-content-board--${type}`}>
      <div className="pioneer-content-board__head">
        <div className="pioneer-content-board__title">
          <span className="pioneer-content-board__icon" aria-hidden="true">
            {CONTENT_ICONS[type]}
          </span>
          <h3>
            <T k={CONTENT_LABELS[type]} />
          </h3>
        </div>
        <span className="pioneer-content-board__count">{loading ? "…" : items.length}</span>
      </div>
      <div className="pioneer-content-board__list">
        {loading && items.length === 0 ? (
          <p className="pioneer-empty-state">
            <T k="pioneer.leaderboard.loading" />
          </p>
        ) : items.length === 0 ? (
          <p className="pioneer-empty-state">
            <T k="pioneer.leaderboard.emptyContent" />
          </p>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className={`pioneer-content-row${item.rank === 1 ? " pioneer-content-row--leader" : ""}`}
            >
              <span className={`pioneer-content-row__rank${item.rank <= 3 ? ` pioneer-content-row__rank--${item.rank}` : ""}`}>
                {String(item.rank).padStart(2, "0")}
              </span>
              <div className={`pioneer-content-row__thumb pioneer-content-row__thumb--${type}`}>
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <span className={`pioneer-content-row__fallback pioneer-content-row__fallback--${type}`}>
                    {CONTENT_ICONS[type]}
                  </span>
                )}
              </div>
              <div className="pioneer-content-row__copy">
                <strong>{item.title}</strong>
                <span>{item.creatorName || item.subtitle || "Explore"}</span>
              </div>
              <div className="pioneer-content-row__metric">
                <strong>{item.metric}</strong>
                <small>
                  <T k={METRIC_LABELS[type]} />
                </small>
              </div>
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
  activeTab,
  onTabChange,
  loading = false,
  refreshing = false,
  source = "mock",
}: PioneerLeaderboardPreviewProps) {
  const { t } = useI18n();

  const entries = useMemo(() => sortUsersForTab(users, activeTab), [users, activeTab]);
  const topFive = useMemo(() => entries.slice(0, 5), [entries]);
  const showLoadingCopy = loading && users.length === 0;

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
              {refreshing ? (
                <>
                  {" · "}
                  <T k="pioneer.leaderboard.refreshing" />
                </>
              ) : null}
            </p>
          )}
        </div>

        <div className={`pioneer-leaderboard-frame${refreshing ? " is-refreshing" : ""}`}>
          <div className="pioneer-content-boards">
            <ContentLeaderboardColumn type="video" items={topVideos} loading={showLoadingCopy} />
            <ContentLeaderboardColumn type="place" items={topPlaces} loading={showLoadingCopy} />
            <ContentLeaderboardColumn type="route" items={topRoutes} loading={showLoadingCopy} />
          </div>

          <div className="pioneer-ranking__panel">
            <div className="pioneer-ranking__summary">
              <div>
                <span className="pioneer-ranking__label">
                  <T k="pioneer.leaderboard.topFive" />
                </span>
                <div className="pioneer-avatar-group" role="list">
                  {topFive.map((user) => (
                    <div className="pioneer-avatar" key={user.id} title={user.displayName} role="listitem">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" loading="lazy" />
                      ) : (
                        <span>{initials(user.displayName)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="pioneer-ranking__tabs" role="tablist" aria-label={t("pioneer.leaderboard.aria")}>
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={activeTab === tab ? "is-active" : ""}
                    onClick={() => onTabChange(tab)}
                    role="tab"
                    aria-selected={activeTab === tab}
                  >
                    <T k={TAB_LABELS[tab]} />
                  </button>
                ))}
              </div>
            </div>

            <div className="pioneer-ranking__table-wrap">
              <table className="pioneer-ranking-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <T k="pioneer.leaderboard.col.rank" />
                    </th>
                    <th scope="col">
                      <T k="pioneer.leaderboard.col.pioneer" />
                    </th>
                    <th scope="col" className="pioneer-ranking-table__contrib-col">
                      <T k="pioneer.leaderboard.col.contributions" />
                    </th>
                    <th scope="col" className="pioneer-ranking-table__score-col">
                      <T k="pioneer.leaderboard.col.score" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {showLoadingCopy ? (
                    <tr>
                      <td colSpan={4}>
                        <p className="pioneer-empty-state">
                          <T k="pioneer.leaderboard.loading" />
                        </p>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <p className="pioneer-empty-state">
                          <T k="pioneer.leaderboard.emptyUsers" />
                        </p>
                      </td>
                    </tr>
                  ) : (
                    entries.slice(0, 10).map((entry) => (
                      <tr
                        key={`${activeTab}-${entry.id}`}
                        className={`pioneer-ranking-table__row pioneer-ranking-table__row--${entry.rank <= 3 ? "podium" : "standard"} pioneer-ranking-table__row--place-${entry.rank}`}
                      >
                        <td>
                          <span className={`pioneer-rank-medal pioneer-rank-medal--${entry.rank <= 3 ? entry.rank : "default"}`}>
                            {String(entry.rank).padStart(2, "0")}
                          </span>
                        </td>
                        <td>
                          <div className="pioneer-rank-row__identity">
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
                          </div>
                        </td>
                        <td className="pioneer-ranking-table__contrib-col">
                          <div className="pioneer-rank-row__breakdown">
                            <span className="pioneer-rank-chip pioneer-rank-chip--video">
                              <T k="pioneer.leaderboard.metric.videos" /> {entry.videosCount}
                            </span>
                            <span className="pioneer-rank-chip pioneer-rank-chip--place">
                              <T k="pioneer.leaderboard.metric.places" /> {entry.placesCount}
                            </span>
                            <span className="pioneer-rank-chip pioneer-rank-chip--route">
                              <T k="pioneer.leaderboard.metric.routes" /> {entry.routesCount}
                            </span>
                          </div>
                        </td>
                        <td className="pioneer-ranking-table__score-col">
                          <div className="pioneer-rank-row__score">
                            <strong>{metricForTab(entry, activeTab)}</strong>
                            <small>
                              <T k="pioneer.leaderboard.pointsShort" />
                            </small>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
