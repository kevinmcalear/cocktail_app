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

const short = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

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
  const failed = (e: Error) => toast.show({ title: e.message || 'Couldn’t change the list. Try again.' });
  const said = (title: string) => () => toast.show({ title: may === false ? `${title}: waiting for approval` : title });
  return {
    may,
    busy: changes.swap.isPending || changes.takeOff.isPending,
    act(kind: ActKind, view: PageRowView) {
      const row = view.listRow;
      if (!row) return;
      const name = view.drink.name;
      if (kind === 'approve') changes.approve.mutate(row.id, { onSuccess: said(`${name} approved`), onError: failed });
      if (kind === 'turnDown') changes.turnDown.mutate({ rowId: row.id, waiting: row.state === 'waiting_on' ? 'on' : 'off' }, { onSuccess: said(`${name} turned down`), onError: failed });
      if (kind === 'undo') changes.undoSwap.mutate({ swappedIn: row, replaced: null }, { onSuccess: said(`${name} is back`), onError: failed });
      if (kind === 'keep') {
        // Taking back a planned swap keeps the drink it was swapping out, too.
        const out = row.state === 'coming' && row.replacesItemId ? rows.find((r) => r.itemId === row.replacesItemId && r.sectionId === row.sectionId && r.state === 'going') : undefined;
        if (out) changes.undoSwap.mutate({ swappedIn: row, replaced: out }, { onSuccess: said('Swap taken back'), onError: failed });
        else changes.turnDown.mutate({ rowId: row.id, waiting: row.state === 'coming' ? 'on' : 'off' }, { onSuccess: said(`${name} kept as it was`), onError: failed });
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
      if (target.kind === 'swap' && to) changes.swap.mutate({ rowId: row.id, itemId: to.id, at }, { onSuccess: ok(`${to.name} on, ${name} off ${when}`), onError: failed });
      if (target.kind === 'takeOff') changes.takeOff.mutate({ rowId: row.id, at }, { onSuccess: ok(`${name} off ${when}`), onError: failed });
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
  const run = wentOn ? `from ${short(wentOn)}` : '';

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
      run={run}
      found={found}
      onFind={() => setFinding(true)}
      busy={acts.busy}
      onConfirm={(to, at) => acts.confirm(target, to, at, onClose)}
      onClose={onClose}
    />
  );
}
