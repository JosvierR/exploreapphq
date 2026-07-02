import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { SITE } from "@/lib/constants";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function LegalPageShell({
  eyebrow,
  title,
  summary,
  lastUpdated,
  sections,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  lastUpdated: string;
  sections: LegalSection[];
}) {
  return (
    <main className="legal-page legal-page--polished">
      <div className="container">
        <header className="legal-hero">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{summary}</p>
          <dl>
            <div>
              <dt>Last updated</dt>
              <dd>{lastUpdated}</dd>
            </div>
            <div>
              <dt>Operator</dt>
              <dd>{SITE.legalName}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd><a href={`mailto:${SITE.email}`}>{SITE.email}</a></dd>
            </div>
          </dl>
        </header>

        <div className="legal-layout">
          <aside className="legal-toc" aria-label="Table of contents">
            <strong>On this page</strong>
            <nav>
              {sections.map((section) => (
                <a href={`#${section.id}`} key={section.id}>{section.title}</a>
              ))}
            </nav>
            <div className="legal-toc__links">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/safety">Safety</Link>
            </div>
          </aside>

          <article className="legal-content">
            {sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                {section.content}
              </section>
            ))}
          </article>
        </div>
      </div>
    </main>
  );
}
