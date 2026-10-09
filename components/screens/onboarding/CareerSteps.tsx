import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSaveCareerDrink, useSaveWorkedMenu, useSaveWorkplace, useCreateOnboardingBar } from '@/hooks/useOnboarding';
import { useClaimProfile, usePublicPeople, type PublicPerson } from '@/hooks/useProfiles';
import { usePublicBars, type RankVenue } from '@/hooks/useRankings';
import { barNameError, drinkNameError, menuNameError, roleError, venueLabel, yearError } from '@/lib/onboarding';

import { CLAIM_PAST_JOBS, PastJobs } from '../profile/PastJobs';

/** Search for a profile we already have. Claiming it does not make a second one. */
export function FindStep({
  name,
  pending,
  onClaimed,
  onNew,
  onSkip,
}: {
  name: string;
  pending: boolean;
  onClaimed: () => void;
  onNew: () => void;
  onSkip: () => void;
}) {
  const [search, setSearch] = useState(name);
  const [picked, setPicked] = useState<PublicPerson | null>(null);
  const [message, setMessage] = useState('');
  const { data: found } = usePublicPeople(picked ? '' : search);
  const claim = useClaimProfile();

  if (picked) {
    return (
      <View style={styles.stack}>
        {picked.is_claimed ? (
          <Body>That profile is already claimed. Pick another, or add your own.</Body>
        ) : (
          <>
            <Body>{`Claim ${picked.display_name} as you. A moderator checks it, and it stays your only profile.`}</Body>
            <Field
              label="How can a moderator check it's you?"
              value={message}
              onChangeText={setMessage}
              hint="A link to your Instagram or a press piece helps."
              multiline
              maxLength={1000}
            />
            <Caption tone="muted">{CLAIM_PAST_JOBS}</Caption>
            {claim.error ? <Caption tone="accent">{claimMessage(claim.error)}</Caption> : null}
            <Button
              label={claim.isPending ? 'Sending…' : 'Send claim'}
              disabled={claim.isPending}
              onPress={() => claim.mutate({ profile_id: picked.id, message, bar_id: null }, { onSuccess: onClaimed })}
            />
          </>
        )}
        <Button label="Back" variant="ghost" onPress={() => setPicked(null)} />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Field label="Search people" value={search} onChangeText={setSearch} autoCorrect={false} />
      <View style={styles.chips}>
        {(found ?? []).map((p) => (
          <Chip key={p.id} label={personLabel(p)} selected={false} onPress={() => setPicked(p)} />
        ))}
      </View>
      {search.trim().length >= 2 && found?.length === 0 ? <Caption tone="muted">No one by that name.</Caption> : null}
      <Button label={pending ? 'Saving…' : 'None of these'} onPress={onNew} disabled={pending} />
      <Button label="Not now" variant="ghost" onPress={onSkip} disabled={pending} />
    </View>
  );
}

/** Where they work now, or a bar they used to. Closed bars stay in the search. */
export function PlaceStep({ personId, isCurrent, onDone, listJobs = true }: { personId: string | null; isCurrent: boolean; onDone: () => void; listJobs?: boolean }) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [barName, setBarName] = useState('');
  const [bar, setBar] = useState<RankVenue | null>(null);
  const [role, setRole] = useState('');
  const [tried, setTried] = useState(false);
  const { data: found } = usePublicBars(bar || adding ? '' : search);
  const save = useSaveWorkplace();
  const create = useCreateOnboardingBar();

  const savePlace = () => {
    setTried(true);
    if (!personId || roleError(role) || !bar) return;
    save.mutate(
      { personId, barId: bar.id, title: role, isCurrent },
      {
        onSuccess: () => {
          if (isCurrent) onDone();
          else {
            setBar(null);
            setRole('');
            setTried(false);
          }
        },
      }
    );
  };
  const addBar = () => {
    setTried(true);
    if (barNameError(barName)) return;
    create.mutate(barName, { onSuccess: onDone });
  };

  return (
    <View style={styles.stack}>
      {!isCurrent && personId && listJobs ? <PastJobs personId={personId} /> : null}
      {!isCurrent ? <Caption tone="muted">Add a past job. A closed bar we already know still shows up here.</Caption> : null}
      {!bar && !adding ? (
        <>
          <Field label="Search bars" value={search} onChangeText={setSearch} placeholder="Bar name" autoCorrect={false} />
          <View style={styles.chips}>
            {(found ?? []).map((v) => (
              <Chip key={v.id} label={venueLabel(v)} selected={false} onPress={() => { setBar(v); setTried(false); }} />
            ))}
          </View>
          {search.trim().length >= 2 && found?.length === 0 ? <Caption tone="muted">No bars by that name.</Caption> : null}
          {isCurrent ? <Button label="Add your bar" variant="secondary" onPress={() => setAdding(true)} /> : null}
        </>
      ) : null}
      {bar ? (
        <>
          <View style={styles.row}>
            <Body style={styles.flex}>{venueLabel(bar)}</Body>
            <Button label="Change" variant="ghost" onPress={() => setBar(null)} />
          </View>
          <Field label="Your role" value={role} onChangeText={setRole} placeholder="Bartender" error={tried ? (roleError(role) ?? undefined) : undefined} maxLength={60} />
          {save.error ? <Caption tone="accent">{save.error.message}</Caption> : null}
          {!personId ? <Caption tone="accent">Add your name first.</Caption> : null}
          <Button label={save.isPending ? 'Saving…' : isCurrent ? 'Continue' : 'Add place'} onPress={savePlace} disabled={save.isPending} />
        </>
      ) : null}
      {adding ? (
        <>
          <Field label="Bar name" value={barName} onChangeText={setBarName} error={tried ? (barNameError(barName) ?? undefined) : undefined} autoComplete="organization" maxLength={80} />
          {create.error ? <Caption tone="accent">{create.error.message}</Caption> : null}
          <View style={styles.row}>
            <Button label="Cancel" variant="ghost" onPress={() => { setAdding(false); setTried(false); }} />
            <Button label={create.isPending ? 'Adding…' : 'Add bar'} onPress={addBar} disabled={create.isPending} />
          </View>
        </>
      ) : null}
      <Button label={isCurrent ? 'Not now' : 'Continue'} variant={isCurrent ? 'ghost' : 'primary'} onPress={onDone} />
    </View>
  );
}

/** A menu they worked, at a bar that may have closed. Same save as a job: their own profile. */
export function MenuStep({ personId, onDone }: { personId: string | null; onDone: () => void }) {
  const [bar, setBar] = useState<RankVenue | null>(null);
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [tried, setTried] = useState(false);
  const save = useSaveWorkedMenu();
  const nameProblem = tried ? menuNameError(name) : null;
  const yearProblem = tried ? yearError(year) : null;

  const submit = () => {
    setTried(true);
    if (!personId || !bar || menuNameError(name) || yearError(year)) return;
    save.mutate(
      { personId, barId: bar.id, name, year: year.trim() ? Number(year) : null },
      { onSuccess: () => { setName(''); setYear(''); setTried(false); setBar(null); } }
    );
  };

  return (
    <View style={styles.stack}>
      <BarPick bar={bar} onPick={setBar} />
      {bar ? (
        <>
          <Field label="Menu name" value={name} onChangeText={setName} error={nameProblem ?? undefined} maxLength={120} />
          <Field label="Year (optional)" value={year} onChangeText={setYear} error={yearProblem ?? undefined} keyboardType="number-pad" maxLength={4} />
          {save.error ? <Caption tone="accent">{save.error.message}</Caption> : null}
          <Button label={save.isPending ? 'Saving…' : 'Add menu'} onPress={submit} disabled={save.isPending} />
        </>
      ) : null}
      <Button label="Continue" onPress={onDone} />
    </View>
  );
}

/** A cocktail they worked on. A normal shared drink, origin bar optional and allowed to be closed. */
export function DrinkStep({ personId, onDone }: { personId: string | null; onDone: () => void }) {
  const [bar, setBar] = useState<RankVenue | null>(null);
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const save = useSaveCareerDrink();

  const submit = () => {
    setTried(true);
    if (!personId || drinkNameError(name)) return;
    save.mutate({ personId, barId: bar?.id ?? null, name }, { onSuccess: () => { setName(''); setTried(false); setBar(null); } });
  };

  return (
    <View style={styles.stack}>
      <Field label="Cocktail" value={name} onChangeText={setName} error={tried ? (drinkNameError(name) ?? undefined) : undefined} maxLength={80} />
      <Caption tone="muted">Where it started, if you want that on the credit. A closed bar is fine.</Caption>
      <BarPick bar={bar} onPick={setBar} />
      {save.error ? <Caption tone="accent">{save.error.message}</Caption> : null}
      {!personId ? <Caption tone="accent">Add your name first.</Caption> : null}
      <Button label={save.isPending ? 'Saving…' : 'Add cocktail'} onPress={submit} disabled={save.isPending} />
      <Button label="Continue" onPress={onDone} />
    </View>
  );
}

function BarPick({ bar, onPick }: { bar: RankVenue | null; onPick: (venue: RankVenue | null) => void }) {
  const [search, setSearch] = useState('');
  const { data: found } = usePublicBars(bar ? '' : search);
  if (bar) {
    return (
      <View style={styles.row}>
        <Body style={styles.flex}>{venueLabel(bar)}</Body>
        <Button label="Change" variant="ghost" onPress={() => onPick(null)} />
      </View>
    );
  }
  return (
    <>
      <Field label="Search bars" value={search} onChangeText={setSearch} placeholder="Bar name" autoCorrect={false} />
      <View style={styles.chips}>
        {(found ?? []).map((v) => (
          <Chip key={v.id} label={venueLabel(v)} selected={false} onPress={() => onPick(v)} />
        ))}
      </View>
      {search.trim().length >= 2 && found?.length === 0 ? <Caption tone="muted">No bars by that name.</Caption> : null}
    </>
  );
}

function personLabel(person: PublicPerson): string {
  const place = person.city ? `${person.display_name}, ${person.city}` : person.display_name;
  return person.is_claimed ? `${place}, claimed` : place;
}

function claimMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') return 'You already have a claim waiting on this profile.';
  if (code === '42501') return "You can't claim this profile. It may have been claimed already.";
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('You already')) return message;
  return "Couldn't send your claim. Check your connection and try again.";
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
