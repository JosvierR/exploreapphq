import type {
  FeedbackBuildMessage,
  FeedbackComment,
  FeedbackIdea,
  FeedbackUpdate,
} from "./types";

/** Start empty — real feedback arrives via submit → admin. */
export const SEED_IDEAS: FeedbackIdea[] = [];
export const SEED_COMMENTS: FeedbackComment[] = [];
export const SEED_UPDATES: FeedbackUpdate[] = [];
export const SEED_BUILD_MESSAGES: FeedbackBuildMessage[] = [];
