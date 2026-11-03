import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DateField, PressableScale, Segmented, Switch, useDs, useToast } from '@/components/ds';
import { font, radius, space } from '@/constants/tokens';
import { useTellTeam } from '@/hooks/useListAsks';
import { useBarClock, useListChanges, useListRows } from '@/hooks/useLivingList';
import { useMenu, useVenueMenus } from '@/hooks/useMenus';
import { menuStatus, printedPrice } from '@/lib/menus';
import type { ListDates, RepertoireDrink } from '@/lib/repertoire';
import type { MenuDrink } from '@/types/menus';

import { MenuSheet } from './MenuSheet';
import { changeAt, WHENS, ymd, type When } from './page/LiveChangeSheet';
import { runRange } from './page/liveList';

export const monthYear = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

/** "Cocktails · 1 Oct to 1 Nov 2026", or "Cocktails · since Mar 2025" while it's on. */
export function runLine(d: ListDates) {
  if (d.isCurrent) return `${d.listName} · since ${d.startsOn ? monthYear(d.startsOn) : 'now'}`;
  if (d.startsOn && d.endsOn) return `${d.listName} · ${runRange(d.startsOn, d.endsOn, true)}`;
  return d.listName;
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const nth = (n: number) => ORDINAL[n - 1] ?? `${n}th`;
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * Bring a past drink back (2027 canvas, Menu-l-back-sheet): its runs here,
 * then when, onto which list and section, in place of a drink there or
 * added, its price, and Tell the team. A new run starts; the old ones stay
 * on its page.
 */
export function BringBackSheet({ entry, barId, barName, onClose }: { entry: RepertoireDrink<MenuDrink>; barId: string; barName: string | null; onClose: () => void }) {
  const ds = useDs();
  const toast = useToast();
  const { drink, dates } = entry;
  const [now] = useState(() => Date.now());
  const lists = (useVenueMenus(barId).data ?? []).filter((m) => m.barId === barId && m.kind === 'menu' && menuStatus(m, now) === 'on');
  // Onto the list it was last on, when that's on now; else the first list that's on.
  const [listId, setListId] = useState<string | null>(null);
  const list = lists.find((m) => m.id === listId) ?? lists.find((m) => m.name === dates[0]?.listName) ?? lists[0] ?? null;
  const menu = useMenu(list?.id).data;
  const sections = menu?.sections.filter((s) => !s.allowedTypes.length || s.allowedTypes.includes(drink.kind)) ?? [];
  const [sectionId, setSectionId] = useState<string | null>(null);
  // A section with drinks in it first: an empty one is often left over from setting the menu up.
  const section = sections.find((s) => s.id === sectionId) ?? sections.find((s) => s.drinks.length) ?? sections[0] ?? null;
  const rows = (useListRows(list?.id).data ?? []).filter((r) => r.sectionId === section?.id && (r.state === 'on' || r.state === 'going'));
  const [replaces, setReplaces] = useState<string | null>(null);
  const out = rows.find((r) => r.id === replaces) ?? null;
  const nameOf = (itemId: string) => section?.drinks.find((d) => d.id === itemId)?.name ?? 'A drink';
  const [when, setWhen] = useState<When>('now');
  const [day, setDay] = useState(() => ymd(new Date(now + 2 * 86_400_000)));
  const [tell, setTell] = useState(true);
  const [picking, setPicking] = useState<'list' | 'replaces' | null>(null);
  const barClock = useBarClock(barId);
  const at = changeAt(when, day, now, barClock.data);
  const changes = useListChanges(list?.id ?? '');
  const tellTeam = useTellTeam(list?.id ?? '', barId);
  const busy = changes.add.isPending || changes.swap.isPending;
  const label = { now: 'now', tonight: 'after tonight', date: `on ${new Date(`${day}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` }[when];
  const runs = dates.length;
  const note = `A ${nth(runs + 1)} run starts ${when === 'now' ? 'today' : label}. ${runs === 1 ? 'The first stays' : `The first ${WORDS[runs - 1] ?? runs} stay`} on its page.`;

  const done = () => {
    if (tell) tellTeam.mutate([out ? { itemId: out.itemId, kind: 'swap', toItemId: drink.id, at } : { itemId: drink.id, kind: 'on', at }]);
    toast.show({ title: out ? `${drink.name} on, ${nameOf(out.itemId)} off ${label}` : `${drink.name} back ${label}` });
    onClose();
  };
  const failed = (e: Error) => toast.show({ title: e.message || 'Couldn’t bring it back. Try again.', tone: 'error' });
  const confirm = () => {
    if (!section) return;
    if (out) changes.swap.mutate({ rowId: out.id, itemId: drink.id, at }, { onSuccess: done, onError: failed });
    else changes.add.mutate({ sectionId: section.id, itemId: drink.id, sortOrder: 999, at }, { onSuccess: done, onError: failed });
  };

  const onto = (l: string, s: string | null) => () => (setListId(l), setSectionId(s), setReplaces(null));
  // Onto: the chosen list's sections, and the other lists on now (picking one shows its sections).
  const options =
    picking === 'list'
      ? lists.flatMap((l) =>
          l.id === list?.id ? sections.map((s) => ({ key: `${l.id}:${s.id}`, label: `${l.name} · ${s.name}`, on: s.id === section?.id, pick: onto(l.id, s.id) })) : [{ key: l.id, label: `${l.name} ›`, on: false, pick: onto(l.id, null) }]
        )
      : picking === 'replaces'
        ? [{ key: 'none', label: 'Nothing, add it', on: !out, pick: () => setReplaces(null) }, ...rows.map((r) => ({ key: r.id, label: nameOf(r.itemId), on: r.id === out?.id, pick: () => setReplaces(r.id) }))]
        : [];

  return (
    <MenuSheet
      visible
      onClose={onClose}
      eyebrow={`Past drink · ${runs} ${runs === 1 ? 'run' : 'runs'}`}
      title={`Bring back ${drink.name}`}
      footer={
        <View style={styles.footer}>
          <Button label={busy ? 'Saving…' : `Bring it back ${label}`} variant="ink" size="lg" disabled={busy || !section || (when === 'tonight' && barClock.isLoading)} onPress={confirm} style={styles.stretch} />
          <Caption tone="muted" align="center">
            {section ? note : 'Nothing is on now to bring it back onto. Put a menu on first.'}
          </Caption>
        </View>
      }
    >
      <View style={styles.body}>
        <View>
          <Caption tone="muted" style={[font.semiBold, styles.runsHead]}>
            {`Its runs at ${barName ?? 'the bar'}`}
          </Caption>
          {dates.map((d) => {
            const [name, range] = runLine(d).split(' · ');
            return (
              <View key={`${d.listName}-${d.startsOn}`} style={[styles.run, { borderTopColor: ds.c.line }]}>
                <Body style={styles.mono}>{range ?? ''}</Body>
                <Body tone="muted">{name}</Body>
              </View>
            );
          })}
        </View>
        <Segmented options={WHENS} value={when} onChange={setWhen} accessibilityLabel="When" variant="pill" stretch />
        {when === 'date' ? <DateField label="On" value={day} onChange={setDay} min={ymd(new Date(now + 86_400_000))} /> : null}
        <View style={[styles.group, { backgroundColor: ds.c.raised }]}>
          <Line label="Onto" value={list && section ? `${list.name} · ${section.name}` : 'No list on now'} open={picking === 'list'} onPress={lists.length ? () => setPicking((p) => (p === 'list' ? null : 'list')) : undefined} />
          <Line label="In place of" value={out ? nameOf(out.itemId) : 'Nothing, add it'} open={picking === 'replaces'} onPress={rows.length ? () => setPicking((p) => (p === 'replaces' ? null : 'replaces')) : undefined} />
          {options.length ? (
            <View role="radiogroup" aria-label={picking === 'list' ? 'Onto' : 'In place of'}>
              {options.map((o) => (
                <PressableScale key={o.key} role="radio" aria-checked={o.on} onPress={() => (o.pick(), setPicking(null))} style={[styles.line, { borderTopColor: ds.c.line }]}>
                  <Body style={styles.grow}>{o.label}</Body>
                  {o.on ? <Body>✓</Body> : null}
                </PressableScale>
              ))}
            </View>
          ) : null}
          <Line label="Price" value={printedPrice(drink) ?? 'No price yet'} />
          <View style={[styles.line, { borderTopColor: ds.c.line }]}>
            <Body style={styles.grow}>Tell the team</Body>
            <Switch value={tell} onValueChange={setTell} label="Tell the team" />
          </View>
        </View>
      </View>
    </MenuSheet>
  );
}

function Line({ label, value, open, onPress }: { label: string; value: string; open?: boolean; onPress?: () => void }) {
  const ds = useDs();
  const body = (
    <>
      <Body style={styles.grow}>{label}</Body>
      <Body tone="muted">{`${value}${onPress ? (open ? ' ⌄' : ' ›') : ''}`}</Body>
    </>
  );
  return onPress ? (
    <PressableScale role="button" aria-expanded={open} accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={[styles.line, { borderTopColor: ds.c.line }]}>
      {body}
    </PressableScale>
  ) : (
    <View style={[styles.line, { borderTopColor: ds.c.line }]}>{body}</View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  runsHead: { paddingBottom: space.xs },
  run: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  mono: { fontVariant: ['tabular-nums'] },
  group: { borderRadius: radius.card, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1 },
  footer: { gap: space.sm, alignItems: 'center' },
  stretch: { alignSelf: 'stretch' },
});
