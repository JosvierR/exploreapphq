import { useSyncExternalStore } from "react";
import { getLabSnapshot, subscribeLab } from "../data/labStore";

export function useLabStore() {
  return useSyncExternalStore(subscribeLab, getLabSnapshot, getLabSnapshot);
}
