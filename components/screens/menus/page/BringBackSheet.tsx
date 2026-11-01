import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DateField, Field, PressableScale, Segmented, Switch, useDs, useToast } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space } from '@/constants/tokens';
import { useAskChanges, useTellTeam } from '@/hooks/useListAsks';
import { useBarClock, useListChanges, useListRows, useMayChangeList } from '@/hooks/useLivingList';
import { useMenu, useVenueMenus } from '@/hooks/useMenus';
import { menuStatus, printedPrice } from '@/lib/menus';
import type { RepertoireDrink } from '@/lib/repertoire';
import type { MenuDrink } from '@/types/menus';

import { MenuSheet } from '../MenuSheet';
import { bringBackNote, runWhen } from '../ourDrinks';
import { changeAt, WHENS, ymd, type When } from './LiveChangeSheet';

type View_ = 'main' | 'onto' | 'instead' | 'price';

/**
 * Bring back (2027 canvas, Menu-l-back-sheet, -dark, -and): a drink that
 * left goes on a list that's on again, and a new run starts. Its runs at the
 * bar; when (now, after tonight, on a date); onto which list and section; in
 * place of a drink there or added; its price; Tell the team, on by default.
 * A bartender asks instead (Menu-l-ask).
 */
export function BringBackSheet({ drink: entry, barId, barName, asking, onClose }: { drink: RepertoireDrink<MenuDrink>; barId: string; barName: string; asking: boolean; onClose: () => void }) {
  const ds = useDs();
  const toast = useToast();
  const drink = entry.drink;
  const [now] = useState(() => Date.now());
  const [view, setView] = useState<View_>('main');
  const [when, setWhen] = useState<When>('now');
  const [day, setDay] = useState(() => ymd(new Date(now + 2 * 86_400_000)));
  const [tell, setTell] = useState(true);
  const lists = (useVenueMenus(barId).data ?? []).filter((m) => m.barId === barId && m.kind === 'menu' && menuStatus(m, now) === 'on');
  // Back where it was last, when that list is on; else the bar's first list on now.
  const [ontoId, setOntoId] = useState<string | null>(null);
  const onto = lists.find((m) => m.id === ontoId) ?? lists.find((m) => m.name === entry.dates[0]?.listName) ?? lists[0] ?? null;
  const menu = useMenu(onto?.id).data;
  const fits = menu?.sections.filter((s) => !s.allowedTypes.length || s.allowedTypes.includes(drink.kind)) ?? [];
  const [sectionId, setSectionId] = useState<string | null>(null);
  const section = fits.find((s) => s.id === sectionId) ?? fits[0] ?? null;
  const rows = (useListRows(onto?.id).data ?? []).filter((r) => r.sectionId === section?.id && r.state === 'on');
  const [insteadId, setInsteadId] = useState<string | null>(null);
  const instead = rows.find((r) => r.id === insteadId) ?? null;
  const drinkOf = (itemId: string) => section?.drinks.find((d) => d.id === itemId);
  const [price, setPrice] = useState(printedPrice(drink) ?? '');
  const clock = useBarClock(barId);
  const may = useMayChangeList(asking ? null : onto?.id).data;
  const changes = useListChanges(onto?.id ?? '');
  const asks = useAskChanges(onto?.id ?? '', barId);
  const tellTeam = useTellTeam(onto?.id ?? '', barId);
  const at = changeAt(when, day, now, clock.data);
  const busy = changes.add.isPending || changes.swap.isPending || asks.create.isPending;

  const whenWords = { now: 'today', tonight: 'after tonight', date: `on ${new Date(`${day}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` }[when];
  const cta = `${asking ? 'Ask to bring it back' : 'Bring it back'} ${when === 'now' ? 'now' : whenWords}`;
  const priceSet = price.trim() && price.trim() !== (printedPrice(drink) ?? '') ? price.trim() : null;
  const failed = (e: Error) => toast.show({ title: e.message || 'Couldn’t bring it back. Try again.' });
  const done = (title: string) => () => {
    toast.show({ title: may === false ? `${title}: waiting for approval` : title });
    onClose();
  };

  const confirm = () => {
    if (!onto || !section) return;
    const swapped = instead ? drinkOf(instead.itemId) : null;
    if (asking) {
      asks.create.mutate(
        { itemId: drink.id, offItemId: instead?.itemId ?? null, sectionId: section.id, at, asked: true },
        { onSuccess: done('Asked. It waits for approval.'), onError: failed },
      );
      return;
    }
    const told = () => {
      // Told only when it's on: a change waiting for approval isn't one yet.
      if (tell && may !== false) tellTeam.mutate([instead ? { itemId: instead.itemId, kind: 'swap', toItemId: drink.id, at } : { itemId: drink.id, kind: 'on', at }]);
    };
    const title = `${drink.name} is back${swapped ? ` in place of ${swapped.name}` : ''}`;
    const ok = () => {
      told();
      done(title)();
    };
    if (instead) changes.swap.mutate({ rowId: instead.id, itemId: drink.id, at, price: priceSet }, { onSuccess: ok, onError: failed });
    else changes.add.mutate({ sectionId: section.id, itemId: drink.id, sortOrder: 999, at, price: priceSet }, { onSuccess: ok, onError: failed });
  };

  const choice = (key: string, label: string, sub: string | null, on: boolean, pick: () => void) => (
    <PressableScale key={key} role="radio" aria-checked={on} accessibilityLabel={sub ? `${label}, ${sub}` : label} onPress={pick} style={[styles.choice, { borderTopColor: ds.c.lineStrong }]}>
      <View style={styles.grow}>
        <Body>{label}</Body>
        {sub ? <Caption tone="muted">{sub}</Caption> : null}
      </View>
      <View style={[styles.ring, { borderColor: on ? ds.c.ink : ds.c.muted }]}>{on ? <View style={[styles.dot, { backgroundColor: ds.c.ink }]} /> : null}</View>
    </PressableScale>
  );
  const back = () => setView('main');

  const sub =
    view === 'onto' ? (
      <View role="radiogroup" aria-label="Onto">
        {lists.flatMap((m) =>
          (m.id === onto?.id ? fits : []).map((s) =>
            choice(`${m.id}:${s.id}`, `${m.name} · ${s.name}`, null, s.id === section?.id, () => {
              setSectionId(s.id);
              setInsteadId(null);
              back();
            }),
          ),
        )}
        {lists
          .filter((m) => m.id !== onto?.id)
          .map((m) =>
            choice(m.id, m.name, 'Pick a section next', false, () => {
              setOntoId(m.id);
              setSectionId(null);
              setInsteadId(null);
            }),
          )}
      </View>
    ) : view === 'instead' ? (
      <View role="radiogroup" aria-label="In place of">
        {choice('none', 'Nothing, add it', `At the end of ${section?.name ?? 'the section'}`, !instead, () => {
          setInsteadId(null);
          back();
        })}
        {rows.map((r) =>
          choice(r.id, drinkOf(r.itemId)?.name ?? 'A drink', 'It comes off and keeps its run', r.id === instead?.id, () => {
            setInsteadId(r.id);
            back();
          }),
        )}
      </View>
    ) : view === 'price' ? (
      <Field label="Price" value={price} onChangeText={setPrice} placeholder="No price yet" keyboardType="decimal-pad" autoFocus returnKeyType="done" onSubmitEditing={back} />
    ) : null;

  const rowsGroup: { k: string; v: string; open: View_ }[] = [
    { k: 'Onto', v: onto && section ? `${onto.name} · ${section.name}` : lists.length ? 'Pick a list' : 'No list is on', open: 'onto' },
    { k: 'In place of', v: instead ? (drinkOf(instead.itemId)?.name ?? 'A drink') : 'Nothing, add it', open: 'instead' },
    { k: 'Price', v: price.trim() || 'No price yet', open: 'price' },
  ];

  return (
    <MenuSheet
      visible
      onClose={onClose}
      eyebrow={`Past drink · ${entry.dates.length} ${entry.dates.length === 1 ? 'run' : 'runs'}`}
      title={view === 'onto' ? 'Onto' : view === 'instead' ? 'In place of' : view === 'price' ? 'Price' : `Bring back ${drink.name}`}
      footer={
        view === 'main' ? (
          <View style={styles.footer}>
            <Button label={busy ? 'Saving…' : cta} variant="ink" size="lg" disabled={busy || !onto || !section || (when === 'tonight' && clock.isLoading)} onPress={confirm} style={styles.stretch} />
            <Caption tone="muted" align="center">
              {lists.length ? bringBackNote(entry.dates.length, whenWords, asking) : 'Put a list on first: Bring back adds it to a list that’s on.'}
            </Caption>
          </View>
        ) : (
          <Button label="Done" variant="ink" size="lg" onPress={back} style={styles.stretch} />
        )
      }
    >
      {sub ?? (
        <View style={styles.body}>
          <View>
            <Caption tone="muted" style={styles.label}>{`Its runs${barName ? ` at ${barName}` : ''}`}</Caption>
            {entry.dates.map((r, i) => (
              <View key={i} style={[styles.run, { borderTopColor: ds.c.lineStrong }]}>
                <Body style={[styles.grow, font.figures]}>{runWhen(r, now) ?? 'Dates not known'}</Body>
                <Body tone="muted">{r.listName}</Body>
              </View>
            ))}
            <View style={[styles.close, { borderTopColor: ds.c.lineStrong }]} />
          </View>
          <Segmented options={WHENS} value={when} onChange={setWhen} accessibilityLabel="When" variant="pill" stretch />
          {when === 'date' ? <DateField label="On" value={day} onChange={setDay} min={ymd(new Date(now + 86_400_000))} /> : null}
          <View style={[styles.group, { backgroundColor: ds.c.raised }]}>
            {rowsGroup.map((r, i) => (
              <PressableScale
                key={r.k}
                role="button"
                accessibilityLabel={`${r.k}: ${r.v}`}
                disabled={!onto}
                onPress={() => setView(r.open)}
                style={[styles.groupRow, i ? { borderTopColor: ds.c.lineStrong, borderTopWidth: StyleSheet.hairlineWidth } : null]}
              >
                <Body style={styles.grow}>{r.k}</Body>
                <Body tone="muted" numberOfLines={1} style={styles.value}>
                  {r.v}
                </Body>
                <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
              </PressableScale>
            ))}
            {asking ? null : (
              <View style={[styles.groupRow, { borderTopColor: ds.c.lineStrong, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Body style={styles.grow}>Tell the team</Body>
                <Switch value={tell} onValueChange={setTell} label="Tell the team" />
              </View>
            )}
          </View>
        </View>
      )}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...font.semiBold, paddingBottom: space.xs },
  run: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  close: { borderTopWidth: StyleSheet.hairlineWidth },
  group: { borderRadius: radius.card, overflow: 'hidden' },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 48 },
  value: { flexShrink: 1, maxWidth: '60%' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  ring: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  footer: { gap: space.sm, alignItems: 'center' },
  stretch: { alignSelf: 'stretch' },
});
