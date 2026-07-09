import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import { APP_SCREENS } from "@/lib/constants";
import type { PioneerContentEntry, PioneerVideoCard } from "@/features/pioneers/types";
import type { TranslationKey } from "@/locales/messages";

type PioneerVideoShowcaseProps = {
  videoCards: PioneerVideoCard[];
  topVideos?: PioneerContentEntry[];
  topPlaces?: PioneerContentEntry[];
  topRoutes?: PioneerContentEntry[];
  source?: "mock" | "api";
};

type ShowcaseItem = {
  id: string;
  image: string;
  title: string;
  creator: string;
  type: "video" | "place" | "route";
  typeKey: TranslationKey;
  href?: string;
  featured?: boolean;
};

const TYPE_FROM_KEY: Record<string, "video" | "place" | "route"> = {
  "pioneer.video.type.video": "video",
  "pioneer.video.type.place": "place",
  "pioneer.video.type.route": "route",
};

const TYPE_LABEL: Record<"video" | "place" | "route", TranslationKey> = {
  video: "pioneer.video.type.video",
  place: "pioneer.video.type.place",
  route: "pioneer.video.type.route",
};

const FALLBACK_BY_TYPE: Record<"video" | "place" | "route", string> = {
  video: APP_SCREENS.gallery[4],
  place: APP_SCREENS.gallery[2],
  route: APP_SCREENS.routeMap,
};

function creatorInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function liveToShowcase(entry: PioneerContentEntry): ShowcaseItem {
  return {
    id: entry.id,
    image: entry.thumbnailUrl || FALLBACK_BY_TYPE[entry.type],
    title: entry.title,
    creator: entry.creatorName || entry.subtitle || "Explore",
    type: entry.type,
    typeKey: TYPE_LABEL[entry.type],
    href: entry.href,
    featured: entry.rank === 1,
  };
}

export function PioneerVideoShowcase({
  videoCards,
  topVideos = [],
  topPlaces = [],
  topRoutes = [],
  source = "mock",
}: PioneerVideoShowcaseProps) {
  const reduceMotion = useReducedMotion();
  const stripRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const liveItems = [...topVideos, ...topPlaces, ...topRoutes].map(liveToShowcase);
    if (liveItems.length > 0) return liveItems.slice(0, 8);

    return videoCards.map((card, index) => ({
      id: card.id,
      image: card.image,
      title: "",
      creator: card.creator,
      type: TYPE_FROM_KEY[card.typeKey] || "video",
      typeKey: card.typeKey,
      featured: index === 0,
      titleKey: card.titleKey,
    })) as (ShowcaseItem & { titleKey?: TranslationKey })[];
  }, [topVideos, topPlaces, topRoutes, videoCards]);

  const scrollStrip = (direction: -1 | 1) => {
    stripRef.current?.scrollBy({ left: direction * 240, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section className="pioneer-section pioneer-section--showcase" id="showcase" aria-labelledby="pioneer-showcase-title">
      <div className="container pioneer-showcase">
        <div className="pioneer-section-heading">
          <p className="pioneer-eyebrow">
            <T k="pioneer.showcase.eyebrow" />
          </p>
          <h2 id="pioneer-showcase-title" className="pioneer-section-title">
            <T k="pioneer.showcase.title" />
          </h2>
          <p className="pioneer-section-lead">
            <T k="pioneer.showcase.lead" />
          </p>
          {source === "api" && items.length > 0 && (
            <p className="pioneer-live-pill">
              <T k="pioneer.showcase.live" />
            </p>
          )}
        </div>

        <div className="pioneer-video-carousel">
          <div className="pioneer-video-carousel__fade pioneer-video-carousel__fade--left" aria-hidden="true" />
          <div className="pioneer-video-carousel__fade pioneer-video-carousel__fade--right" aria-hidden="true" />
          <div className="pioneer-video-strip" ref={stripRef}>
            {items.map((item, index) => {
              const cardClass = `pioneer-video-card pioneer-video-card--${item.type}${item.featured ? " pioneer-video-card--featured" : ""}`;
              const body = (
                <>
                  <div className="pioneer-video-card__frame">
                    <div className="pioneer-video-card__media">
                      <img src={item.image} alt="" loading="lazy" />
                      <span className="pioneer-video-card__type">
                        <T k={item.typeKey} />
                      </span>
                      {item.type === "video" && (
                        <span className="pioneer-video-card__play" aria-hidden="true">
                          ▶
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pioneer-video-card__body">
                    <h3>
                      {"titleKey" in item && item.titleKey ? (
                        <T k={item.titleKey as TranslationKey} />
                      ) : (
                        item.title
                      )}
                    </h3>
                    <div className="pioneer-video-card__creator">
                      <span className="pioneer-video-card__avatar">{creatorInitials(item.creator)}</span>
                      <p>{item.creator}</p>
                    </div>
                  </div>
                </>
              );

              return item.href ? (
                <Link key={item.id} to={item.href} className={cardClass}>
                  {body}
                </Link>
              ) : (
                <motion.article
                  key={item.id}
                  className={cardClass}
                  initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ delay: index * 0.05, duration: 0.45 }}
                  whileHover={reduceMotion ? undefined : { y: -8 }}
                >
                  {body}
                </motion.article>
              );
            })}
          </div>
          <div className="pioneer-video-carousel__nav" aria-hidden="true">
            <button type="button" className="pioneer-video-carousel__btn" onClick={() => scrollStrip(-1)}>
              ‹
            </button>
            <button type="button" className="pioneer-video-carousel__btn" onClick={() => scrollStrip(1)}>
              ›
            </button>
          </div>
        </div>

        <div className="pioneer-social-note">
          <p>
            <T k="pioneer.showcase.social" />
          </p>
        </div>
      </div>
    </section>
  );
}
