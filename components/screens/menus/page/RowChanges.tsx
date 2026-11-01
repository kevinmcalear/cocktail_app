import { useState } from 'react';

import { useToast } from '@/components/ds';
import { useAskChanges, useSetOffTonight, useTellTeam, type Tell } from '@/hooks/useListAsks';
import { useBarClock, useListChanges, useMayChangeList, type EndedRun, type ListRow } from '@/hooks/useLivingList';
import { useMenuLibrary } from '@/hooks/useMenuMutations';
import { afterTonight } from '@/lib/barHours';
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
 * and approval-states; Menu-l-approve, Menu-l-ask, Menu-l-swapped):
 * Approve, Turn down or Withdraw a change waiting, Ask to put a draft on,
 * take back a swap done today, keep a drink planned to come off, Off tonight
 * and Back on. A bartender's changes are asks; a change by someone else who
 * may not change the list waits for approval; the database decides.
 */
export function useRowActs(menu: { id: string; barId: string | null }, rows: ListRow[], bartender: boolean) {
  const menuId = menu.id;
  const toast = useToast();
  const changes = useListChanges(menuId);
  const asks = useAskChanges(menuId, menu.barId);
  const tellTeam = useTellTeam(menuId, menu.barId);
  const offTonight = useSetOffTonight(menu.barId ?? '');
  const clock = useBarClock(menu.barId).data;
  const may = useMayChangeList(menuId).data;
  // A bartender asks, unless the list is theirs to change (the daily list while they're on shift).
  const asking = bartender && may !== true;
  const failed = (e: Error) => toast.show({ title: e.message || 'Couldn’t change the list. Try again.' });
  const said = (title: string) => () => toast.show({ title: may === false ? `${title}: waiting for approval` : title });
  const tell = (changes: Tell[]) => tellTeam.mutate(changes);
  return {
    may: asking ? false : may,
    bartender: asking,
    busy: changes.swap.isPending || changes.takeOff.isPending || asks.create.isPending,
    act(kind: ActKind, view: PageRowView, sectionId: string) {
      const row = view.listRow;
      const name = view.drink.name;
      const ask = view.ask;
      if (ask) {
        if (kind === 'ask') asks.ask.mutate(ask.id, { onSuccess: () => toast.show({ title: `Asked to put ${name} on` }), onError: failed });
        if (kind === 'withdraw') asks.drop.mutate(ask.id, { onSuccess: () => toast.show({ title: 'Withdrawn' }), onError: failed });
        if (kind === 'turnDown') asks.drop.mutate(ask.id, { onSuccess: () => toast.show({ title: `${name} turned down` }), onError: failed });
        if (kind === 'approve') asks.approve.mutate({ ask, rows, sectionId: ask.sectionId ?? row?.sectionId ?? null }, { onSuccess: said(`${name} approved`), onError: failed });
        return;
      }
      if (kind === 'offTonight') {
        if (!menu.barId) return;
        offTonight.set(menuId, view.drink.id, afterTonight(clock?.hours, new Date(), clock?.timezone).toISOString());
        tell([{ itemId: view.drink.id, kind: 'off_tonight' }]);
        toast.show({ title: `${name} off tonight` });
        return;
      }
      if (kind === 'backOn' && view.offTonight) {
        offTonight.clear(view.offTonight);
        tell([{ itemId: view.drink.id, kind: 'back' }]);
        toast.show({ title: `${name} back on` });
        return;
      }
      if (kind === 'undo' && !row) {
        // Taken off today with nothing in its place: it goes back on, at the end of its section.
        changes.add.mutate({ sectionId, itemId: view.drink.id, sortOrder: 999 }, { onSuccess: said(`${name} is back`), onError: failed });
        return;
      }
      if (!row) return;
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
    /** The sheet's change: straight on (and told to the team when the switch is on), or a bartender's ask (a draft when `draft`). */
    confirm(target: ChangeTarget, to: MenuDrink | null, at: string | null, opts: { tell: boolean; draft: boolean }, done: () => void) {
      const row = target.view.listRow;
      if (!row) return;
      const when = at ? 'from ' + new Date(at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'now';
      const name = target.view.drink.name;
      const ok = (title: string, told: Tell | null) => () => {
        // Told only when it's on: a change waiting for approval isn't one yet.
        if (told && opts.tell && may !== false) tell([told]);
        said(title)();
        done();
      };
      if (asking) {
        const fine = () => {
          toast.show({ title: opts.draft ? 'Kept as a draft. Only you see it.' : 'Asked. It waits for approval.' });
          done();
        };
        if (target.kind === 'swap' && !to) return;
        asks.create.mutate({ itemId: to?.id ?? null, offItemId: row.itemId, sectionId: row.sectionId, at, asked: !opts.draft }, { onSuccess: fine, onError: failed });
        return;
      }
      if (target.kind === 'swap' && to)
        changes.swap.mutate({ rowId: row.id, itemId: to.id, at }, { onSuccess: ok(`${to.name} on, ${name} off ${when}`, { itemId: row.itemId, kind: 'swap', toItemId: to.id, at }), onError: failed });
      if (target.kind === 'takeOff') changes.takeOff.mutate({ rowId: row.id, at }, { onSuccess: ok(`${name} off ${when}`, { itemId: row.itemId, kind: 'off', at }), onError: failed });
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
      asking={acts.bartender}
      onConfirm={(to, at, opts) => acts.confirm(target, to, at, opts, onClose)}
      onClose={onClose}
    />
  );
}
