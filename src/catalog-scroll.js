// The first part of the sticky catalog reveals the scene beneath the hero.
// Navigation and the carousel must use the same boundary.
export function catalogFadeLength(height, viewportHeight) {
  return Math.min(viewportHeight * .6, Math.max(1, height - viewportHeight) * .5);
}

export function catalogProgress(rect, viewportHeight) {
  const total = Math.max(1, rect.height - viewportHeight);
  const fade = catalogFadeLength(rect.height, viewportHeight);
  return Math.max(0, Math.min(1, (-rect.top - fade) / Math.max(1, total - fade)));
}

export function catalogScrollTop(rect, scrollY, viewportHeight, index = 0, count = 7) {
  const fade = catalogFadeLength(rect.height, viewportHeight);
  const progress = Math.max(0, Math.min(count - 1, index)) / Math.max(1, count - 1);
  return Math.ceil(scrollY + rect.top + fade + progress * Math.max(0, rect.height - viewportHeight - fade));
}
