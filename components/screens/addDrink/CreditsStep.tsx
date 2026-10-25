import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useClosestClassic } from '@/hooks/useClosestClassic';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useMyProfile } from '@/hooks/useMyProfile';
import { usePublicPeople } from '@/hooks/useProfiles';
import { usePublicBars } from '@/hooks/useRankings';
import type { SameNameDrink } from '@/hooks/useSameNameDrink';
import { PickList } from '@/components/search/NearPicks';
import { AddBarForm } from '@/components/screens/home/AddBar';
import { suggestClassic } from '@/lib/classics';
import { withArticle } from '@/lib/closestClassic';
import { parseYear, searchByName, type StepProps } from '@/lib/drinkWizard';
import { nearAfter } from '@/lib/nearName';

import type { CatalogIngredient } from './IngredientSearch';
import { SameNameCard, useSameNamePicks } from './SameNameCard';
import { Eyebrow, WizardChip } from './WizardChrome';

interface CreditsStepProps extends StepProps {
  /** The venue it's added at ("Little Rye"), credited too; null at home. */
  venueName: string | null;
  ingredients: readonly CatalogIngredient[];
  /** The bar it's credited to already has a drink by this name (useSameNameDrink): its card shows under the bar. */
  match?: SameNameDrink | null;
  /** Make this a version or It's a different drink: back to the name (on desktop, it's on the same page). */
  onRename?: () => void;
}

/**
 * Who made it (you by default, someone with a profile, or nobody yet), who
 * made it with them, where and when it was first made, and the classic it's
 * a riff on: the one the spec is closest to (as on the ingredients step),
 * else the one its name says. A venue's drink is credited to the venue too.
 */
export function CreditsStep({ draft, set, venueName, ingredients, match, onRename }: CreditsStepProps) {
  const me = useMyProfile().data ?? null;
  const [who, setWho] = useState('');
  const people = usePublicPeople(who, { near: true }).data ?? [];
  const classics = useDrinkLists().data ?? [];
  const [also, setAlso] = useState('');
  const alsoPeople = usePublicPeople(also, { near: true }).data ?? [];
  const [riff, setRiff] = useState('');
  const generic = (id: string) => ingredients.find((i) => i.id === id)?.generic_id ?? null;
  const close = useClosestClassic(draft.lines.flatMap((l) => (l.id ? [{ id: l.id, generic: generic(l.id) }] : []))).data ?? null;
  const suggested = close ?? (draft.name.trim() ? suggestClassic(draft.name, classics)?.classic : undefined);
  const riffResults = searchByName(riff, classics, 5);
  // "negorni": Negroni, under "Did you mean".
  const riffNear = nearAfter(riff, classics, riffResults, (c) => c.name);
  const other = typeof draft.creator === 'object' ? draft.creator : null;
  const mine = !!me && (draft.creator === 'me' || draft.creator === null);

  // Added at a venue: whether it's theirs, else where it's from (board create-eddie-oct16).
  const elsewhere = !!venueName && !!draft.elsewhere;
  return (
    <View style={styles.stack}>
      {venueName ? (
        <View style={styles.section}>
          <Eyebrow>{`Is this a ${venueName} drink?`}</Eyebrow>
          <View role="radiogroup" accessibilityLabel={`Is this a ${venueName} drink?`} style={styles.chips}>
            <WizardChip label="Yes, it’s ours" selected={!elsewhere} onPress={() => set({ elsewhere: false, place: null })} />
            <WizardChip label="No, from somewhere else" selected={elsewhere} onPress={() => set({ elsewhere: true })} />
          </View>
          {elsewhere ? (
            <>
              <PlacePick draft={draft} set={set} label="Where’s it from?" match={match} onRename={onRename} />
              <Caption tone="muted">{`It’s saved to ${venueName}’s library, credited to the bar it came from.`}</Caption>
            </>
          ) : (
            <Caption tone="muted">{`Yes is picked for you when you add a drink as ${venueName}.`}</Caption>
          )}
        </View>
      ) : null}
      <View style={styles.section}>
        <Eyebrow>Made by</Eyebrow>
        <View role="radiogroup" accessibilityLabel="Made by" style={styles.chips}>
          {me ? <WizardChip label={`Me (${me.displayName})`} selected={mine} onPress={() => set({ creator: 'me' })} /> : null}
          {other ? <WizardChip label={other.name} selected onPress={() => set({ creator: 'nobody' })} /> : null}
          <WizardChip label="Not sure" selected={!mine && !other} onPress={() => set({ creator: 'nobody' })} />
        </View>
        {me ? null : <Caption tone="muted">Make a profile on the You tab to take credit for your drinks.</Caption>}
        <Field label="Someone else" value={who} onChangeText={setWho} placeholder="Search people" autoCorrect={false} maxLength={60} />
        {who.trim().length >= 2 ? (
          <PickList
            rows={people.map((p) => ({ id: p.id, label: p.city ? `${p.display_name} · ${p.city}` : p.display_name, near: p.near }))}
            empty="Nobody by that name has a public profile yet."
            no="No, it’s someone else"
            onPick={(id) => {
              const p = people.find((x) => x.id === id);
              if (p) set({ creator: { id: p.id, name: p.display_name } });
              setWho('');
            }}
          />
        ) : null}
        {venueName && !elsewhere ? <Caption tone="muted">{`It’s credited to ${venueName} too.`}</Caption> : null}
      </View>

      <View style={styles.section}>
        <Eyebrow>Made with</Eyebrow>
        {draft.coCreators.length ? (
          <View role="group" accessibilityLabel="Made with" style={styles.chips}>
            {draft.coCreators.map((c) => (
              <WizardChip key={c.id ?? c.name} kind="checkbox" label={c.name} selected onPress={() => set({ coCreators: draft.coCreators.filter((x) => x !== c) })} />
            ))}
          </View>
        ) : null}
        <Field label="Who else made it?" value={also} onChangeText={setAlso} placeholder="Search people" autoCorrect={false} maxLength={60} />
        {also.trim().length >= 2 ? (
          <PickList
            rows={alsoPeople.filter((p) => !draft.coCreators.some((c) => c.id === p.id)).map((p) => ({ id: p.id, label: p.city ? `${p.display_name} · ${p.city}` : p.display_name, near: p.near }))}
            empty="Nobody by that name has a public profile yet."
            no="No, it’s someone else"
            onPick={(id) => {
              const p = alsoPeople.find((x) => x.id === id);
              if (p) set({ coCreators: [...draft.coCreators, { id: p.id, name: p.display_name }] });
              setAlso('');
            }}
          />
        ) : null}
      </View>

      <WhereWhen draft={draft} set={set} venueName={elsewhere ? null : venueName} asked={elsewhere} match={match} onRename={onRename} />

      <View style={styles.section}>
        <Eyebrow>Riff on a classic?</Eyebrow>
        <View role="radiogroup" accessibilityLabel="Riff on" style={styles.chips}>
          {draft.riffOf ? <WizardChip label={draft.riffOf.name} selected onPress={() => set({ riffOf: null })} /> : null}
          {suggested && suggested.id !== draft.riffOf?.id ? (
            <WizardChip label={`${suggested.name}?`} selected={false} onPress={() => set({ riffOf: { id: suggested.id, name: suggested.name } })} />
          ) : null}
          <WizardChip label="Its own thing" selected={!draft.riffOf} onPress={() => set({ riffOf: null })} />
        </View>
        <Field label="Find a classic" value={riff} onChangeText={setRiff} placeholder="Negroni, Daiquiri…" autoCorrect={false} maxLength={60} />
        {riff.trim() ? (
          <PickList
            rows={[...riffResults.map((c) => ({ id: c.id, label: c.name })), ...riffNear.map((c) => ({ id: c.id, label: c.name, near: true }))]}
            empty="No classic by that name."
            onPick={(id) => {
              const c = classics.find((x) => x.id === id);
              if (c) set({ riffOf: { id: c.id, name: c.name } });
              setRiff('');
            }}
          />
        ) : null}
        {close ? (
          <Caption tone="muted">
            {draft.riffOf?.id === close.id ? `Picked from the ingredients step: it’s close to ${withArticle(close.name)}.` : `From the ingredients step: it’s close to ${withArticle(close.name)}.`}
          </Caption>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Where it was first made (a venue's drink is the venue's; at home, at home
 * or a bar with a page) and the year, this one in a tap.
 */
function WhereWhen({ draft, set, venueName, asked, match, onRename }: StepProps & Pick<CreditsStepProps, 'match' | 'onRename'> & { venueName: string | null; asked: boolean }) {
  const thisYear = new Date().getFullYear();
  const year = draft.originYear ?? null;
  // What's typed in "Another year", kept while it isn't a year yet ("19").
  const [typed, setTyped] = useState(year !== null && year !== thisYear ? String(year) : '');
  const badYear = typed.trim().length === 4 && parseYear(typed, thisYear) === null;
  return (
    <View style={styles.section}>
      <Eyebrow>{asked ? 'When' : 'Where and when'}</Eyebrow>
      {venueName ? <Caption tone="muted">{`First made at ${venueName}.`}</Caption> : asked ? null : <PlacePick draft={draft} set={set} label="First made at a bar" match={match} onRename={onRename} />}
      <View role="radiogroup" accessibilityLabel="When" style={styles.chips}>
        <WizardChip
          label={`This year (${thisYear})`}
          selected={year === thisYear}
          onPress={() => {
            setTyped('');
            set({ originYear: thisYear });
          }}
        />
        <WizardChip
          label="Not sure"
          selected={year === null}
          onPress={() => {
            setTyped('');
            set({ originYear: null });
          }}
        />
      </View>
      <Field
        label="Another year"
        value={typed}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '');
          setTyped(digits);
          set({ originYear: parseYear(digits, thisYear) });
        }}
        placeholder="1998"
        keyboardType="number-pad"
        maxLength={4}
        error={badYear ? `A year from 1600 to ${thisYear}.` : undefined}
      />
    </View>
  );
}

/** At home, or a bar with a page: where the drink was first made, and that bar's drink by the same name. */
function PlacePick({ draft, set, label, match, onRename }: StepProps & Pick<CreditsStepProps, 'match' | 'onRename'> & { label: string }) {
  const [where, setWhere] = useState('');
  const [adding, setAdding] = useState(false);
  const bars = usePublicBars(where, { near: true }).data ?? [];
  const typed = where.trim();
  const place = draft.place ?? null;
  return (
    <>
      <View role="radiogroup" accessibilityLabel="First made at" style={styles.chips}>
        <WizardChip label="At home" selected={!place} onPress={() => set({ place: null })} />
        {place ? <WizardChip label={place.name} selected onPress={() => set({ place: null })} /> : null}
      </View>
      {place && match && draft.sameAs?.id !== match.id ? <PlaceHasOne bar={place.name} drink={match} set={set} onRename={onRename} /> : null}
      <Field label={label} value={where} onChangeText={setWhere} placeholder="Search bars" autoCorrect={false} maxLength={60} />
      {typed.length >= 2 && !adding ? (
        <PickList
          rows={bars.map((b) => ({ id: b.id, label: [b.display_name, b.city].filter(Boolean).join(' · '), near: b.near }))}
          empty="No bar by that name has a page yet."
          no="No, it’s somewhere else"
          onPick={(id) => {
            const b = bars.find((x) => x.id === id);
            if (b) set({ place: { id: b.id, name: b.display_name } });
            setWhere('');
          }}
          add={{ label: `Add “${typed}” as a new bar`, sub: 'It gets its own page. The bar can claim it later.', onPress: () => setAdding(true) }}
        />
      ) : null}
      {adding ? (
        <AddBarForm
          initialName={typed}
          onCancel={() => setAdding(false)}
          onAdded={(v) => {
            set({ place: { id: v.id, name: v.display_name } });
            setAdding(false);
            setWhere('');
          }}
        />
      ) : null}
    </>
  );
}

/** "The Violet Hour already has a Paper Plane": a version keeps your spec, linked to theirs; either way the name is asked again. */
function PlaceHasOne({ bar, drink, set, onRename }: Pick<StepProps, 'set'> & { bar: string; drink: SameNameDrink; onRename?: () => void }) {
  const picks = useSameNamePicks(set);
  return (
    <SameNameCard
      bar={bar}
      drink={drink}
      caption="Open it to save it, rank it or say you made it."
      onOpen={() => picks.open(drink)}
      onVersion={() => picks.version(drink, bar, false, onRename)}
      onDifferent={() => picks.different(drink, bar, onRename)}
    />
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xxl },
  section: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
