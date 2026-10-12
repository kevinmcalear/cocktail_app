import { Image } from 'expo-image';
import { lazy, Suspense } from 'react';

import type { ZoomablePictureProps } from './ZoomablePicture';

const Lazy = lazy(() => import('./ZoomablePicture').then((m) => ({ default: m.ZoomablePicture })));

/**
 * On the web, zooming (and the gesture and animation code it runs on) loads
 * when the viewer first opens, not with every page that has a picture; the
 * still picture shows meanwhile.
 */
export function ZoomablePicture(props: ZoomablePictureProps) {
  const still = (
    <Image
      source={typeof props.source === 'string' ? { uri: props.source } : props.source}
      style={{ width: props.width, height: props.height }}
      contentFit="contain"
      accessibilityLabel={props.accessibilityLabel}
    />
  );
  return (
    <Suspense fallback={still}>
      <Lazy {...props} />
    </Suspense>
  );
}
