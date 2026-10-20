import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, useDs } from '@/components/ds';
import { PersonResultRow, ResultGroup, ResultRow } from '@/components/search/ResultRows';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useClaimProfile, usePublicPeople, useWaiting, type PublicPerson } from '@/hooks/useProfiles';
import { usePublicBars } from '@/hooks/useRankings';
import { closedLabel } from '@/lib/discoverDrinks';
import { waitingLine } from '@/lib/findYourself';

import { barPlace } from '../bar/BarFactLines';
import { CLAIM_PAST_JOBS } from '../profile/PastJobs';
import { SetupFooter, SetupPage } from './SetupPage';

/**
 * "Find your bar or your name" (find-yourself, step 1): one field finds bars
 * and people we already have, each row saying what is waiting there. A bar
 * opens its real page (public pages are open during Setup, and Back returns
 * here as it was); a person can be claimed. Claiming does not make a second
 * profile.
 */
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
  const router = useRouter();
  const [search, setSearch] = useState(name);
  const [picked, setPicked] = useState<PublicPerson | null>(null);
  const [message, setMessage] = useState('');
  const term = picked ? '' : search;
  const { data: bars = [] } = usePublicBars(term);
  const { data: people = [] } = usePublicPeople(term);
  const { data: waiting } = useWaiting(
    bars.map((b) => b.id),
    people.map((p) => p.id)
  );
  const claim = useClaimProfile();
  const chevron = <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />;

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

  const found = bars.length + people.length;
  return (
    <SetupPage footer={<SetupFooter label={pending ? 'Saving…' : 'None of these'} disabled={pending} onPress={onNew} onSkip={onSkip} />}>
      <Field label="Search bars and people" icon="magnifyingglass" value={search} onChangeText={setSearch} autoCorrect={false} />
      {/* Bars first: a bar whose name matches leads (#689). */}
      <View style={styles.groups}>
        <ResultGroup
          label="Bars"
          counted={false}
          items={bars}
          render={(b) => {
            const w = waiting?.[b.id];
            return (
              <ResultRow
                key={b.id}
                title={b.display_name}
                caption={barPlace(b.bar_type, b.locality || b.city) || undefined}
                avatar={{ uri: null, bar: { profileId: b.id } }}
                badge={b.is_claimed === false ? 'Not claimed yet' : undefined}
                tag={b.is_closed ? closedLabel(b.closed_year ?? null) : undefined}
                waiting={waitingLine('bar', w)}
                query={search}
                trailing={chevron}
                onPress={() => router.push(`/p/${b.handle || b.id}` as Href)}
              />
            );
          }}
        />
        <ResultGroup label="People" counted={false} items={people} render={(p) => <PersonResultRow key={p.id} person={p} waiting={waiting?.[p.id]} query={search} trailing={chevron} onPress={() => setPicked(p)} />} />
      </View>
      {search.trim().length >= 2 && !found ? <Caption tone="muted">No bar or person by that name.</Caption> : null}
    </SetupPage>
  );
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
  groups: { gap: space.lg },
});
