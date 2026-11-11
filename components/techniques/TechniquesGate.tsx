import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { PencilState } from '@/components/ds';
import { loadTechniques, looksLikeMissingChunk, useTechniques, useTechniquesFailure } from '@/lib/techniques';

/**
 * Renders its children once the technique library (lib/techniques, a lazy
 * chunk on the web) is in, and nothing before. Put it above every component
 * that reads the library: the React Compiler can keep an answer worked out
 * from the empty library, so a reader must not render before the load. The
 * root layout starts the load once the first screen's data is in, so a tap
 * through the app rarely waits; a deep link waits on one small fetch. If the
 * load fails (offline, or a deploy swapped the chunk) it says so, with Try
 * again. On the web, a second failure while online that looks like a missing
 * chunk reloads the page, the only way to get the new file names.
 */
export function TechniquesGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const ready = useTechniques();
  const failure = useTechniquesFailure();
  if (ready) return children;
  if (!failure) return fallback;
  const tryAgain = () => {
    loadTechniques().catch((e: unknown) => {
      if (Platform.OS === 'web' && navigator.onLine && looksLikeMissingChunk(e instanceof Error ? e : null)) window.location.reload();
    });
  };
  return <PencilState kind="error" title="Couldn’t load the technique library." detail="Check your connection." action={{ label: 'Try again', onPress: tryAgain }} />;
}
