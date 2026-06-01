import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/features/auth/AuthProvider";
import { joinWaitlist } from "@/lib/waitlistSignup";
import { mapFirebaseAuthError } from "@/features/auth/firebaseAuth";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import "@/styles/access.css";

export function AccessPage() {
  const { isAdmin } = useAuth();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState<{ message: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAdmin) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setError("Enter a valid phone number with country code, e.g. +1 809 555 1234.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      const { created } = await joinWaitlist({
        phone: normalizedPhone,
        email: normalizedEmail || undefined,
      });
      setSuccess({
        label: normalizedPhone,
        message: created
          ? "You're on the list. We'll text you the moment Explore is ready to download."
          : "You're already on the list. Sit tight — we'll text you when Explore launches.",
      });
      setPhone("");
      setEmail("");
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code.startsWith("auth/")) {
        setError(mapFirebaseAuthError(code));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="access-page">
      <div className="access-card access-card--public">
        <div className="access-brand">
          <BrandLogo />
        </div>

        <p className="access-eyebrow">Early access</p>
        <h1>Be first to explore</h1>
        <p className="access-lead">
          Discover real places through videos. Drop your number and we'll text you the moment you
          can download Explore.
        </p>

        <ul className="access-perks" aria-hidden="true">
          <li>Real videos from real places</li>
          <li>Save spots and build routes</li>
          <li>Explore what's near you</li>
        </ul>

        {success ? (
          <div className="access-success access-success--wow" role="status">
            <div className="access-success__glow" aria-hidden="true" />
            <span className="access-success__icon" aria-hidden="true">
              ✓
            </span>
            <p className="access-success__title">You're in</p>
            <p className="access-success__message">{success.message}</p>
            <p className="access-success__email">{success.label}</p>
            <ul className="access-success__steps">
              <li>Watch real videos from real places</li>
              <li>Save spots and build routes</li>
              <li>We'll text you when the app is ready</li>
            </ul>
            <p className="access-success__cta">
              Have an idea?{" "}
              <Link to="/feedback">Tell us what Explore should do →</Link>
            </p>
          </div>
        ) : (
          <form className="access-form" onSubmit={handleSubmit}>
            <label htmlFor="phone">Your phone number</label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="+1 809 555 1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={phone.length > 0 && !isValidPhone(phone)}
            />

            <label htmlFor="email">
              Email <span className="access-optional">(optional)</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && (
              <p className="access-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary access-submit" disabled={loading}>
              {loading ? "Joining…" : "Get early access"}
            </button>

            <p className="access-footnote">
              We'll only text about the launch. Message &amp; data rates may apply. Reply STOP to opt
              out.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
