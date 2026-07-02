import { SITE } from "@/lib/constants";
import { LegalPageShell, type LegalSection } from "./LegalPageShell";

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    content: (
      <p>
        Explore is operated by {SITE.legalName}, {SITE.address}. D-U-N-S: {SITE.duns}.
      </p>
    ),
  },
  {
    id: "data-we-collect",
    title: "Data we collect",
    content: (
      <p>
        We collect minimal information to provide the service: account details, location data when you use map and route
        features, content you upload, and aggregate usage analytics. We do not sell personal data.
      </p>
    ),
  },
  {
    id: "how-we-use-data",
    title: "How we use data",
    content: (
      <p>
        We use data to operate accounts, show nearby places and routes, support safety moderation, improve reliability,
        and respond to support requests.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    content: (
      <p>
        You may request access, correction, or deletion of your data at any time via{" "}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
    ),
  },
  {
    id: "account-deletion",
    title: "Account and data deletion",
    content: (
      <p>
        To request account or data deletion, email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> from the account
        email address when possible. We may ask for verification before processing the request.
      </p>
    ),
  },
];

export function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="How Explore handles account, location, content, analytics, and support data."
      lastUpdated="July 2, 2026"
      sections={sections}
    />
  );
}
