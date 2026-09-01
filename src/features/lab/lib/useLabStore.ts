import { useSyncExternalStore } from "react";
import { getLabSnapshot, subscribeLab } from "../labStore";

export function useLabStore() {
  return useSyncExternalStore(subscribeLab, getLabSnapshot, getLabSnapshot);
}
