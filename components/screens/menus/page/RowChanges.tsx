import { useState } from 'react';

import { useToast } from '@/components/ds';
import { useListChanges, useMayChangeList, type ListRow } from '@/hooks/useLivingList';
import { useMenuLibrary } from '@/hooks/useMenuMutations';
import type { MenuDetail, MenuDrink } from '@/types/menus';

import { AddDrinkSheet } from '../AddDrinkSheet';
import { RowMenu, type Anchor, type RowMenuItem } from '../RowMenu';

/** The row being changed: its drink, its place on the list and where its button is. */
export interface RowTarget {
  drink: MenuDrink;
  sectionId: string;
  row: ListRow | undefined;
  anchor: Anchor;
}

/** The start of tomorrow, local time: "from the next service". */
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

type Step = { kind: 'menu' } | { kind: 'pick' } | { kind: 'when'; swapTo: MenuDrink | null };

/**
 * Changing one drink on a list that's on (decision page, swap: on the row,
 * dated): Swap it for another, or Take it off, now or from tomorrow. A change
 * by someone who may not change this list waits for approval (the database
 * decides); someone who may approves or turns it down here.
 */
export function RowChanges({ menu, rows, target, onClose }: { menu: MenuDetail; rows: ListRow[]; target: RowTarget; onClose: () => void }) {
  const toast = useToast();
  const changes = useListChanges(menu.id);
  // Unknown until it loads: nothing is said about approval, and approving waits.
  const may = useMayChangeList(menu.id).data;
  const [step, setStep] = useState<Step>({ kind: 'menu' });
  const library = useMenuLibrary(menu.barId, step.kind === 'pick').data ?? [];
  const { drink, row } = target;
  const section = menu.sections.find((s) => s.id === target.sectionId);
  const done = (title: string) => {
    toast.show({ title: may === false ? `${title}: waiting for approval` : title });
    onClose();
  };
  const failed = (e: Error) => toast.show({ title: e.message || 'Couldn’t change the list. Try again.' });

  if (!row || !section) return null;

  if (step.kind === 'pick') {
    return (
      <AddDrinkSheet
        title={`Swap ${drink.name} for`}
        section={{ key: section.id, id: section.id, name: section.name, minItems: section.minItems, maxItems: section.maxItems, allowedTypes: section.allowedTypes, drinks: section.drinks }}
        barId={menu.barId}
        onClose={onClose}
        library={library}
        canMake={[]}
        elsewhere={{}}
        onAdd={(to) => setStep({ kind: 'when', swapTo: to })}
      />
    );
  }

  const at = (when: string | null) => {
    if (step.kind !== 'when') return;
    const label = when ? 'from tomorrow' : 'now';
    if (step.swapTo) {
      const to = step.swapTo;
      changes.swap.mutate({ rowId: row.id, itemId: to.id, at: when }, { onSuccess: () => done(`${to.name} on, ${drink.name} off ${label}`), onError: failed });
    } else {
      changes.takeOff.mutate({ rowId: row.id, at: when }, { onSuccess: () => done(`${drink.name} off ${label}`), onError: failed });
    }
  };

  const items: RowMenuItem[] =
    step.kind === 'when'
      ? [
          { label: 'Now', icon: 'clock', onPress: () => at(null) },
          { label: 'From tomorrow', icon: 'calendar', onPress: () => at(tomorrow()) },
        ]
      : row.state === 'waiting_on' || row.state === 'waiting_off'
        ? may === true
          ? [
              { label: 'Approve', icon: 'checkmark', onPress: () => changes.approve.mutate(row.id, { onSuccess: () => done(`${drink.name} approved`), onError: failed }) },
              {
                label: 'Turn down',
                icon: 'xmark',
                danger: true,
                onPress: () => changes.turnDown.mutate({ rowId: row.id, waiting: row.state === 'waiting_on' ? 'on' : 'off' }, { onSuccess: () => done(`${drink.name} turned down`), onError: failed }),
              },
            ]
          : []
        : row.state === 'coming' || row.state === 'going'
          ? [
              {
                label: row.state === 'coming' ? 'Don’t put it on' : 'Keep it on',
                icon: 'arrow.uturn.backward',
                onPress: () => {
                  // Taking back a planned swap keeps the drink it was swapping out, too.
                  const out = row.state === 'coming' && row.replacesItemId ? rows.find((r) => r.itemId === row.replacesItemId && r.sectionId === row.sectionId && r.state === 'going') : undefined;
                  changes.turnDown.mutate(
                    { rowId: row.id, waiting: row.state === 'coming' ? 'on' : 'off' },
                    {
                      onSuccess: () => (out ? changes.turnDown.mutate({ rowId: out.id, waiting: 'off' }, { onSuccess: () => done('Swap taken back'), onError: failed }) : done(`${drink.name} kept as it was`)),
                      onError: failed,
                    }
                  );
                },
              },
            ]
          : [
              { label: 'Swap…', icon: 'arrow.left.and.right', more: true, onPress: () => setStep({ kind: 'pick' }) },
              { label: 'Take off…', icon: 'minus', more: true, onPress: () => setStep({ kind: 'when', swapTo: null }) },
            ];

  const title = step.kind === 'when' ? (step.swapTo ? `Swap in ${step.swapTo.name}` : `Take off ${drink.name}`) : drink.name;
  return <RowMenu anchor={target.anchor} label={title} items={items} onClose={onClose} />;
}
