const FEEDBACK_PATH = "/api/feedback/submit";

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
  try {
    const res = await fetch(FEEDBACK_PATH, {
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
    throw new Error(data.error ?? "Could not reach the server. Try again in a moment.");
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Could not reach the server. Try again in a moment.");
  }
}
