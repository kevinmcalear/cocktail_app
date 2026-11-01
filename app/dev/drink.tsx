import { Redirect } from 'expo-router';
import type { ComponentType } from 'react';

// Development only, like /dev/gallery.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DrinkPreview: ComponentType | null = __DEV__ ? require('@/components/dev/DrinkPreview').default : null;

/** The drink page with a sample drink per role (components/dev/DrinkPreview), in development builds. */
export default function DevDrink() {
  return DrinkPreview ? <DrinkPreview /> : <Redirect href="/" />;
}
