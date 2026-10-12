import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DsText, Field, Headline, PressableScale, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useSaveWorkplace, useCreateOnboardingBar } from '@/hooks/useOnboarding';
import { useClaimProfile, usePublicPeople, type PublicPerson } from '@/hooks/useProfiles';
import { usePublicBars, type RankVenue } from '@/hooks/useRankings';
import { barNameError, roleError, venueLabel, type JobMonth } from '@/lib/onboarding';

import { CLAIM_PAST_JOBS, PastJobs } from '../profile/PastJobs';
import { MonthField } from './MonthField';
import { SetupFooter, SetupPage } from './SetupPage';

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
  const ds = useDs();
  const [search, setSearch] = useState(name);
  const [picked, setPicked] = useState<PublicPerson | null>(null);
  const [message, setMessage] = useState('');
  const { data: found } = usePublicPeople(picked ? '' : search);
  const claim = useClaimProfile();

  if (picked) {
    const send = () => claim.mutate({ profile_id: picked.id, message, bar_id: null }, { onSuccess: onClaimed });
    return (
      <SetupPage
        footer={
          picked.is_claimed ? (
            <Button label="Back to the list" size="lg" onPress={() => setPicked(null)} />
          ) : (
            <SetupFooter label={claim.isPending ? 'Sending…' : 'Send claim'} disabled={claim.isPending} onPress={send} skipLabel="Back to the list" onSkip={() => setPicked(null)} />
          )
        }
      >
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
          </>
        )}
      </SetupPage>
    );
  }

  return (
    <SetupPage footer={<SetupFooter label={pending ? 'Saving…' : 'None of these'} disabled={pending} onPress={onNew} onSkip={onSkip} />}>
      <Field label="Search people" value={search} onChangeText={setSearch} autoCorrect={false} />
      {found?.length ? (
        <View role="list" style={styles.rows}>
          {found.map((p) => (
            <PressableScale key={p.id} role="button" accessibilityLabel={personLabel(p)} onPress={() => setPicked(p)} style={[styles.person, { borderColor: ds.c.line }]}>
              <UserAvatar uri={null} name={p.display_name} size={36} />
              <Body style={styles.flex} numberOfLines={1}>
                {personLabel(p)}
              </Body>
            </PressableScale>
          ))}
        </View>
      ) : null}
      {search.trim().length >= 2 && found?.length === 0 ? <Caption tone="muted">No one by that name.</Caption> : null}
      <Caption tone="muted">Claiming one sends it to a moderator. It stays your only profile.</Caption>
    </SetupPage>
  );
}

/** The bar they picked, with Change. */
function PickedBar({ bar, onChange }: { bar: RankVenue; onChange: () => void }) {
  return (
    <Surface style={styles.picked}>
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1}>{bar.display_name}</DsText>
        <Caption tone="muted" numberOfLines={1}>
          {[bar.locality, bar.city].filter((x, i, all) => x && all.indexOf(x) === i).join(', ') + (bar.is_closed ? ' · Closed' : '')}
        </Caption>
      </View>
      <Button label="Change" variant="ghost" onPress={onChange} />
    </Surface>
  );
}

/** A labelled checkbox: "I still work here". */
function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (on: boolean) => void }) {
  const ds = useDs();
  return (
    <PressableScale role="checkbox" aria-checked={value} accessibilityLabel={label} onPress={() => onChange(!value)} style={styles.check}>
      <View style={[styles.box, { borderColor: value ? ds.accentFill.fill : ds.c.lineStrong, backgroundColor: value ? ds.accentFill.fill : 'transparent' }]}>
        {value ? <IconSymbol name="checkmark" size={14} color={ds.accentFill.text} /> : null}
      </View>
      <Body>{label}</Body>
    </PressableScale>
  );
}

function thisMonth(): JobMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Where they work now (isCurrent), or a bar they used to. Closed bars stay in
 * the search. The month fields save to the job's start and end dates.
 */
export function PlaceStep({ personId, isCurrent, onDone, listJobs = true }: { personId: string | null; isCurrent: boolean; onDone: (barName?: string) => void; listJobs?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [barName, setBarName] = useState('');
  const [bar, setBar] = useState<RankVenue | null>(null);
  const [role, setRole] = useState('');
  const [from, setFrom] = useState<JobMonth | null>(null);
  const [to, setTo] = useState<JobMonth | null>(null);
  const [stillHere, setStillHere] = useState(false);
  const [tried, setTried] = useState(false);
  const [max] = useState(thisMonth);
  const save = useSaveWorkplace();
  const create = useCreateOnboardingBar();

  const reset = () => {
    setBar(null);
    setRole('');
    setFrom(null);
    setTo(null);
    setStillHere(false);
    setTried(false);
  };
  const savePlace = () => {
    setTried(true);
    if (!personId || roleError(role) || !bar) return;
    const current = isCurrent || stillHere;
    save.mutate({ personId, barId: bar.id, title: role, isCurrent: current, ...(from ? { start: from } : null), ...(to && !current ? { end: to } : null) }, { onSuccess: () => (isCurrent ? onDone(bar.display_name) : reset()) });
  };
  const addBar = () => {
    setTried(true);
    if (barNameError(barName)) return;
    create.mutate(barName, { onSuccess: () => onDone(barName.trim()) });
  };

  const footer = adding ? (
    <SetupFooter label={create.isPending ? 'Adding…' : 'Add bar'} disabled={create.isPending} onPress={addBar} skipLabel="Cancel" onSkip={() => { setAdding(false); setTried(false); }} />
  ) : isCurrent ? (
    <SetupFooter label={save.isPending ? 'Saving…' : 'Continue'} disabled={save.isPending || !bar} onPress={savePlace} onSkip={() => onDone()} />
  ) : (
    <SetupFooter onPress={() => onDone()} onSkip={() => onDone()} />
  );

  return (
    <SetupPage footer={footer}>
      {!isCurrent && personId && listJobs ? <PastJobs personId={personId} /> : null}
      {!isCurrent ? <Headline role="heading">Add a past job</Headline> : null}
      {adding ? (
        <>
          <Field label="Bar name" value={barName} onChangeText={setBarName} error={tried ? (barNameError(barName) ?? undefined) : undefined} autoComplete="organization" maxLength={80} />
          {create.error ? <Caption tone="accent">{create.error.message}</Caption> : null}
        </>
      ) : (
        <>
          {bar ? <PickedBar bar={bar} onChange={() => setBar(null)} /> : <BarPick bar={null} onPick={(v) => { setBar(v); setTried(false); }} />}
          {bar ? (
            <>
              <Field label="Your role" value={role} onChangeText={setRole} placeholder="Bartender" error={tried ? (roleError(role) ?? undefined) : undefined} maxLength={60} />
              {isCurrent ? (
                <MonthField label="Since" value={from} onChange={setFrom} max={max} />
              ) : (
                <>
                  <View style={styles.pair}>
                    <View style={styles.flex}>
                      <MonthField label="From" value={from} onChange={setFrom} max={max} />
                    </View>
                    {stillHere ? null : (
                      <View style={styles.flex}>
                        <MonthField label="To" value={to} onChange={setTo} max={max} />
                      </View>
                    )}
                  </View>
                  <Check label="I still work here" value={stillHere} onChange={setStillHere} />
                  <Button label={save.isPending ? 'Saving…' : 'Add place'} variant="secondary" onPress={savePlace} disabled={save.isPending} />
                </>
              )}
              {save.error ? <Caption tone="accent">{save.error.message}</Caption> : null}
              {!personId ? <Caption tone="accent">Add your name first.</Caption> : null}
            </>
          ) : null}
          {isCurrent ? (
            <>
              <Button label="Add your bar" variant="secondary" onPress={() => setAdding(true)} />
              <Caption tone="muted">Picking a bar doesn’t open its menus. Adding a new bar makes you its admin.</Caption>
            </>
          ) : (
            <Caption tone="muted">Past jobs stay hidden unless you show them. Dates are only on your profile if you turn a job on.</Caption>
          )}
        </>
      )}
    </SetupPage>
  );
}

/** Search bars (closed ones too) and pick one. */
export function BarPick({ bar, onPick, label = 'Search bars' }: { bar: RankVenue | null; onPick: (venue: RankVenue | null) => void; label?: string }) {
  const [search, setSearch] = useState('');
  const { data: found } = usePublicBars(bar ? '' : search);
  if (bar) return <PickedBar bar={bar} onChange={() => onPick(null)} />;
  return (
    <>
      <Field label={label} value={search} onChangeText={setSearch} placeholder="Bar name" autoCorrect={false} />
      <View style={styles.chips}>
        {(found ?? []).map((v) => (
          <Chip key={v.id} label={venueLabel(v)} selected={false} onPress={() => onPick(v)} />
        ))}
      </View>
      {search.trim().length >= 2 && found?.length === 0 ? <Caption tone="muted">No bars by that name.</Caption> : null}
    </>
  );
}

/** "Jo Park · Bar Bianca, Melbourne": name, where they work now, city. */
function personLabel(person: PublicPerson): string {
  const place = [person.current_bar, person.city].filter(Boolean).join(', ');
  const label = place ? `${person.display_name} · ${place}` : person.display_name;
  return person.is_claimed ? `${label} · claimed` : label;
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rows: { gap: space.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  box: { width: 22, height: 22, borderRadius: radius.mark, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
