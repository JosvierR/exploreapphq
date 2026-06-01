import { buildSequenceEmail } from "../../../server/emails/sequence.mjs";

/**
 * Pre-launch nurture sequence. Step 0 (welcome) is sent at signup.
 * Steps 1..N are sent by the scheduled function once the contact reaches `day`.
 * Each step has email content + a short SMS line.
 */
export const SEQUENCE = [
  // index 0 = welcome (handled at signup; listed for reference, never sent by cron)
  {
    index: 0,
    day: 0,
    sms: "Welcome to Explore early access! We'll text you the moment the app is ready. Reply STOP to opt out.",
  },
  {
    index: 1,
    day: 1,
    sms: "Explore = real video of real places, then save & route them. We'll text your download link at launch. Reply STOP to opt out.",
    email: {
      subject: "What makes Explore different",
      eyebrow: "Day 1 · Get to know Explore",
      title: "Forget filtered photos — see places for real",
      intro:
        "Most travel apps show you staged photos. Explore shows real video from real people, so you know exactly what a place feels like before you go.",
      items: [
        { icon: "🎬", title: "Watch", body: "short, real videos from the spots around you" },
        { icon: "📍", title: "Save", body: "the places you actually want to visit" },
        { icon: "🗺️", title: "Route", body: "turn saved spots into a trip that flows" },
      ],
      outro: "You're on the early list, so you'll be among the first to try it.",
      preheader: "Real video, saved spots, and routes that flow.",
    },
  },
  {
    index: 2,
    day: 3,
    sms: "3 ways people use Explore: find food nearby, plan a weekend, discover hidden spots. Launching soon — Reply STOP to opt out.",
    email: {
      subject: "3 ways people will use Explore",
      eyebrow: "Day 3 · Ideas",
      title: "Here's how Explore fits your day",
      intro: "A quick look at what you'll be able to do the moment we launch:",
      items: [
        { icon: "🍽️", title: "Eat", body: "see real video of nearby food before you pick" },
        { icon: "🧭", title: "Plan", body: "build a weekend route in a couple of taps" },
        { icon: "💎", title: "Discover", body: "find hidden spots locals actually go to" },
      ],
      outro: "Anything you wish a discovery app could do? Just reply — we read every message.",
      cta: "See a preview",
      preheader: "Eat, plan, and discover with real video.",
    },
  },
  {
    index: 3,
    day: 7,
    sms: "Still saving your early-access spot for Explore 👀 We're close. Want updates by email too? Reply with your email. Reply STOP to opt out.",
    email: {
      subject: "Still saving your spot 👀",
      eyebrow: "Day 7 · You're still in",
      title: "We haven't forgotten you",
      intro:
        "Building Explore the right way takes a little time — but your early-access spot is locked in. When we open the doors, you'll be first in line.",
      outro: "Want a friend to join you? Forward this and they can grab a spot too.",
      cta: "Tell a friend",
      preheader: "Your early-access spot is still saved.",
    },
  },
  {
    index: 4,
    day: 14,
    sms: "Are you a creator? Explore rewards people who share real places. Early creators get priority. Reply CREATOR to learn more. Reply STOP to opt out.",
    email: {
      subject: "Calling early creators",
      eyebrow: "Day 14 · For creators",
      title: "Share real places, get rewarded",
      intro:
        "Explore is built on real video from real people. If you love sharing the spots you find, you're exactly who we built the creator tools for.",
      items: [
        { icon: "⭐", title: "Priority", body: "early creators get featured first" },
        { icon: "📈", title: "Reach", body: "your videos help people discover your city" },
      ],
      outro: "Reply “creator” and we'll make sure you're set up before launch.",
      preheader: "Early creators get priority at launch.",
    },
  },
  {
    index: 5,
    day: 28,
    sms: "Almost there 🚀 Explore launches very soon. Keep an eye on your phone — your download link is coming. Reply STOP to opt out.",
    email: {
      subject: "Almost there 🚀",
      eyebrow: "Week 4 · Launch is close",
      title: "The countdown is on",
      intro:
        "We're putting the final polish on Explore. Very soon you'll get the message you've been waiting for: your download link.",
      outro: "Thanks for being early. It genuinely means a lot.",
      cta: "Visit the site",
      preheader: "Your download link is almost here.",
    },
  },
];

export const LAST_STEP_INDEX = SEQUENCE[SEQUENCE.length - 1].index;

/** Steps eligible to be sent by the scheduled job (everything after welcome). */
export function cronSteps() {
  return SEQUENCE.filter((s) => s.index >= 1);
}

export function buildStepEmail(step, links) {
  if (!step.email) return null;
  return buildSequenceEmail(step.email, links);
}
