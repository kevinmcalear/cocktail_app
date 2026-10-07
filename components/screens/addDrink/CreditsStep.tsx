import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useMyProfile } from '@/hooks/useMyProfile';
import { usePublicPeople } from '@/hooks/useProfiles';
import { suggestClassic } from '@/lib/classics';
import { searchByName, type StepProps } from '@/lib/drinkWizard';

import { Eyebrow, WizardChip } from './WizardChrome';


/**
 * Who made it (you by default, someone with a profile, or nobody yet), who
 * made it with them, and the classic it's a riff on. A venue's drink is credited to the venue too.
 */
export function CreditsStep({ draft, set, atVenue }: StepProps & { atVenue: boolean }) {
  const me = useMyProfile().data ?? null;
  const [who, setWho] = useState('');
  const people = usePublicPeople(who).data ?? [];
  const classics = useDrinkLists().data ?? [];
  const [also, setAlso] = useState('');
  const alsoPeople = usePublicPeople(also).data ?? [];
  const [riff, setRiff] = useState('');
  const suggested = draft.name.trim() ? suggestClassic(draft.name, classics)?.classic : undefined;
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
        {atVenue ? <Caption tone="muted">It’s credited to the venue too.</Caption> : null}
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
      </View>
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
