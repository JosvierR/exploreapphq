export type FeedbackStatus =
  | "listening"
  | "considering"
  | "planned"
  | "building"
  | "shipped"
  | "not_now";

export type FeedbackCategory =
  | "discover"
  | "places"
  | "routes"
  | "community"
  | "ai"
  | "profile"
  | "events"
  | "other";

export type LabTab = "trending" | "newest";

export type FeedbackIdea = {
  id: string;
  slug: string;
  userId: string;
  authorName: string;
  email: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  boostCount: number;
  commentCount: number;
  teamResponse: string | null;
  isVisible: boolean;
  /** Accepted by Explore — appears on Building board. */
  isFeatured: boolean;
  isTeamCreated: boolean;
  duplicateOf: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackComment = {
  id: string;
  ideaId: string;
  userId: string;
  authorName: string;
  body: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackUpdate = {
  id: string;
  ideaId: string;
  status: FeedbackStatus | null;
  body: string;
  createdAt: string;
};

export type FeedbackBuildMessage = {
  id: string;
  ideaId: string;
  userId: string;
  authorName: string;
  body: string;
  isTeam: boolean;
  createdAt: string;
};

export type LabSession = {
  userId: string;
  displayName: string;
  email?: string;
};

export type LabSnapshot = {
  ideas: FeedbackIdea[];
  comments: FeedbackComment[];
  updates: FeedbackUpdate[];
  buildMessages: FeedbackBuildMessage[];
  boostsByUser: Record<string, string[]>;
  session: LabSession | null;
};
