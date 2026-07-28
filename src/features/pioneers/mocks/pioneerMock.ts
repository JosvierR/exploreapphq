import { CHALLENGE_WEB_PATHS } from "@/features/pioneers/lib/challengeConfig";
import type {
  LeaderboardTab,
  PioneerChallenge,
  PioneerReward,
  PioneerVideoCard,
} from "@/features/pioneers/types";
import { APP_SCREENS } from "@/lib/constants";

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
  {
    id: "badge",
    titleKey: "pioneer.reward.badge.title",
    descriptionKey: "pioneer.reward.badge.desc",
    image: APP_SCREENS.rewards.badge,
  },
  {
    id: "profile",
    titleKey: "pioneer.reward.profile.title",
    descriptionKey: "pioneer.reward.profile.desc",
    image: APP_SCREENS.rewards.profile,
  },
  {
    id: "repost",
    titleKey: "pioneer.reward.repost.title",
    descriptionKey: "pioneer.reward.repost.desc",
    image: APP_SCREENS.rewards.repost,
  },
  {
    id: "ranking",
    titleKey: "pioneer.reward.ranking.title",
    descriptionKey: "pioneer.reward.ranking.desc",
    image: APP_SCREENS.rewards.ranking,
  },
  {
    id: "early",
    titleKey: "pioneer.reward.early.title",
    descriptionKey: "pioneer.reward.early.desc",
    image: APP_SCREENS.rewards.early,
  },
  {
    id: "creator",
    titleKey: "pioneer.reward.creator.title",
    descriptionKey: "pioneer.reward.creator.desc",
    image: APP_SCREENS.rewards.creator,
    featured: true,
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
