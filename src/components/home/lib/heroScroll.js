export function heroScrollProgress(story) {
  const viewport = story.querySelector('.landing-hero').clientHeight;
  const travel = Math.max(1, viewport);
  return Math.max(0, Math.min(1, -story.getBoundingClientRect().top / travel));
}
