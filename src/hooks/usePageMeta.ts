import { useEffect } from "react";
import { applyPageMeta, type PageMetaInput } from "@/lib/pageMeta";

export function usePageMeta(meta: PageMetaInput) {
  const { title, description, path = "/", imagePath } = meta;

  useEffect(() => {
    applyPageMeta({ title, description, path, imagePath });
  }, [title, description, path, imagePath]);
}
