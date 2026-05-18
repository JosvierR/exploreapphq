import { Link } from "react-router-dom";
import { SITE } from "@/lib/constants";

export function PrivacyPage() {
  return (
    <main className="legal-page container">
      <h1>Privacy Policy</h1>
      <p>
        <strong>Who we are.</strong> Explore Atlas LLC, {SITE.address}. D-U-N-S: {SITE.duns}.
      </p>
      <h2>Data we collect</h2>
      <p>
        We collect minimal information to provide the service: account details, location data when
        you use map and route features, content you upload, and aggregate usage analytics. We do not
        sell personal data.
      </p>
      <h2>Your rights</h2>
      <p>
        You may request access, correction, or deletion of your data at any time via{" "}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
      <p style={{ marginTop: "2rem" }}>
        <Link to="/terms">Terms of Use</Link> · <Link to="/">Home</Link>
      </p>
    </main>
  );
}
