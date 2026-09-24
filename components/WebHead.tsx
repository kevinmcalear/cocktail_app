import Head from 'expo-router/head';
import type { ReactNode } from 'react';

/**
 * Tags for the web page's <head> (title and the like). Native renders nothing
 * (WebHead.native.tsx): there expo-router's Head drives Handoff, which needs a
 * configured site origin and shows an alert without one.
 */
export function WebHead({ children }: { children: ReactNode }) {
  return <Head>{children}</Head>;
}
