import { lazy, Suspense, useEffect, type ComponentType } from 'react';

type Props = { visible: boolean; onClose: () => void; onBack?: () => void };

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
 * On the web, the New sheet (its drafts, icons and hooks) loads when Add is
 * first tapped. Every page with a header has Add, and each route chunk kept
 * its own copy of the sheet.
 */
export function CreateSheet(props: Props) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
