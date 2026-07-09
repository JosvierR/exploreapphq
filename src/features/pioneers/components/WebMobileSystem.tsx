import { T } from "@/components/ui/T";

const MOBILE_ITEMS = [
  "pioneer.webMobile.mobile.item1",
  "pioneer.webMobile.mobile.item2",
  "pioneer.webMobile.mobile.item3",
  "pioneer.webMobile.mobile.item4",
] as const;

const WEB_ITEMS = [
  "pioneer.webMobile.web.item1",
  "pioneer.webMobile.web.item2",
  "pioneer.webMobile.web.item3",
  "pioneer.webMobile.web.item4",
] as const;

export function WebMobileSystem() {
  return (
    <section className="pioneer-section pioneer-section--system" aria-labelledby="pioneer-system-title">
      <div className="container">
        <div className="pioneer-section-heading">
          <p className="pioneer-eyebrow">
            <T k="pioneer.webMobile.eyebrow" />
          </p>
          <h2 id="pioneer-system-title" className="pioneer-section-title">
            <T k="pioneer.webMobile.title" />
          </h2>
          <p className="pioneer-section-lead">
            <T k="pioneer.webMobile.lead" />
          </p>
        </div>
        <div className="pioneer-system-grid">
          <article className="pioneer-system-card pioneer-system-card--mobile">
            <span className="pioneer-system-card__label">
              <T k="pioneer.webMobile.mobile.label" />
            </span>
            <h3>
              <T k="pioneer.webMobile.mobile.title" />
            </h3>
            <ul>
              {MOBILE_ITEMS.map((key) => (
                <li key={key}>
                  <T k={key} />
                </li>
              ))}
            </ul>
          </article>
          <div className="pioneer-system-flow" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <article className="pioneer-system-card pioneer-system-card--web">
            <span className="pioneer-system-card__label">
              <T k="pioneer.webMobile.web.label" />
            </span>
            <h3>
              <T k="pioneer.webMobile.web.title" />
            </h3>
            <ul>
              {WEB_ITEMS.map((key) => (
                <li key={key}>
                  <T k={key} />
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
