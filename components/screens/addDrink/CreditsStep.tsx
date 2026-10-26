import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { usePublicBars } from '@/hooks/useRankings';
import type { SameNameDrink } from '@/hooks/useSameNameDrink';
import { PickList } from '@/components/search/NearPicks';
import { AddBarForm } from '@/components/screens/home/AddBar';
import { parseYear, type StepProps } from '@/lib/drinkWizard';

import type { CatalogIngredient } from './IngredientSearch';
import { RiffPick } from './RiffPick';
import { SameNameCard, useSameNamePicks } from './SameNameCard';
import { WhoMadeIt } from './WhoMadeIt';
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
 * Who made it (one list, you on it to start), where and when it was first
 * made, and the classic it's a riff on: cards of the closest classics, a
 * search, or It's an original. A venue's drink is credited to the venue too.
 */
export function CreditsStep({ draft, set, venueName, ingredients, match, onRename }: CreditsStepProps) {
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
      <WhoMadeIt draft={draft} set={set} venueName={venueName && !elsewhere ? venueName : null} />

      <WhereWhen draft={draft} set={set} venueName={elsewhere ? null : venueName} asked={elsewhere} match={match} onRename={onRename} />

      <RiffPick draft={draft} set={set} ingredients={ingredients} />
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
