import { APP_SCREENS } from "@/lib/constants";
import type { TranslationKey } from "@/locales/messages";
import type { ChallengeType } from "./exploreAppLink";

export type ChallengeMissionMeta = {
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  image: string;
};

export const CHALLENGE_MISSION_META: Record<ChallengeType, ChallengeMissionMeta> = {
  places: {
    titleKey: "pioneer.challenge.places.title",
    descriptionKey: "pioneer.challenge.places.desc",
    image: APP_SCREENS.gallery[2],
  },
  routes: {
    titleKey: "pioneer.challenge.routes.title",
    descriptionKey: "pioneer.challenge.routes.desc",
    image: APP_SCREENS.routeMap,
  },
  videos: {
    titleKey: "pioneer.challenge.videos.title",
    descriptionKey: "pioneer.challenge.videos.desc",
    image: APP_SCREENS.videoFeed[0],
  },
};

export const CHALLENGE_WEB_PATHS: Record<ChallengeType, string> = {
  places: "/challenges/places",
  routes: "/challenges/routes",
  videos: "/challenges/videos",
};
