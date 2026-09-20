import { Link } from "react-router-dom";
import { Reveal } from "@/components/ui/Reveal";
import { T } from "@/components/ui/T";
import type { TranslationKey } from "@/locales/messages";

const HOW_STEPS: TranslationKey[] = ["how.1", "how.2", "how.3", "how.4", "how.5", "how.6"];

export function UnifiedHowItWorks() {
  return (
    <section className="section unified-how" id="how-it-works" aria-labelledby="how-title">
      <div className="container">
        <Reveal>
          <h2 id="how-title" className="section-title">
            <T k="how.title" />
          </h2>
          <p className="section-lead">
            <T k="how.lead" />
          </p>
          <ol className="unified-how__steps">
            {HOW_STEPS.map((key, index) => (
              <li key={key}>
                <span className="unified-how__num" aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  <T k={key} />
                </span>
              </li>
            ))}
          </ol>
          <div className="btn-group" style={{ marginTop: "1.5rem" }}>
            <a href="#ranking" className="btn btn-ghost">
              <T k="unified.how.cta.ranking" />
            </a>
            <Link to="/lab" className="btn btn-ghost">
              <T k="lab.nav" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
