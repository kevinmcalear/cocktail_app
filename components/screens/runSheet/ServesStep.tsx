import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, DsText, Headline, PressableScale, Segmented, Spec, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useSetDrinkParty, useSetServes, useSetVenue, type RunSheetData } from '@/hooks/useRunSheet';
import { MAX_SERVES } from '@/lib/batch';
import { clampServes, type RunDrink, type RunParty } from '@/lib/runSheet';
import { nightLine } from '@/lib/runSheetText';

import { GuestCredit, GuestPageNote, WhoseTag } from './GuestCredit';
import { usePartyLooks } from './parts';
import { PartySheet } from './PartySheet';

/** A serves box: type a number (1 to 6,969) or step it with − and +. */
function ServesInput({ label, value, onCommit, wide }: { label: string; value: number | null; onCommit: (n: number | null) => void; wide?: boolean }) {
  const ds = useDs();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ? String(value) : '');
  const commit = () => {
    if (draft === null) return;
    const n = clampServes(draft);
    setDraft(null);
    if (n !== value) onCommit(n);
  };
  return (
    <TextInput
      aria-label={label}
      value={shown}
      placeholder="0"
      placeholderTextColor={ds.c.faint}
      inputMode="numeric"
      keyboardType="number-pad"
      maxLength={4}
      selectTextOnFocus
      onChangeText={(t) => setDraft(t.replace(/\D/g, ''))}
      onBlur={commit}
      onSubmitEditing={commit}
      style={[styles.input, { width: wide ? 72 : 64, color: ds.c.ink, borderColor: ds.c.lineStrong, backgroundColor: ds.c.ground }]}
    />
  );
}

function Stepper({ drink, onSet }: { drink: RunDrink; onSet: (n: number | null) => void }) {
  const n = drink.serves ?? 0;
  const step = (by: number) => onSet(clampServes(n + by));
  return (
    <View style={styles.stepper}>
      <PressableScale accessibilityLabel={`One fewer ${drink.name}`} role="button" onPress={() => step(-1)} disabled={n <= 1} style={styles.stepButton}>
        <DsText variant="headline" tone="muted">−</DsText>
      </PressableScale>
      <ServesInput label={`${drink.name} serves`} value={drink.serves} onCommit={onSet} />
      <PressableScale accessibilityLabel={`One more ${drink.name}`} role="button" onPress={() => step(1)} disabled={n >= MAX_SERVES} style={styles.stepButton}>
        <DsText variant="headline" tone="muted">+</DsText>
      </PressableScale>
    </View>
  );
}

const WHERE = [
  { value: 'ours', label: 'At our bar' },
  { value: 'theirs', label: 'At their bar' },
] as const;

/** One bar on the night card: what it is to us, its name, a note under it, and maybe a button. */
function BarRow({ label, name, note, action }: { label: string; name: string | null; note?: ReactNode; action?: { label: string; a11y: string; onPress: () => void } }) {
  return (
    <View style={[styles.between, styles.party]}>
      <View style={{ flex: 1 }}>
        <Caption tone="muted">{label}</Caption>
        <Body tone={name ? 'ink' : 'muted'}>{name ?? 'Nobody yet'}</Body>
        {note}
      </View>
      {action ? <Button label={action.label} size="sm" variant="secondary" accessibilityLabel={action.a11y} onPress={action.onPress} /> : null}
    </View>
  );
}

/** Step 1: the night (whose bar, who's in it) and how many of each drink (boards "1. Serves per drink", A1, A2). */
export function ServesStep({ data, total, summaries }: { data: RunSheetData; total: number; summaries: Record<string, string> }) {
  const ds = useDs();
  const setServes = useSetServes(data.menu.id);
  const [same, setSame] = useState('100');
  const setVenue = useSetVenue(data.menu.id);
  const setDrinkParty = useSetDrinkParty(data.menu.id);
  const [editing, setEditing] = useState<{ kind: 'guest' | 'brand'; party: RunParty | null; venue?: boolean } | null>(null);
  const guest = data.parties.find((p) => p.kind === 'guest') ?? null;
  const atTheirs = !!guest?.isVenue;
  const host = data.menu.hostName;
  // Their bar needs a guest to be at: with none yet, name them first.
  const pickWhere = (where: 'ours' | 'theirs') => {
    if ((where === 'theirs') === atTheirs) return;
    if (guest) setVenue.mutate({ guestId: guest.id, isVenue: where === 'theirs' });
    else setEditing({ kind: 'guest', party: null, venue: true });
  };
  const changeGuest = { label: guest ? 'Change' : 'Add', onPress: () => setEditing({ kind: 'guest', party: guest, venue: atTheirs }) };
  const brands = data.parties.filter((p) => p.kind === 'brand');
  const night = nightLine(data.menu.startsAt, data.menu.endsAt);
  const [day, hours] = night ? night.split(' · ') : [null, null];
  const looks = usePartyLooks(host, data.parties);
  const guestColour = looks.find((l) => l.id === guest?.id)?.colour ?? ds.c.muted;
  const guestNote = guest ? <GuestPageNote guest={guest} guestColour={guestColour} /> : undefined;
  const whose = guest ? ` Tap Ours or ${guest.name}’s on a drink to say whose it is.` : '';

  return (
    <View style={{ gap: space.xl }}>
      <View role="group" aria-label="The night" style={[styles.card, { backgroundColor: ds.c.surface }]}>
        {day ? (
          <View style={styles.between}>
            <Headline>{day}</Headline>
            {hours ? <Caption tone="muted">{hours}</Caption> : null}
          </View>
        ) : (
          <Caption tone="muted">No date yet. Set it from the menu.</Caption>
        )}
        <View style={[styles.rule, { backgroundColor: ds.c.line }]} />
        <View style={{ gap: space.sm }}>
          <Caption tone="muted">Where’s the night?</Caption>
          <Segmented variant="ink" stretch choice onSurface accessibilityLabel="Where’s the night?" options={WHERE} value={atTheirs ? 'theirs' : 'ours'} onChange={pickWhere} />
        </View>
        {atTheirs && guest ? (
          <>
            <BarRow label="Their bar" name={guest.name} note={guestNote} action={{ ...changeGuest, a11y: 'Change the bar we’re going to' }} />
            <BarRow label="Going there" name={`${host} (us)`} />
          </>
        ) : (
          <>
            <BarRow label="Our bar" name={host} />
            <BarRow label="Coming to us" name={guest?.name ?? null} note={guestNote} action={{ ...changeGuest, a11y: guest ? 'Change the bar coming to us' : 'Add the bar coming to us' }} />
          </>
        )}
        {guest ? <GuestCredit guest={guest} drinks={data.drinks} menuName={data.menu.name} day={day} onLink={changeGuest.onPress} /> : null}
        {guest ? (
          <Caption tone="muted">
            {(atTheirs
              ? `Everything starts with ${guest.name} except the house preps for your drinks and a brand’s own bottles. Change any of it on Who.`
              : data.drinks.some((d) => d.partyId === guest.id)
                ? `Everything starts with you except ${guest.name}’s house preps and a brand’s own bottles. Change any of it on Who.`
                : `Everything starts with you. Give ${guest.name} what they bring on Who.`) + whose}
          </Caption>
        ) : null}
        <View style={{ gap: space.sm }}>
          <Caption tone="muted">Brands</Caption>
          <View style={styles.wrap}>
            {brands.map((b) => (
              <PressableScale key={b.id} role="button" accessibilityLabel={`${b.name}. Change`} onPress={() => setEditing({ kind: 'brand', party: b })} style={[styles.pill, { backgroundColor: ds.c.raised }]}>
                <Caption>{b.name}</Caption>
              </PressableScale>
            ))}
            <PressableScale role="button" accessibilityLabel="Add a brand" onPress={() => setEditing({ kind: 'brand', party: null })} style={[styles.pill, styles.dashed, { borderColor: ds.c.lineStrong }]}>
              <Caption>+ Add a brand</Caption>
            </PressableScale>
          </View>
        </View>
      </View>

      <View role="group" aria-label="Serves per drink" style={{ gap: space.md }}>
        <View style={styles.between}>
          <Headline>Serves</Headline>
          <Spec tone="muted">{total.toLocaleString('en-GB')} total</Spec>
        </View>
        <View style={[styles.same, { backgroundColor: ds.c.surface }]}>
          <Caption tone="muted" style={{ flex: 1 }}>Same for every drink</Caption>
          <TextInput
            aria-label="Serves for every drink"
            value={same}
            onChangeText={(t) => setSame(t.replace(/\D/g, ''))}
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={4}
            style={[styles.input, { width: 72, height: 36, color: ds.c.ink, borderColor: ds.c.lineStrong, backgroundColor: ds.c.ground }]}
          />
          <Button label="Apply" size="sm" variant="secondary" disabled={!clampServes(same) || !data.drinks.length} onPress={() => setServes.mutate({ menuDrinkIds: data.drinks.map((d) => d.id), serves: clampServes(same) })} />
        </View>
        {data.drinks.map((d) => (
          <View key={d.id} style={[styles.drink, { backgroundColor: ds.c.surface }]}>
            <View style={{ flex: 1, minWidth: 0, gap: space.xs + 2 }}>
              <View>
                <Body style={{ fontFamily: fontFamilies.bodySemiBold }}>{d.name}</Body>
                <Caption tone="muted" numberOfLines={1}>{summaries[d.id] || (d.itemType === 'cocktail' ? 'No spec yet' : 'One a serve')}</Caption>
              </View>
              {guest ? (
                <WhoseTag drink={d} guest={guest} guestColour={guestColour} onToggle={() => setDrinkParty.mutate({ menuDrinkId: d.id, partyId: d.partyId === guest.id ? null : guest.id })} />
              ) : null}
            </View>
            <Stepper drink={d} onSet={(serves) => setServes.mutate({ menuDrinkIds: [d.id], serves })} />
          </View>
        ))}
        <Caption tone="muted">Up to 6,969 a drink. Type a number or use − and +.</Caption>
      </View>
      {editing ? <PartySheet menuId={data.menu.id} kind={editing.kind} party={editing.party} venue={editing.venue} sortOrder={data.parties.length} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: space.lg, gap: space.md, borderCurve: 'continuous' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  rule: { height: StyleSheet.hairlineWidth },
  party: { minHeight: layout.minTapTarget, justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  dashed: { borderWidth: 1, borderStyle: 'dashed' },
  same: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.control, paddingVertical: space.sm, paddingRight: space.sm, paddingLeft: space.md },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.card, padding: space.md, borderCurve: 'continuous' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  stepButton: { width: 36, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  input: { height: layout.minTapTarget, borderWidth: 1, borderRadius: radius.control, textAlign: 'center', fontFamily: fontFamilies.monoMedium, fontSize: type.spec.fontSize, padding: 0 },
});
