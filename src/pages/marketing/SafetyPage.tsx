import { SITE } from "@/lib/constants";
import { LegalPageShell, type LegalSection } from "./LegalPageShell";

const sections: LegalSection[] = [
  {
    id: "community-safety",
    title: "Community safety",
    content: (
      <p>
        Explore is designed for discovering real places. Do not post content that harasses, threatens, exploits,
        impersonates, scams, or intentionally misleads other people.
      </p>
    ),
  },
  {
    id: "content-rules",
    title: "Content rules",
    content: (
      <ul>
        <li>No spam, scams, or fake listings.</li>
        <li>No hateful, sexually explicit, violent, or harassing content.</li>
        <li>No private personal information without permission.</li>
        <li>No content that encourages unsafe travel or illegal activity.</li>
      </ul>
    ),
  },
  {
    id: "moderation",
    title: "Moderation",
    content: (
      <p>
        Users can report content for review. Explore admins may mark reports reviewed, dismiss reports, hide content,
        remove content from public visibility, or restore content when appropriate.
      </p>
    ),
  },
  {
    id: "reporting",
    title: "Reporting issues",
    content: (
      <p>
        Report safety issues in the app when available or contact <a href={`mailto:${SITE.email}`}>{SITE.email}</a> with
        relevant details. Do not send passwords, tokens, or unnecessary personal data.
      </p>
    ),
  },
];

export function SafetyPage() {
  return (
    <LegalPageShell
      eyebrow="Safety"
      title="Safety Rules"
      summary="Rules and moderation expectations for keeping Explore useful, respectful, and safe."
      lastUpdated="July 2, 2026"
      sections={sections}
    />
  );
}
