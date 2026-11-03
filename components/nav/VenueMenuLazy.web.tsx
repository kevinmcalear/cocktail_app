import { lazy, Suspense, useEffect, type ComponentProps, type ComponentType } from 'react';

type MenuProps = ComponentProps<typeof import('./VenueMenu').VenueMenu>;
type SheetProps = ComponentProps<typeof import('./PlaceSheet').PlaceSheet>;

/** A failed load (offline, or an old chunk after a deploy) closes again, and the next tap retries. */
function Closes({ onClose }: { onClose: () => void }) {
  useEffect(onClose, [onClose]);
  return null;
}

/** Loads a component on first render; a failed load renders Closes and the next render tries again. */
function lazyRetry<P extends { onClose: () => void }>(get: () => Promise<ComponentType<P>>) {
  const load = () =>
    lazy((): Promise<{ default: ComponentType<P> }> =>
      get().then(
        (c) => ({ default: c }),
        () => {
          Lazy = load();
          return { default: Closes as ComponentType<P> };
        },
      ),
    );
  let Lazy = load();
  return function Loaded(props: P) {
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}

/**
 * On the web, the places menu and the phone-width place sheet (and the hooks behind them) load when a switcher is
 * first tapped, not with every page that has a header.
 */
export const VenueMenu = lazyRetry<MenuProps>(() => import('./VenueMenu').then((m) => m.VenueMenu));
export const PlaceSheet = lazyRetry<SheetProps>(() => import('./PlaceSheet').then((m) => m.PlaceSheet));
