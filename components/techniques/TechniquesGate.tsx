import type { ReactNode } from 'react';

import { useTechniques } from '@/lib/techniques';

/**
 * Renders its children once the technique library (lib/techniques, a lazy
 * chunk on the web) is in, and nothing before. Put it above every component
 * that reads the library: the React Compiler can keep an answer worked out
 * from the empty library, so a reader must not render before the load. The
 * root layout starts the load once the first screen's data is in, so a tap
 * through the app rarely waits; a deep link waits on one small fetch.
 */
export function TechniquesGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return useTechniques() ? children : fallback;
}
