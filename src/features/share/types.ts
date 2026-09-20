export type PublicRouteStop = {
  position: number;
  placeId: string;
  name: string;
  category: string | null;
  photoUrl: string | null;
};

export type PublicRoutePreview = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  distanceM: number;
  estimatedDuration: string | null;
  averageRating: number;
  totalRatings: number;
  coverUrl: string | null;
  stops: PublicRouteStop[];
};

export type PublicRoutePreviewResult =
  | { status: "ok"; preview: PublicRoutePreview }
  | { status: "not_found" }
  | { status: "unconfigured" }
  | { status: "error"; message: string };
