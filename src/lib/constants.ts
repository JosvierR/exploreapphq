const defaultSiteUrl = "https://exploreapphq.vercel.app";

export const SITE = {
  name: "Explore",
  legalName: "Explore Atlas LLC",
  url: (import.meta.env.VITE_SITE_URL || defaultSiteUrl).replace(/\/$/, ""),
  email: "josvierrod@exploreapphq.com",
  address: "4200 Hillcrest Dr, Apt 815, Hollywood, FL 33021, USA",
  duns: "119546449",
} as const;

export const STORE_URLS = {
  play: "https://play.google.com/store/apps/details?id=com.explore.miapp&hl=es",
  apple: "https://apps.apple.com/do/app/explore-tourism/id6748882805?l=en-GB",
} as const;

export const SOCIAL = {
  instagram: "https://www.instagram.com/explore.app.latam",
  tiktok: "https://www.tiktok.com/@explore.app",
} as const;

/** Real app screenshots for marketing */
export const APP_SCREENS = {
  hero: "/ExplorePromo1.png",
  heroMap: "/P4.png",
  heroStack: {
    left: "/P2.png",
    right: "/P5.png",
  },
  videoFeed: ["/P2.png", "/ExplorePromo1.png", "/P6.png"] as const,
  routeMap: "/P4.png",
  gallery: ["/P2.png", "/P3.png", "/P4.png", "/P5.png", "/P6.png", "/P7.png", "/P1.png"] as const,
  rewards: {
    badge: "/1.png",
    profile: "/2.png",
    repost: "/3.png",
    ranking: "/6.png",
    early: "/4.png",
    creator: "/5.png",
  },
  videoShowcase: ["/V1.png", "/V2.png", "/V3.png", "/V4.png", "/V5.png"] as const,
} as const;
