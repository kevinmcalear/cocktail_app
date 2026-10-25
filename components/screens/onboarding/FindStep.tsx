import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Field, useDs } from '@/components/ds';
import { splitNear } from '@/components/search/NearPicks';
import { PersonResultRow, ResultGroup, ResultRow } from '@/components/search/ResultRows';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useMyPersonClaim, usePublicPeople, useWaiting } from '@/hooks/useProfiles';
import { usePublicBars } from '@/hooks/useRankings';
import { closedLabel } from '@/lib/discoverDrinks';
import { waitingLine } from '@/lib/findYourself';

import { barPlace } from '../bar/BarFactLines';
import { ClaimSent } from './ClaimSent';
import { SetupFooter, SetupPage } from './SetupPage';

/**
 * "Find your bar or your name" (find-yourself, step 1): one field finds bars
 * and people we already have, each row saying what is waiting there. Each
 * opens its real page (public pages are open during Setup, and Back returns
 * here as it was), where "This is me" claims a person's page and comes back
 * to "Claim sent". Claiming does not make a second profile.
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
  /** Keep going after "Claim sent": the career steps are skipped. */
  onClaimed: () => void;
  onNew: () => void;
  onSkip: () => void;
}) {
  const ds = useDs();
  const router = useRouter();
  const [search, setSearch] = useState(name);
  const { data: claim } = useMyPersonClaim();
  const [bars, nearBars] = splitNear(usePublicBars(search, { near: true }).data ?? []);
  const [people, nearPeople] = splitNear(usePublicPeople(search, { near: true }).data ?? []);
  const { data: waiting } = useWaiting(
    [...bars, ...nearBars].map((b) => b.id),
    [...people, ...nearPeople].map((p) => p.id)
  );
  const chevron = <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />;

  // Back from "This is me" on a page they opened from here (find-yourself step 5).
  if (claim) return <ClaimSent claim={claim} onNext={onClaimed} />;

  const found = bars.length + people.length;
  const barRow = (b: (typeof bars)[number]) => {
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
  };
  const personRow = (p: (typeof people)[number]) => <PersonResultRow key={p.id} person={p} waiting={waiting?.[p.id]} query={search} trailing={chevron} />;
  return (
    <SetupPage footer={<SetupFooter label={pending ? 'Saving…' : 'None of these'} disabled={pending} onPress={onNew} onSkip={onSkip} />}>
      <Field label="Search bars and people" icon="magnifyingglass" value={search} onChangeText={setSearch} autoCorrect={false} />
      {/* Bars first: a bar whose name matches leads (#689). */}
      <View style={styles.groups}>
        <ResultGroup label="Bars" counted={false} items={bars} render={barRow} />
        <ResultGroup label="People" counted={false} items={people} render={personRow} />
        {/* "Did you mean" when nothing matched as typed; other spellings last when something did (NearPicks). */}
        <ResultGroup label={found ? 'Spelled differently' : 'Did you mean'} counted={false} items={[...nearBars, ...nearPeople]} render={(r) => ('job' in r ? personRow(r) : barRow(r))} />
      </View>
      {search.trim().length >= 2 && !found && !nearBars.length && !nearPeople.length ? <Caption tone="muted">No bar or person by that name.</Caption> : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.lg },
});
