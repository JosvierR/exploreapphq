import { T } from "@/components/ui/T";

const POINTS = [
  "pioneer.whatIs.point1",
  "pioneer.whatIs.point2",
  "pioneer.whatIs.point3",
] as const;

export function PioneerWhatIs() {
  return (
    <section className="pioneer-section pioneer-section--intro" aria-labelledby="pioneer-what-title">
      <div className="container pioneer-what">
        <div>
          <p className="pioneer-eyebrow">
            <T k="pioneer.whatIs.eyebrow" />
          </p>
          <h2 id="pioneer-what-title" className="pioneer-section-title">
            <T k="pioneer.whatIs.title" />
          </h2>
          <p className="pioneer-section-lead">
            <T k="pioneer.whatIs.lead" />
          </p>
        </div>
        <div className="pioneer-quote-panel">
          <blockquote>
            <T k="pioneer.whatIs.quote" />
          </blockquote>
          <ul className="pioneer-check-list">
            {POINTS.map((key) => (
              <li key={key}>
                <T k={key} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
