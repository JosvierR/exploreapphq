import { slugify } from "./lib/status";
import type {
  FeedbackBuildMessage,
  FeedbackCategory,
  FeedbackComment,
  FeedbackIdea,
  FeedbackStatus,
  FeedbackUpdate,
  LabSession,
  LabSnapshot,
  LabTab,
} from "./types";

const STORAGE_KEY = "explore-lab-v4";

type LabState = {
  ideas: FeedbackIdea[];
  comments: FeedbackComment[];
  updates: FeedbackUpdate[];
  buildMessages: FeedbackBuildMessage[];
  boostsByUser: Record<string, string[]>;
  session: LabSession | null;
};

function normalizeIdea(idea: FeedbackIdea): FeedbackIdea {
  return {
    ...idea,
    email: idea.email ?? "",
    isFeatured: Boolean(idea.isFeatured),
    isVisible: idea.isVisible !== false,
  };
}

function defaultState(): LabState {
  return {
    ideas: [],
    comments: [],
    updates: [],
    buildMessages: [],
    boostsByUser: {},
    session: null,
  };
}

function loadState(): LabState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<LabState>;
    return {
      ...defaultState(),
      ...parsed,
      ideas: Array.isArray(parsed.ideas)
        ? parsed.ideas.map((i) => normalizeIdea(i as FeedbackIdea))
        : [],
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      updates: Array.isArray(parsed.updates) ? parsed.updates : [],
      buildMessages: Array.isArray(parsed.buildMessages) ? parsed.buildMessages : [],
      boostsByUser: parsed.boostsByUser ?? {},
      session: parsed.session ?? null,
    };
  } catch {
    return defaultState();
  }
}

let state = loadState();
const listeners = new Set<() => void>();

function buildSnapshot(): LabSnapshot {
  return {
    ideas: state.ideas,
    comments: state.comments,
    updates: state.updates,
    buildMessages: state.buildMessages,
    boostsByUser: state.boostsByUser,
    session: state.session,
  };
}

/** Cached for useSyncExternalStore — must be referentially stable between emits. */
let snapshot: LabSnapshot = buildSnapshot();

function persist() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit() {
  snapshot = buildSnapshot();
  persist();
  listeners.forEach((l) => l());
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function trendingScore(idea: FeedbackIdea) {
  const ageHours = Math.max(1, (Date.now() - new Date(idea.updatedAt).getTime()) / 3_600_000);
  const recency = 1 / Math.pow(ageHours / 24 + 1, 1.2);
  return idea.boostCount * 2 + idea.commentCount + recency * 40;
}

function isForumIdea(idea: FeedbackIdea) {
  return idea.isVisible && !idea.duplicateOf;
}

/** Accepted by Explore — shown on the Building board. */
function isAcceptedIdea(idea: FeedbackIdea) {
  return idea.isVisible && idea.isFeatured && !idea.duplicateOf;
}

export function getLabSnapshot(): LabSnapshot {
  return snapshot;
}

export function subscribeLab(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ensureLabSession(displayName = "You"): LabSession {
  if (state.session) return state.session;
  state.session = {
    userId: "demo-user",
    displayName,
  };
  emit();
  return state.session;
}

/** Community forum: all visible ideas. */
export function listIdeas(opts: {
  tab?: LabTab;
  category?: FeedbackCategory | "all";
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  const tab = opts.tab ?? "trending";
  const category = opts.category ?? "all";
  const query = (opts.query ?? "").trim().toLowerCase();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;

  let ideas = state.ideas.filter(isForumIdea);

  if (category !== "all") {
    ideas = ideas.filter((i) => i.category === category);
  }

  if (query) {
    ideas = ideas.filter(
      (i) => i.title.toLowerCase().includes(query) || i.description.toLowerCase().includes(query),
    );
  }

  if (tab === "newest") {
    ideas = [...ideas].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  } else {
    ideas = [...ideas].sort((a, b) => trendingScore(b) - trendingScore(a));
  }

  const total = ideas.length;
  const start = (page - 1) * pageSize;
  const items = ideas.slice(start, start + pageSize);
  return { items, total, page, pageSize, hasMore: start + pageSize < total };
}

export function getIdeaBySlugOrId(slugOrId: string) {
  return state.ideas.find((i) => i.slug === slugOrId || i.id === slugOrId) ?? null;
}

export function userBoosted(ideaId: string, userId?: string | null) {
  if (!userId) return false;
  return (state.boostsByUser[userId] ?? []).includes(ideaId);
}

export function findSimilarIdeas(title: string, limit = 4) {
  const q = title.trim().toLowerCase();
  if (q.length < 3) return [] as FeedbackIdea[];
  const tokens = q.split(/\s+/).filter(Boolean);
  return state.ideas
    .filter((i) => isForumIdea(i))
    .map((idea) => {
      const hay = `${idea.title} ${idea.description}`.toLowerCase();
      const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { idea, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.idea.boostCount - a.idea.boostCount)
    .slice(0, limit)
    .map((x) => x.idea);
}

export function canViewIdea(idea: FeedbackIdea, userId?: string | null) {
  if (idea.isVisible) return true;
  return idea.userId === userId;
}

export function toggleBoost(ideaId: string): { ok: true; boosted: boolean; boostCount: number } | { ok: false; error: string } {
  const session = ensureLabSession();
  const idea = state.ideas.find((i) => i.id === ideaId);
  if (!idea || !idea.isVisible) return { ok: false, error: "Idea not found." };
  if (idea.duplicateOf) return { ok: false, error: "Boost the main idea instead." };

  const list = new Set(state.boostsByUser[session.userId] ?? []);
  let boosted: boolean;
  if (list.has(ideaId)) {
    list.delete(ideaId);
    idea.boostCount = Math.max(0, idea.boostCount - 1);
    boosted = false;
  } else {
    list.add(ideaId);
    idea.boostCount += 1;
    boosted = true;
  }
  state.boostsByUser[session.userId] = [...list];
  idea.updatedAt = new Date().toISOString();
  emit();
  return { ok: true, boosted, boostCount: idea.boostCount };
}

export function createIdea(input: {
  title: string;
  description: string;
  category: FeedbackCategory;
  email: string;
}): { ok: true; idea: FeedbackIdea } | { ok: false; error: string } {
  const title = input.title.trim();
  const description = input.description.trim();
  const email = input.email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailOk) {
    return { ok: false, error: "Enter a valid email so we can follow up." };
  }
  if (title.length < 4 || title.length > 80) {
    return { ok: false, error: "Title must be between 4 and 80 characters." };
  }
  if (description.length < 3) {
    return { ok: false, error: "Tell us a little more about your idea." };
  }
  if (description.length > 500) {
    return { ok: false, error: "Description must be 500 characters or less." };
  }

  const session = ensureLabSession(email.split("@")[0] || "You");
  state.session = { ...session, email };

  const dayAgo = Date.now() - 86_400_000;
  const recent = state.ideas.filter(
    (i) => i.email === email && +new Date(i.createdAt) > dayAgo,
  );
  if (recent.length >= 3) {
    return { ok: false, error: "You can share up to 3 ideas per day. Try again tomorrow." };
  }

  const baseSlug = slugify(title) || "idea";
  let slug = baseSlug;
  let n = 2;
  while (state.ideas.some((i) => i.slug === slug)) {
    slug = `${baseSlug}-${n++}`;
  }

  const idea: FeedbackIdea = {
    id: uid("idea"),
    slug,
    userId: session.userId,
    authorName: session.displayName,
    email,
    title,
    description,
    category: input.category,
    status: "listening",
    boostCount: 0,
    commentCount: 0,
    teamResponse: null,
    isVisible: true,
    isFeatured: false,
    isTeamCreated: false,
    duplicateOf: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.ideas.unshift(idea);
  emit();
  return { ok: true, idea };
}

export function addComment(
  ideaId: string,
  body: string,
): { ok: true; comment: FeedbackComment } | { ok: false; error: string } {
  const text = body.trim();
  if (text.length < 2 || text.length > 1000) {
    return { ok: false, error: "Comment must be between 2 and 1000 characters." };
  }
  const idea = state.ideas.find((i) => i.id === ideaId);
  if (!idea || !idea.isVisible) return { ok: false, error: "Idea not found." };

  const session = ensureLabSession();
  const comment: FeedbackComment = {
    id: uid("c"),
    ideaId,
    userId: session.userId,
    authorName: session.displayName,
    body: text,
    isVisible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.comments.push(comment);
  idea.commentCount += 1;
  idea.updatedAt = new Date().toISOString();
  emit();
  return { ok: true, comment };
}

export function updateComment(
  commentId: string,
  body: string,
): { ok: true } | { ok: false; error: string } {
  const session = ensureLabSession();
  const comment = state.comments.find((c) => c.id === commentId);
  if (!comment) return { ok: false, error: "Comment not found." };
  if (comment.userId !== session.userId) return { ok: false, error: "You can only edit your comments." };
  const text = body.trim();
  if (text.length < 2 || text.length > 1000) {
    return { ok: false, error: "Comment must be between 2 and 1000 characters." };
  }
  comment.body = text;
  comment.updatedAt = new Date().toISOString();
  emit();
  return { ok: true };
}

export function deleteComment(commentId: string): { ok: true } | { ok: false; error: string } {
  const session = ensureLabSession();
  const idx = state.comments.findIndex((c) => c.id === commentId);
  if (idx < 0) return { ok: false, error: "Comment not found." };
  const comment = state.comments[idx];
  if (comment.userId !== session.userId) return { ok: false, error: "You can only delete your comments." };
  state.comments.splice(idx, 1);
  const idea = state.ideas.find((i) => i.id === comment.ideaId);
  if (idea) idea.commentCount = Math.max(0, idea.commentCount - 1);
  emit();
  return { ok: true };
}

export function myIdeas() {
  const session = state.session;
  if (!session) return [] as FeedbackIdea[];
  return state.ideas
    .filter((i) => i.userId === session.userId && i.isVisible)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function myBoostedIdeas() {
  const session = state.session;
  if (!session) return [] as FeedbackIdea[];
  const ids = new Set(state.boostsByUser[session.userId] ?? []);
  return state.ideas
    .filter((i) => ids.has(i.id) && i.isVisible)
    .sort((a, b) => b.boostCount - a.boostCount);
}

/** Accepted ideas board: Planned / Building / Shipped */
export function buildingBoardIdeas() {
  const by = (status: FeedbackStatus) =>
    state.ideas
      .filter((i) => isAcceptedIdea(i) && i.status === status)
      .sort((a, b) => b.boostCount - a.boostCount);

  return {
    considering: by("considering"),
    planned: by("planned"),
    building: by("building"),
    shipped: by("shipped"),
  };
}

/** @deprecated Use buildingBoardIdeas */
export function roadmapIdeas() {
  return buildingBoardIdeas();
}

export function getBuildMessages(ideaId: string) {
  return state.buildMessages
    .filter((m) => m.ideaId === ideaId)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
}

export function addBuildMessage(
  ideaId: string,
  body: string,
  opts?: { asTeam?: boolean },
): { ok: true; message: FeedbackBuildMessage } | { ok: false; error: string } {
  const text = body.trim();
  if (text.length < 2 || text.length > 1000) {
    return { ok: false, error: "Message must be between 2 and 1000 characters." };
  }
  const idea = state.ideas.find((i) => i.id === ideaId);
  if (!idea || !idea.isVisible) return { ok: false, error: "Idea not found." };
  if (!idea.isFeatured) {
    return { ok: false, error: "Build chat opens after Explore accepts this idea." };
  }

  const asTeam = Boolean(opts?.asTeam);
  const session = ensureLabSession();
  if (!asTeam && idea.userId !== session.userId) {
    return { ok: false, error: "Only the idea author can message the Explore team here." };
  }

  const message: FeedbackBuildMessage = {
    id: uid("bm"),
    ideaId,
    userId: asTeam ? "team-explore" : session.userId,
    authorName: asTeam ? "Explore Team" : session.displayName,
    body: text,
    isTeam: asTeam,
    createdAt: new Date().toISOString(),
  };
  state.buildMessages.push(message);
  idea.updatedAt = new Date().toISOString();
  emit();
  return { ok: true, message };
}

/** Admin mutations (local preview / demo) */
export function adminUpdateIdea(
  ideaId: string,
  patch: Partial<
    Pick<FeedbackIdea, "status" | "teamResponse" | "isVisible" | "isFeatured" | "duplicateOf">
  >,
) {
  const idea = state.ideas.find((i) => i.id === ideaId);
  if (!idea) return { ok: false as const, error: "Idea not found." };
  const wasFeatured = idea.isFeatured;
  Object.assign(idea, patch);
  idea.updatedAt = new Date().toISOString();
  if (patch.status) {
    const update: FeedbackUpdate = {
      id: uid("u"),
      ideaId,
      status: patch.status,
      body: `Status updated to ${patch.status}.`,
      createdAt: new Date().toISOString(),
    };
    state.updates.push(update);
  }
  if (patch.isFeatured === true && !wasFeatured) {
    if (idea.status === "listening" || idea.status === "considering") {
      idea.status = "considering";
    }
    state.buildMessages.push({
      id: uid("bm"),
      ideaId,
      userId: "team-explore",
      authorName: "Explore Team",
      body: "We accepted your idea. Next steps feel like an interview process — review, shortlist, build, ship. We'll message you here.",
      isTeam: true,
      createdAt: new Date().toISOString(),
    });
  }
  emit();
  return { ok: true as const, idea };
}

export function adminListIdeas(opts?: {
  status?: FeedbackStatus | "all";
  query?: string;
  featured?: "all" | "starred" | "inbox";
}) {
  let ideas = [...state.ideas];
  const status = opts?.status ?? "all";
  const query = (opts?.query ?? "").trim().toLowerCase();
  const featured = opts?.featured ?? "all";
  if (status !== "all") ideas = ideas.filter((i) => i.status === status);
  if (featured === "starred") ideas = ideas.filter((i) => i.isFeatured);
  if (featured === "inbox") ideas = ideas.filter((i) => !i.isFeatured);
  if (query) {
    ideas = ideas.filter(
      (i) =>
        i.title.toLowerCase().includes(query) ||
        i.description.toLowerCase().includes(query) ||
        i.email.toLowerCase().includes(query) ||
        i.authorName.toLowerCase().includes(query),
    );
  }
  return ideas.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}
