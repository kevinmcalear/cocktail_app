import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DateField, Headline, PressableScale, Segmented, Switch, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, radius, space } from '@/constants/tokens';
import { useBarClock } from '@/hooks/useLivingList';
import { useRepertoire } from '@/hooks/useRepertoire';
import { afterTonight, type BarClock } from '@/lib/barHours';
import { printedPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { MenuSheet } from '../MenuSheet';
import { runRange } from './liveList';
import { MenuDrawing } from './MenuDrawing';
import { dayMonth } from '@/lib/dayMonth';

type When = 'now' | 'tonight' | 'date';
const WHENS = [
  { value: 'now', label: 'Now' },
  { value: 'tonight', label: 'After tonight' },
  { value: 'date', label: 'On a date' },
] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** When the change lands: null now; once the bar closes tonight; or the start of a picked day. */
function changeAt(when: When, day: string, now: number, clock: BarClock | null | undefined): string | null {
  if (when === 'now') return null;
  return (when === 'tonight' ? afterTonight(clock?.hours, new Date(now), clock?.timezone) : new Date(`${day}T00:00`)).toISOString();
}

interface LiveChangeSheetProps {
  /** swap: pick what goes on in its place. takeOff: it just comes off. */
  kind: 'swap' | 'takeOff';
  drink: MenuDrink;
  /** "Cocktails · Shaken". */
  where: string;
  barId: string | null;
  /** When its run began: it keeps the run to the day it comes off. */
  wentOn: string | null;
  /** Opens the full drink picker (Find a drink). */
  onFind: () => void;
  /** A drink picked with Find a drink, offered first. */
  found?: MenuDrink | null;
  busy: boolean;
  /** A bartender's sheet: the change is an ask (or a draft only they see), and the menu team tell the team when they approve. */
  asking?: boolean;
  onConfirm: (to: MenuDrink | null, at: string | null, opts: { tell: boolean; draft: boolean }) => void;
  onClose: () => void;
}

/**
 * One change to a list that's on (Menu-l-swap-sheet): what comes off keeps
 * its run; for a swap, what goes on instead (drinks that were on before
 * first, then Find a drink); when, now, after tonight or on a date; and Tell
 * the team, on by default. A bartender asks instead (Menu-l-ask).
 */
export function LiveChangeSheet({ kind, drink, where, barId, wentOn, onFind, found, busy, asking = false, onConfirm, onClose }: LiveChangeSheetProps) {
  const ds = useDs();
  const [now] = useState(() => Date.now());
  const [when, setWhen] = useState<When>('now');
  const [day, setDay] = useState(() => ymd(new Date(now + 2 * 86_400_000)));
  const [tell, setTell] = useState(true);
  const past = useRepertoire(kind === 'swap' ? barId : null).past;
  const barClock = useBarClock(barId);
  const clock = barClock.data;
  const at = changeAt(when, day, now, clock);
  const offers = [...(found ? [found] : []), ...past.map((p) => p.drink).filter((d) => d.id !== found?.id && d.id !== drink.id)].slice(0, 3);
  const [picked, setPicked] = useState<string | null>(found?.id ?? null);
  const to = offers.find((d) => d.id === (picked ?? found?.id)) ?? null;
  const label = { now: 'now', tonight: 'after tonight', date: `on ${dayMonth(new Date(`${day}T00:00`), { month: 'short' })}` }[when];
  const cta = `${asking ? 'Ask to ' : ''}${kind === 'swap' ? (asking ? 'swap' : 'Swap') : asking ? 'take off' : 'Take off'} ${label}`;
  const price = to ? printedPrice(to) : null;
  const note =
    kind === 'swap' && !to
      ? 'Pick what goes on instead.'
      : asking
        ? `It waits for approval, and ${drink.name} stays on until then.`
        : kind === 'swap'
          ? `${to!.name} goes in its place${price ? ` at ${price}` : ''}. Undo from the list today.`
          : 'Undo from the list today.';
  const confirm = (draft: boolean) => onConfirm(kind === 'swap' ? to : null, at, { tell: tell && !asking, draft });
  const blocked = busy || (kind === 'swap' && !to) || (when === 'tonight' && barClock.isLoading);
  const pastOf = (id: string) => past.find((p) => p.drink.id === id);
  const run = wentOn ? `: ${runRange(wentOn, at ?? new Date(now).toISOString(), true)}` : '';

  return (
    <MenuSheet
      visible
      onClose={onClose}
      eyebrow={where}
      title={kind === 'swap' ? `Swap ${drink.name}` : `Take off ${drink.name}`}
      footer={
        <View style={styles.footer}>
          <Button label={busy ? 'Saving…' : cta} variant="ink" size="lg" disabled={blocked} onPress={() => confirm(false)} style={styles.stretch} />
          {asking ? <Button label="Keep as a draft" variant="ghost" disabled={blocked} onPress={() => confirm(true)} style={styles.stretch} /> : null}
          <Caption tone="muted" align="center">
            {note}
          </Caption>
        </View>
      }
    >
      <View style={styles.body}>
        <View style={[styles.notice, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="clock" size={18} color={ds.c.ink} />
          <Body style={styles.grow}>{`${drink.name} comes off and keeps its run${run}.`}</Body>
        </View>
        {kind === 'swap' ? (
          <View role="radiogroup" aria-label="Put on instead">
            <Caption tone="muted" style={styles.label}>
              Put on instead
            </Caption>
            {offers.map((d) => {
              const on = d.id === to?.id;
              const before = pastOf(d.id);
              const last = before?.dates[0];
              const lastOn = last?.startsOn && last.endsOn ? runRange(last.startsOn, last.endsOn) : (last?.listName ?? 'the list');
              const meta = [before ? `Past · last on ${lastOn}` : 'Not on a list yet', printedPrice(d) ?? 'no price yet'].join(' · ');
              return (
                <PressableScale key={d.id} role="radio" aria-checked={on} accessibilityLabel={d.name} onPress={() => setPicked(d.id)} style={[styles.pick, { borderTopColor: ds.c.lineStrong }]}>
                  <MenuDrawing itemId={d.id} size="row" ink="colour" fallback={{ imageUrl: d.imageUrl, glass: d.glass }} />
                  <View style={styles.grow}>
                    <Headline style={{ fontFamily: displayFaces[ds.displayFace].regular }}>{d.name}</Headline>
                    <Caption tone="muted">{meta}</Caption>
                  </View>
                  <View style={[styles.ring, { borderColor: on ? ds.c.ink : ds.c.muted }]}>{on ? <View style={[styles.dot, { backgroundColor: ds.c.ink }]} /> : null}</View>
                </PressableScale>
              );
            })}
            <PressableScale role="button" accessibilityLabel="Find a drink" onPress={onFind} style={[styles.pick, { borderTopColor: ds.c.lineStrong, borderBottomColor: ds.c.lineStrong, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.search, { backgroundColor: ds.c.raised }]}>
                <IconSymbol name="magnifyingglass" size={18} color={ds.c.ink} />
              </View>
              <View style={styles.grow}>
                <Headline style={{ fontFamily: displayFaces[ds.displayFace].regular }}>Find a drink</Headline>
                <Caption tone="muted">Any drink, ours or a classic</Caption>
              </View>
            </PressableScale>
          </View>
        ) : null}
        <Segmented options={WHENS} value={when} onChange={setWhen} accessibilityLabel="When" variant="pill" stretch />
        {when === 'date' ? <DateField label="On" value={day} onChange={setDay} min={ymd(new Date(now + 86_400_000))} /> : null}
        {asking ? null : (
          <View style={[styles.tell, { backgroundColor: ds.c.raised }]}>
            <Body style={styles.grow}>Tell the team</Body>
            <Switch value={tell} onValueChange={setTell} label="Tell the team" />
          </View>
        )}
      </View>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.control, alignItems: 'flex-start' },
  grow: { flex: 1, gap: 2 },
  label: { ...font.semiBold, paddingBottom: space.xs },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  ring: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  search: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: space.sm, alignItems: 'center' },
  tell: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.card },
  stretch: { alignSelf: 'stretch' },
});
