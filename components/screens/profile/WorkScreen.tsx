import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DsText, Field, Switch, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useMyProfile, useSaveSharing, type MyProfile } from '@/hooks/useMyProfile';
import { useAnswerPosition } from '@/hooks/usePositionRequests';
import { useEditPosition, useProfilePositions, type Position } from '@/hooks/useProfiles';
import { jobYears } from '@/lib/profiles';

import { BarMark } from '../home/BarMark';
import { PlaceStep } from '../onboarding/CareerSteps';
import { SafetyPage } from '../safety/SafetyPage';
import { JobYears, PastJobs } from './PastJobs';
import { isShownPosition } from './Positions';

/** Settings › Public profile › Work (ppl-work). */
export function WorkScreen() {
  const { data, isPending } = useMyProfile();
  return (
    <SafetyPage title="Work" intro="Bars can confirm a job. Only you decide what shows." backTo="/settings/profile">
      {data ? <Work profile={data} /> : <Body tone="muted">{isPending ? 'Loading…' : 'Make your public profile first.'}</Body>}
    </SafetyPage>
  );
}

function Work({ profile }: { profile: MyProfile }) {
  const ds = useDs();
  const save = useSaveSharing();
  const positions = useProfilePositions({ id: profile.id, kind: 'person' }).data ?? [];
  const asking = positions.filter((p) => !p.person_accepted);
  // Only a job the bar confirmed, that shows, can stand under your name: the current one first.
  const titled = positions.filter((p) => p.person_accepted && p.bar_accepted && isShownPosition(p)).sort((a, b) => Number(b.is_current) - Number(a.is_current))[0];
  const headline = save.isPending && save.variables?.headlinePositionId !== undefined ? save.variables.headlinePositionId : profile.headlinePositionId;
  const titleOn = !!titled && headline === titled.id;
  const ownLine = profile.tagline ? `Off: your own line, ${profile.tagline}, shows instead` : 'Off: nothing shows under your name';
  // Off says what shows instead (ppl-work); the switch waits on a confirmed job you show.
  const titleLine = titled && titleOn ? `${titled.title} ${titled.is_current ? 'at' : 'formerly at'} ${titled.bar.display_name}` : ownLine;

  return (
    <View style={styles.page}>
      {asking.map((p) => (
        <AskingCard key={p.id} job={p} />
      ))}
      <View style={[styles.row, styles.card, { backgroundColor: ds.c.surface }]}>
        <View style={styles.flex}>
          <Body>Job title under my name</Body>
          <Caption tone="muted">{titleLine}</Caption>
        </View>
        <Switch
          value={titleOn}
          disabled={!titled}
          onValueChange={(on) => save.mutate({ id: profile.id, headlinePositionId: on && titled ? titled.id : null })}
          label="Show my job title under my name"
        />
      </View>
      {save.error ? (
        <Caption tone="accent" role="alert">
          {save.error.message}
        </Caption>
      ) : null}
      <PastJobs personId={profile.id} />
      <AddJob personId={profile.id} />
      <View style={[styles.card, { backgroundColor: ds.c.surface }]}>
        <Body tone="muted">
          A job you add says “Not confirmed by the bar yet” until the bar confirms it. Hiding a job never removes it from the bar’s records, and drinks you created there keep your credit either way.
        </Body>
      </View>
    </View>
  );
}

/** "Pale Moth says you were a Bartender there, 2019 to 2023." with That's me, Edit and Not me. */
function AskingCard({ job }: { job: Position }) {
  const ds = useDs();
  const answer = useAnswerPosition();
  const editTitle = useEditPosition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(job.title);
  const years = jobYears(job);
  const busy = answer.isPending || editTitle.isPending;
  return (
    <View style={[styles.card, { backgroundColor: ds.c.surface }]}>
      <View style={styles.cardHead}>
        <BarMark name={job.bar.display_name} logoUrl={job.bar.avatar_url} size={40} />
        <DsText variant="body" style={styles.flex}>
          {`${job.bar.display_name} says you ${job.is_current ? 'are' : 'were'} a `}
          <DsText variant="body" style={{ fontFamily: fontFamilies.bodySemiBold }}>
            {job.title}
          </DsText>
          {` there${years ? `, ${years}` : ''}.`}
        </DsText>
      </View>
      {editing ? (
        <View style={styles.edit}>
          <Field label="Your title there" value={title} onChangeText={setTitle} maxLength={60} hint="A new title goes back to the bar to confirm." />
          {title.trim() !== job.title ? (
            <Button label="Save title" disabled={busy || !title.trim()} onPress={() => editTitle.mutate({ id: job.id, title: title.trim() }, { onSuccess: () => setEditing(false) })} />
          ) : null}
          <JobYears job={job} onDone={() => setEditing(false)} />
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button label="That’s me" disabled={busy} onPress={() => answer.mutate({ id: job.id, accept: true })} style={styles.compact} />
        <Button label="Edit" variant="secondary" disabled={busy} onPress={() => setEditing((v) => !v)} style={styles.compact} />
        <Button label="Not me" variant="ghost" disabled={busy} onPress={() => answer.mutate({ id: job.id, accept: false })} style={styles.compact} />
      </View>
      {answer.error ?? editTitle.error ? (
        <Caption tone="accent" role="alert">
          {(answer.error ?? editTitle.error)?.message}
        </Caption>
      ) : null}
    </View>
  );
}

/** Add a job you have now or had before: the same search and save as onboarding. */
function AddJob({ personId }: { personId: string }) {
  const [when, setWhen] = useState<'now' | 'before' | null>(null);
  if (!when) return <Button label="Add a job" icon="plus" variant="secondary" onPress={() => setWhen('now')} style={styles.start} />;
  return (
    <View style={styles.edit}>
      <View role="radiogroup" accessibilityLabel="When" style={styles.actions}>
        <Chip label="I work there now" selected={when === 'now'} onPress={() => setWhen('now')} />
        <Chip label="I used to" selected={when === 'before'} onPress={() => setWhen('before')} />
      </View>
      <PlaceStep key={when} personId={personId} isCurrent={when === 'now'} listJobs={false} onDone={() => setWhen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.lg, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: radius.card, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  edit: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
  // Three answers on one row at phone width (ppl-work).
  compact: { paddingHorizontal: space.lg },
});
