import { Link } from "react-router-dom";

export function NotFoundPage() {
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
      <p className="eyebrow">404</p>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "1rem" }}>
        This route doesn&apos;t exist.
      </h1>
      <p className="text-muted" style={{ marginBottom: "2rem" }}>
        The page you&apos;re looking for isn&apos;t on the map.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to Explore Atlas
      </Link>
    </main>
  );
}
