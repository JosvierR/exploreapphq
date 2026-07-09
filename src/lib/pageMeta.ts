import { SITE } from "@/lib/constants";

type MetaAttribute = "name" | "property";

function upsertMeta(attribute: MetaAttribute, key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

export type PageMetaInput = {
  title: string;
  description: string;
  path?: string;
  imagePath?: string;
};

export function applyPageMeta({ title, description, path = "/", imagePath = "/ExplorePromo1.png" }: PageMetaInput) {
  const canonicalUrl = `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
  const imageUrl = imagePath.startsWith("http") ? imagePath : `${SITE.url}${imagePath}`;

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("property", "og:image", imageUrl);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", imageUrl);
}
