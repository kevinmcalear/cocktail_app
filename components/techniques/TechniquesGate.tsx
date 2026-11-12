import { onlineManager } from '@tanstack/react-query';
import { type ReactNode, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { PencilState } from '@/components/ds';
import { loadTechniques, looksLikeMissingChunk, useTechniquesState } from '@/lib/techniques';

/**
 * Renders its children once the technique library (lib/techniques, a lazy
 * chunk on the web) is in, and nothing before. Put it above every component
 * that reads the library: the React Compiler can keep an answer worked out
 * from the empty library, so a reader must not render before the load. The
 * root layout starts the load once the first screen's data is in, so a tap
 * through the app rarely waits; a deep link waits on one small fetch.
 *
 * If the load has failed twice in a row (offline, or a deploy swapped the
 * chunk) it says so, with Try again: `onFailure` picks the size ('full' for a
 * screen, 'compact' for a sheet body, 'none' for a card that can go without).
 * On the web, a tapped retry that fails again while online with a missing-
 * chunk error reloads the page, the only way to get the new file names.
 */
export function TechniquesGate({ children, fallback = null, onFailure = 'full' }: { children: ReactNode; fallback?: ReactNode; onFailure?: 'full' | 'compact' | 'none' }) {
  const { ready, failed } = useTechniquesState();
  if (ready) return children;
  if (!failed || onFailure === 'none') return fallback;
  return <TechniquesFailed compact={onFailure === 'compact'} />;
}

const isOnline = () => onlineManager.isOnline();
const onConnectionChange = (l: () => void) => onlineManager.subscribe(l);

/**
 * The failed message and its Try again, for a gate or for a sheet that opens
 * first and gates its own content (ToolSheet), so a sheet is never swallowed
 * by a gate above it. The wording follows the connection as it changes.
 */
export function TechniquesFailed({ compact }: { compact?: boolean }) {
  const tryAgain = () => {
    loadTechniques().catch((e: unknown) => {
      if (Platform.OS === 'web' && onlineManager.isOnline() && looksLikeMissingChunk(e instanceof Error ? e : null)) window.location.reload();
    });
  };
  const offline = !useSyncExternalStore(onConnectionChange, isOnline, () => true);
  return (
    <PencilState
      kind="error"
      compact={compact}
      title="Couldn’t load the technique library."
      detail={offline ? 'Check your connection and try again.' : 'Try again, or reload if it keeps happening.'}
      action={{ label: 'Try again', onPress: tryAgain }}
    />
  );
}
