import { Redirect } from 'expo-router';
import type { ComponentType } from 'react';

// Development only: in a release build __DEV__ is false, so Metro drops this
// require and the gallery never reaches a store build or the web.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Gallery: ComponentType | null = __DEV__ ? require('@/components/dev/Gallery').default : null;

/** Every token and shared component (components/dev/Gallery), in development builds. */
export default function DevGallery() {
  return Gallery ? <Gallery /> : <Redirect href="/" />;
}
