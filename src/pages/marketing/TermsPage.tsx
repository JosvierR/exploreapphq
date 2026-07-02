import { SITE } from "@/lib/constants";
import { LegalPageShell, type LegalSection } from "./LegalPageShell";

const sections: LegalSection[] = [
  {
    id: "service",
    title: "Service",
    content: (
      <p>
        Explore is a social app to discover real places through videos, maps, routes, and shared experiences. Content
        and availability may change as the product evolves.
      </p>
    ),
  },
  {
    id: "maps",
    title: "Maps and third-party services",
    content: (
      <p>
        The app may open navigation in third-party map applications including Google Maps, Apple Maps, and Waze. Those
        services are governed by their own terms and privacy practices.
      </p>
    ),
  },
  {
    id: "user-content",
    title: "User content",
    content: (
      <p>
        You are responsible for content you publish. You grant Explore Atlas the rights needed to operate the service,
        including displaying, storing, and distributing content in connection with the platform.
      </p>
    ),
  },
  {
    id: "safety",
    title: "Safety and moderation",
    content: (
      <p>
        Explore may review, hide, remove, or restrict content and accounts to protect users, comply with law, and keep
        the service safe. Safety guidance is available on the Safety page.
      </p>
    ),
  },
  {
    id: "updates",
    title: "Updates",
    content: <p>{SITE.legalName} may update the service and these terms at any time.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p>
        Questions: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Terms of Use"
      summary="The core terms for using Explore, publishing content, and interacting with maps and routes."
      lastUpdated="July 2, 2026"
      sections={sections}
    />
  );
}
