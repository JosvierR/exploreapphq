import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { T } from "@/components/ui/T";
import type { PioneerVideoCard } from "@/features/pioneers/types";
import type { TranslationKey } from "@/locales/messages";

type PioneerVideoShowcaseProps = {
  videoCards: PioneerVideoCard[];
};

const TYPE_FROM_KEY: Record<string, "video" | "place" | "route"> = {
  "pioneer.video.type.video": "video",
  "pioneer.video.type.place": "place",
  "pioneer.video.type.route": "route",
};

function creatorInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PioneerVideoShowcase({ videoCards }: PioneerVideoShowcaseProps) {
  const reduceMotion = useReducedMotion();
  const stripRef = useRef<HTMLDivElement>(null);

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
        </div>

        <div className="pioneer-video-carousel">
          <div className="pioneer-video-carousel__fade pioneer-video-carousel__fade--left" aria-hidden="true" />
          <div className="pioneer-video-carousel__fade pioneer-video-carousel__fade--right" aria-hidden="true" />
          <div className="pioneer-video-strip" ref={stripRef}>
            {videoCards.map((card, index) => {
              const kind = TYPE_FROM_KEY[card.typeKey as TranslationKey] || "video";

              return (
                <motion.article
                  key={card.id}
                  className={`pioneer-video-card pioneer-video-card--${kind}${index === 0 ? " pioneer-video-card--featured" : ""}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ delay: index * 0.05, duration: 0.45 }}
                  whileHover={reduceMotion ? undefined : { y: -8 }}
                >
                  <div className="pioneer-video-card__frame">
                    <div className="pioneer-video-card__media">
                      <img src={card.image} alt="" loading="lazy" />
                      <span className="pioneer-video-card__type">
                        <T k={card.typeKey} />
                      </span>
                      {kind === "video" && (
                        <span className="pioneer-video-card__play" aria-hidden="true">
                          ▶
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pioneer-video-card__body">
                    <h3>
                      <T k={card.titleKey} />
                    </h3>
                    <div className="pioneer-video-card__creator">
                      <span className="pioneer-video-card__avatar">{creatorInitials(card.creator)}</span>
                      <p>{card.creator}</p>
                    </div>
                  </div>
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
