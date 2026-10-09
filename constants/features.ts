/**
 * Launch switches. On 7 Oct 2026 Study, Prep and Service were left out of the
 * launch. Their code stays; these hide the tabs, buttons and sections, and
 * their routes redirect home. The global "Service mode" setting is gone for
 * good: Station replaces it (design: https://claude.ai/artifact/94S1if6gMwF8Sruoi491FG).
 *
 * Prep cards on ingredient pages are not behind `prep` on purpose: the
 * catalog's house recipes (syrups, cordials) are useful to everyone, home
 * bartenders included.
 *
 * ponytail: build-time constants, so turning one on is an OTA update for
 * everyone at once. Upgrade path: a PostHog flag per feature to bring one
 * back gradually, or delete the feature and its switch if it isn't coming back.
 */
export const FEATURES: Record<'study' | 'prep' | 'service', boolean> = {
  study: false,
  prep: false,
  service: false,
};
