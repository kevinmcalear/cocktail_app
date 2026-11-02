import { useState } from 'react';

import { useToast } from '@/components/ds';
import { useListChanges, useMayChangeList, type EndedRun, type ListRow } from '@/hooks/useLivingList';
import { useMenuLibrary } from '@/hooks/useMenuMutations';
import type { MenuDetail, MenuDrink } from '@/types/menus';

import { AddDrinkSheet } from '../AddDrinkSheet';
import { LiveChangeSheet } from './LiveChangeSheet';
import type { ActKind } from './liveList';
import type { PageRowView } from './MenuPageRow';

/** A Swap or Take off being set up in its sheet. */
export interface ChangeTarget {
  kind: 'swap' | 'takeOff';
  view: PageRowView;
  sectionId: string;
}

/**
 * The acts on a living list's rows that need no sheet (decision page, swap
 * and approval-states; Menu-l-approve, Menu-l-swapped): Approve, Turn down
 * or Withdraw a change waiting, take back a swap done today, keep a drink
 * planned to come off. A change by someone who may not change the list waits
 * for approval; the database decides.
 */
export function useRowActs(menuId: string, rows: ListRow[]) {
  const toast = useToast();
  const changes = useListChanges(menuId);
  const may = useMayChangeList(menuId).data;
  // Each write is sent through `attempt`, so a refused one can be sent again with the same values.
  type Opts = { onSuccess: () => void; onError: (e: Error) => void };
  const attempt = (send: (o: Opts) => void, onSuccess: () => void) => {
    const go = () => send({ onSuccess, onError: (e) => toast.show({ title: e.message || 'Couldn’t change the list.', tone: 'error', action: { label: 'Try again', onPress: go } }) });
    go();
  };
  const said = (title: string) => () => toast.show({ title: may === false ? `${title}: waiting for approval` : title });
  return {
    may,
    busy: changes.swap.isPending || changes.takeOff.isPending,
    act(kind: ActKind, view: PageRowView, sectionId: string) {
      const row = view.listRow;
      const name = view.drink.name;
      if (kind === 'undo' && !row) {
        // Taken off today with nothing in its place: it goes back on, at the end of its section.
        attempt((o) => changes.add.mutate({ sectionId, itemId: view.drink.id, sortOrder: 999 }, o), said(`${name} is back`));
        return;
      }
      if (!row) return;
      if (kind === 'approve') attempt((o) => changes.approve.mutate(row.id, o), said(`${name} approved`));
      if (kind === 'turnDown') attempt((o) => changes.turnDown.mutate({ rowId: row.id, waiting: row.state === 'waiting_on' ? 'on' : 'off' }, o), said(`${name} turned down`));
      if (kind === 'undo') attempt((o) => changes.undoSwap.mutate({ swappedIn: row, replaced: null }, o), said(`${name} is back`));
      if (kind === 'keep') {
        // Taking back a planned swap keeps the drink it was swapping out, too.
        const out = row.state === 'coming' && row.replacesItemId ? rows.find((r) => r.itemId === row.replacesItemId && r.sectionId === row.sectionId && r.state === 'going') : undefined;
        if (out) attempt((o) => changes.undoSwap.mutate({ swappedIn: row, replaced: out }, o), said('Swap taken back'));
        else attempt((o) => changes.turnDown.mutate({ rowId: row.id, waiting: row.state === 'coming' ? 'on' : 'off' }, o), said(`${name} kept as it was`));
      }
    },
    confirm(target: ChangeTarget, to: MenuDrink | null, at: string | null, done: () => void) {
      const row = target.view.listRow;
      if (!row) return;
      const when = at ? 'from ' + new Date(at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'now';
      const name = target.view.drink.name;
      const ok = (title: string) => () => {
        said(title)();
        done();
      };
      if (target.kind === 'swap' && to) attempt((o) => changes.swap.mutate({ rowId: row.id, itemId: to.id, at }, o), ok(`${to.name} on, ${name} off ${when}`));
      if (target.kind === 'takeOff') attempt((o) => changes.takeOff.mutate({ rowId: row.id, at }, o), ok(`${name} off ${when}`));
    },
  };
}

/** The Swap or Take off sheet for one row, with Find a drink opening the whole picker. */
export function RowChanges({ menu, target, ended, acts, onClose }: { menu: MenuDetail; target: ChangeTarget; ended: EndedRun[]; acts: ReturnType<typeof useRowActs>; onClose: () => void }) {
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<MenuDrink | null>(null);
  const library = useMenuLibrary(menu.barId, finding).data ?? [];
  const section = menu.sections.find((s) => s.id === target.sectionId);
  if (!section) return null;
  const row = target.view.listRow;
  const wentOn = row?.onFrom ?? menu.startsAt ?? ended.find((e) => e.itemId === target.view.drink.id)?.wentOn ?? null;

  if (finding) {
    return (
      <AddDrinkSheet
        title={`Swap ${target.view.drink.name} for`}
        section={{ key: section.id, id: section.id, name: section.name, minItems: section.minItems, maxItems: section.maxItems, allowedTypes: section.allowedTypes, drinks: section.drinks }}
        barId={menu.barId}
        onClose={() => setFinding(false)}
        library={library}
        canMake={[]}
        elsewhere={{}}
        onAdd={(d) => {
          setFound(d);
          setFinding(false);
        }}
      />
    );
  }
  return (
    <LiveChangeSheet
      key={found?.id ?? 'none'}
      kind={target.kind}
      drink={target.view.drink}
      where={`${menu.name} · ${section.name}`}
      barId={menu.barId}
      wentOn={wentOn}
      found={found}
      onFind={() => setFinding(true)}
      busy={acts.busy}
      onConfirm={(to, at) => acts.confirm(target, to, at, onClose)}
      onClose={onClose}
    />
  );
}
