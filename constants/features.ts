/**
 * Launch switches. On 7 Oct 2026 Study and Prep were left out of the launch.
 * Their code stays; these hide the tabs, buttons and sections, and their
 * routes redirect home. Design for bringing them back:
 * https://claude.ai/artifact/94S1if6gMwF8Sruoi491FG
 *
 * Not behind a switch, on purpose: Batch (a sheet on every drink page, in
 * both modes), the drink page's Service section, and prep cards on
 * ingredient pages (the catalog's house recipes are useful to everyone).
 * The global "Service mode" setting is gone; Station replaces it later.
 *
 * ponytail: build-time constants, so turning one on is an OTA update for
 * everyone at once. Upgrade path: a PostHog flag per feature to bring one
 * back gradually, or delete the feature and its switch if it isn't coming back.
 */
export const FEATURES: Record<'study' | 'prep', boolean> = {
  study: false,
  prep: false,
};
