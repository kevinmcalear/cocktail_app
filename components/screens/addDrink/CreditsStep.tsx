import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { useClosestClassic } from '@/hooks/useClosestClassic';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useMyProfile } from '@/hooks/useMyProfile';
import { usePublicPeople } from '@/hooks/useProfiles';
import { usePublicBars } from '@/hooks/useRankings';
import { suggestClassic } from '@/lib/classics';
import { withArticle } from '@/lib/closestClassic';
import { parseYear, searchByName, type StepProps } from '@/lib/drinkWizard';

import type { CatalogIngredient } from './IngredientSearch';
import { Eyebrow, WizardChip } from './WizardChrome';

interface CreditsStepProps extends StepProps {
  /** The venue it's added at ("Little Rye"), credited too; null at home. */
  venueName: string | null;
  ingredients: readonly CatalogIngredient[];
}

/**
 * Who made it (you by default, someone with a profile, or nobody yet), who
 * made it with them, where and when it was first made, and the classic it's
 * a riff on: the one the spec is closest to (as on the ingredients step),
 * else the one its name says. A venue's drink is credited to the venue too.
 */
export function CreditsStep({ draft, set, venueName, ingredients }: CreditsStepProps) {
  const me = useMyProfile().data ?? null;
  const [who, setWho] = useState('');
  const people = usePublicPeople(who).data ?? [];
  const classics = useDrinkLists().data ?? [];
  const [also, setAlso] = useState('');
  const alsoPeople = usePublicPeople(also).data ?? [];
  const [riff, setRiff] = useState('');
  const generic = (id: string) => ingredients.find((i) => i.id === id)?.generic_id ?? null;
  const close = useClosestClassic(draft.lines.flatMap((l) => (l.id ? [{ id: l.id, generic: generic(l.id) }] : []))).data ?? null;
  const suggested = close ?? (draft.name.trim() ? suggestClassic(draft.name, classics)?.classic : undefined);
  const riffResults = searchByName(riff, classics, 5);
  const other = typeof draft.creator === 'object' ? draft.creator : null;
  const mine = !!me && (draft.creator === 'me' || draft.creator === null);

  return (
    <View style={styles.stack}>
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
          <Results
            rows={people.map((p) => ({ id: p.id, label: p.city ? `${p.display_name} · ${p.city}` : p.display_name }))}
            empty="Nobody by that name has a public profile yet."
            onPick={(id) => {
              const p = people.find((x) => x.id === id);
              if (p) set({ creator: { id: p.id, name: p.display_name } });
              setWho('');
            }}
          />
        ) : null}
        {venueName ? <Caption tone="muted">{`It’s credited to ${venueName} too.`}</Caption> : null}
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
          <Results
            rows={alsoPeople.filter((p) => !draft.coCreators.some((c) => c.id === p.id)).map((p) => ({ id: p.id, label: p.city ? `${p.display_name} · ${p.city}` : p.display_name }))}
            empty="Nobody by that name has a public profile yet."
            onPick={(id) => {
              const p = alsoPeople.find((x) => x.id === id);
              if (p) set({ coCreators: [...draft.coCreators, { id: p.id, name: p.display_name }] });
              setAlso('');
            }}
          />
        ) : null}
      </View>

      <WhereWhen draft={draft} set={set} venueName={venueName} />

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
          <Results
            rows={riffResults.map((c) => ({ id: c.id, label: c.name }))}
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
function WhereWhen({ draft, set, venueName }: StepProps & { venueName: string | null }) {
  const thisYear = new Date().getFullYear();
  const year = draft.originYear ?? null;
  // What's typed in "Another year", kept while it isn't a year yet ("19").
  const [typed, setTyped] = useState(year !== null && year !== thisYear ? String(year) : '');
  const [where, setWhere] = useState('');
  const bars = usePublicBars(where).data ?? [];
  const place = draft.place ?? null;
  const badYear = typed.trim().length === 4 && parseYear(typed, thisYear) === null;
  return (
    <View style={styles.section}>
      <Eyebrow>Where and when</Eyebrow>
      {venueName ? (
        <Caption tone="muted">{`First made at ${venueName}.`}</Caption>
      ) : (
        <>
          <View role="radiogroup" accessibilityLabel="First made at" style={styles.chips}>
            <WizardChip label="At home" selected={!place} onPress={() => set({ place: null })} />
            {place ? <WizardChip label={place.name} selected onPress={() => set({ place: null })} /> : null}
          </View>
          <Field label="First made at a bar" value={where} onChangeText={setWhere} placeholder="Search bars" autoCorrect={false} maxLength={60} />
          {where.trim().length >= 2 ? (
            <Results
              rows={bars.map((b) => ({ id: b.id, label: [b.display_name, b.city].filter(Boolean).join(' · ') }))}
              empty="No bar by that name has a page yet."
              onPick={(id) => {
                const b = bars.find((x) => x.id === id);
                if (b) set({ place: { id: b.id, name: b.display_name } });
                setWhere('');
              }}
            />
          ) : null}
        </>
      )}
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

function Results({ rows, empty, onPick }: { rows: { id: string; label: string }[]; empty: string; onPick: (id: string) => void }) {
  const ds = useDs();
  if (!rows.length) return <Caption tone="muted">{empty}</Caption>;
  return (
    <View role="list" style={[styles.results, { borderColor: ds.c.line }]}>
      {rows.map((r) => (
        <PressableScale key={r.id} role="button" accessibilityLabel={r.label} onPress={() => onPick(r.id)} style={[styles.row, { borderBottomColor: ds.c.line }]}>
          <Body numberOfLines={1}>{r.label}</Body>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xxl },
  section: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  results: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: layout.minTapTarget + 4, justifyContent: 'center', paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
