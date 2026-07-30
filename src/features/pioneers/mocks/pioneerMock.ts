import { CHALLENGE_WEB_PATHS } from "@/features/pioneers/lib/challengeConfig";
import type {
  LeaderboardTab,
  PioneerChallenge,
  PioneerReward,
  PioneerVideoCard,
} from "@/features/pioneers/types";
import { APP_SCREENS, PIXEL_ICONS } from "@/lib/constants";

/**
 * Static campaign content only. Live progress and every ranking row come from
 * /api/pioneers/landing; fallback progress is intentionally zero.
 */
export const PIONEER_CHALLENGES: PioneerChallenge[] = [
  {
    id: "places",
    titleKey: "pioneer.challenge.places.title",
    descriptionKey: "pioneer.challenge.places.desc",
    microcopyKey: "pioneer.challenge.places.microcopy",
    badgeLabelKey: "pioneer.challenge.places.badge",
    iconLabel: "PIN",
    points: 150,
    badgeId: "badge-places",
    progressCurrent: 0,
    progressTarget: 5,
    appDeepLink: CHALLENGE_WEB_PATHS.places,
    communityCount: 0,
  },
  {
    id: "routes",
    titleKey: "pioneer.challenge.routes.title",
    descriptionKey: "pioneer.challenge.routes.desc",
    microcopyKey: "pioneer.challenge.routes.microcopy",
    badgeLabelKey: "pioneer.challenge.routes.badge",
    iconLabel: "RTE",
    points: 200,
    badgeId: "badge-routes",
    progressCurrent: 0,
    progressTarget: 3,
    appDeepLink: CHALLENGE_WEB_PATHS.routes,
    communityCount: 0,
  },
  {
    id: "videos",
    titleKey: "pioneer.challenge.videos.title",
    descriptionKey: "pioneer.challenge.videos.desc",
    microcopyKey: "pioneer.challenge.videos.microcopy",
    badgeLabelKey: "pioneer.challenge.videos.badge",
    iconLabel: "VID",
    points: 250,
    badgeId: "badge-videos",
    progressCurrent: 0,
    progressTarget: 6,
    appDeepLink: CHALLENGE_WEB_PATHS.videos,
    communityCount: 0,
  },
];

export const PIONEER_REWARDS: PioneerReward[] = [
  // Beneficios destacados
  {
    id: "founding-badge",
    titleKey: "pioneer.reward.badge.title",
    descriptionKey: "pioneer.reward.badge.desc",
    icon: PIXEL_ICONS.badge,
    featured: true,
  },
  {
    id: "priority-visibility",
    titleKey: "pioneer.reward.profile.title",
    descriptionKey: "pioneer.reward.profile.desc",
    icon: PIXEL_ICONS.star,
    featured: true,
  },
  {
    id: "early-access",
    titleKey: "pioneer.reward.early.title",
    descriptionKey: "pioneer.reward.early.desc",
    icon: PIXEL_ICONS.bolt,
    featured: true,
  },
  // Beneficios adicionales
  {
    id: "leaderboard-status",
    titleKey: "pioneer.reward.ranking.title",
    descriptionKey: "pioneer.reward.ranking.desc",
    icon: PIXEL_ICONS.trophy,
  },
  {
    id: "impact-metrics",
    titleKey: "pioneer.reward.metrics.title",
    descriptionKey: "pioneer.reward.metrics.desc",
    icon: PIXEL_ICONS.chart,
  },
  {
    id: "partner-perks",
    titleKey: "pioneer.reward.partners.title",
    descriptionKey: "pioneer.reward.partners.desc",
    icon: PIXEL_ICONS.chest,
    tagKey: "pioneer.reward.partners.tag",
  },
  {
    id: "brand-collabs",
    titleKey: "pioneer.reward.collabs.title",
    descriptionKey: "pioneer.reward.collabs.desc",
    icon: PIXEL_ICONS.ticket,
  },
];

export const PIONEER_VIDEO_CARDS: PioneerVideoCard[] = [
  {
    id: "feed-beach",
    image: APP_SCREENS.videoShowcase[0],
    titleKey: "pioneer.video.card1.title",
    creator: "Paola M.",
    typeKey: "pioneer.video.type.video",
  },
  {
    id: "promo-city",
    image: APP_SCREENS.videoShowcase[1],
    titleKey: "pioneer.video.card2.title",
    creator: "David R.",
    typeKey: "pioneer.video.type.place",
  },
  {
    id: "route-map",
    image: APP_SCREENS.videoShowcase[2],
    titleKey: "pioneer.video.card3.title",
    creator: "Nina L.",
    typeKey: "pioneer.video.type.route",
  },
  {
    id: "gallery-food",
    image: APP_SCREENS.videoShowcase[3],
    titleKey: "pioneer.video.card4.title",
    creator: "Marco A.",
    typeKey: "pioneer.video.type.place",
  },
  {
    id: "gallery-view",
    image: APP_SCREENS.videoShowcase[4],
    titleKey: "pioneer.video.card5.title",
    creator: "Elena V.",
    typeKey: "pioneer.video.type.video",
  },
  {
    id: "gallery-create",
    image: APP_SCREENS.heroStack.left,
    titleKey: "pioneer.video.card6.title",
    creator: "Jorge C.",
    typeKey: "pioneer.video.type.route",
  },
];

export const LEADERBOARD_TABS = [
  "total",
  "videos",
  "routes",
  "places",
] as const satisfies readonly LeaderboardTab[];
