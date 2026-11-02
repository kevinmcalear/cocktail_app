import type { SourceKey } from './sourceBook';
import type { Grade, Source } from './types';

/** A source with how far to trust it for this particular entry. */
export function src(key: SourceKey, grade: Grade): Source {
  return { key, grade };
}
