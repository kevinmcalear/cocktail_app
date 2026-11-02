import { lazy, Suspense, useEffect, type ComponentType } from 'react';

type Props = { visible: boolean; onClose: () => void };

/** A failed load (offline, or an old chunk after a deploy) closes again, and the next tap retries. */
function Closes({ onClose }: Props) {
  useEffect(onClose, [onClose]);
  return null;
}

const load = () =>
  lazy((): Promise<{ default: ComponentType<Props> }> =>
    import('./CreateSheet').then(
      (m) => ({ default: m.CreateSheet }),
      () => {
        Lazy = load();
        return { default: Closes };
      },
    ),
  );
let Lazy = load();

/**
 * On the web, the New sheet (drafts, the drink desk's hooks, the kind icons)
 * loads when Add is first tapped. Imported with the header, every page with
 * one carried its own copy (quality budget B12).
 */
export function CreateSheet(props: Props) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
