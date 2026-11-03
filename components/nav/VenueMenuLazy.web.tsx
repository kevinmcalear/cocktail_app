import { lazy, Suspense, useEffect, type ComponentProps, type ComponentType } from 'react';

type Props = ComponentProps<typeof import('./VenueMenu').VenueMenu>;

/** A failed load (offline, or an old chunk after a deploy) closes again, and the next tap retries. */
function Closes({ onClose }: Props) {
  useEffect(onClose, [onClose]);
  return null;
}

const load = () =>
  lazy((): Promise<{ default: ComponentType<Props> }> =>
    import('./VenueMenu').then(
      (m) => ({ default: m.VenueMenu }),
      () => {
        Lazy = load();
        return { default: Closes };
      },
    ),
  );
let Lazy = load();

/** On the web, the places menu (and the hooks behind it) loads when a switcher is first tapped, not with every page that has a header. */
export function VenueMenu(props: Props) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
