import { useEffect, useState } from 'react';

/** State that clears itself `ms` after it's set: a note with Undo, a "saved" line. */
export function useExpiring<T>(ms: number): [T | null, (value: T | null) => void] {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (value === null) return;
    const t = setTimeout(() => setValue(null), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return [value, setValue];
}
