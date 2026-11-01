/**
 * The venue feature switches and their "New at <venue>" news are gone (31 Oct
 * 2026). ponytail: ctx/AuthContext.tsx still accepts this shape in
 * updateProfile; nothing passes it. Delete both together in a human-gated PR,
 * since that file is auth.
 */
export type FeatureNewsSeen = Record<string, Record<string, { line?: string; tab?: string }>>;
