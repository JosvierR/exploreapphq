import { Link } from "react-router-dom";

export function ThanksPage() {
  return (
    <main
      className="legal-page container"
      style={{
        textAlign: "center",
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <p className="eyebrow">Thank you</p>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "1rem" }}>
        We received your message.
      </h1>
      <p className="text-muted" style={{ marginBottom: "2rem" }}>
        We&apos;ll get back to you soon. Until then — keep exploring.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to home
      </Link>
    </main>
  );
}
