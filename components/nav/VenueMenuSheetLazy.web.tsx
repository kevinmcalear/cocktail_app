import { lazy, Suspense, useEffect, type ComponentType } from 'react';

type Props = { onClose: () => void };

/** A failed load (offline, or an old chunk after a deploy) closes again, and the next tap retries. */
function Closes({ onClose }: Props) {
  useEffect(onClose, [onClose]);
  return null;
}

const load = () =>
  lazy((): Promise<{ default: ComponentType<Props> }> =>
    import('./VenueMenuSheet').then(
      (m) => ({ default: m.VenueMenuSheet }),
      () => {
        Lazy = load();
        return { default: Closes };
      },
    ),
  );
let Lazy = load();

/**
 * On the web, the venue menu (the team card, the places list and the hooks
 * behind them) loads when the switcher is first tapped, not with every page
 * that has a header.
 */
export function VenueMenuSheet(props: Props) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
