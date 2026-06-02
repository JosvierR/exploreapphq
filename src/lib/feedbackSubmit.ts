const PATHS = ["/.netlify/functions/feedback-submit", "/api/feedback/submit"] as const;

export type FeedbackInput = {
  message: string;
  email?: string;
  name?: string;
  category?: "idea" | "bug" | "love" | "other";
};

export type FeedbackResult = {
  ok: boolean;
  message: string;
  id?: string;
};

export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  let lastError = "Could not reach the server. Try again in a moment.";

  for (const path of PATHS) {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { error?: string; message?: string; ok?: boolean; id?: string };
      if (res.ok) {
        return {
          ok: true,
          message: data.message ?? "Thanks! We read every note.",
          id: data.id,
        };
      }
      lastError = data.error ?? lastError;
    } catch (err) {
      if (err instanceof Error) lastError = err.message;
    }
  }

  throw new Error(lastError);
}
