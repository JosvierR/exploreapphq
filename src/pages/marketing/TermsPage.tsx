import { Link } from "react-router-dom";
import { SITE } from "@/lib/constants";

export function TermsPage() {
  return (
    <main className="legal-page container">
      <h1>Terms of Use</h1>
      <p>
        By using Explore you agree to these terms. Explore is a social app to discover real places
        through videos, maps, routes and shared experiences.
      </p>
      <h2>Service</h2>
      <p>
        The app may open navigation in third-party map applications (Google Maps, Apple Maps, Waze).
        Those services are governed by their own terms. Content and availability may change as the
        product evolves.
      </p>
      <h2>User content</h2>
      <p>
        You are responsible for content you publish. You grant Explore Atlas the rights needed to
        operate the service (display, store, and distribute content in connection with the platform).
      </p>
      <h2>Updates</h2>
      <p>Explore Atlas LLC may update the service and these terms at any time.</p>
      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
      </p>
      <p style={{ marginTop: "2rem" }}>
        <Link to="/privacy">Privacy Policy</Link> · <Link to="/">Home</Link>
      </p>
    </main>
  );
}
