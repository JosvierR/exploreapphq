export const LAB_PATH = "/lab";
export const LAB_BUILDING_PATH = "/lab/building";
/** @deprecated Use LAB_BUILDING_PATH */
export const LAB_ROADMAP_PATH = LAB_BUILDING_PATH;
export const LAB_MINE_PATH = "/lab/mine";

export function labIdeaPath(slugOrId: string) {
  return `/lab/ideas/${encodeURIComponent(slugOrId)}`;
}
