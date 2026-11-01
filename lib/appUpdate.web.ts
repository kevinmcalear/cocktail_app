/** The web has no over-the-air updates: each deploy is the build. */
export function appUpdate(): string | null {
  return null;
}
