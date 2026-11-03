import { lazy, Suspense, useEffect, type ComponentType } from 'react';

/** A failed load (offline, or an old chunk after a deploy) shows nothing and closes what it was opening; the next render retries. */
function Failed({ onClose }: { onClose?: () => void }) {
  useEffect(() => onClose?.(), [onClose]);
  return null;
}

/**
 * A component whose code loads when it is first drawn, for the `*Lazy.web.tsx`
 * files: a sheet, a map or a banner that a page's first paint doesn't need, off
 * that page's first-load JS. Nothing shows while it loads. A failed load never
 * reaches the route's error screen: it renders nothing, calls `onClose` when
 * the component has one, and tries again on the next render. `preload` starts
 * the download early (when a tap is likely to need it).
 */
export function lazyOnWeb<P extends object>(load: () => Promise<ComponentType<P>>) {
  const make = () =>
    lazy((): Promise<{ default: ComponentType<P> }> =>
      load().then(
        (component) => ({ default: component }),
        () => {
          Lazy = make();
          return { default: Failed as ComponentType<P> };
        },
      ),
    );
  let Lazy = make();
  function LazyOnWeb(props: P) {
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  return Object.assign(LazyOnWeb, { preload: () => void load().catch(() => undefined) });
}
