import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field } from '@/components/ds';
import { ResultRow } from '@/components/search/ResultRows';
import { AddBarForm } from '@/components/screens/home/AddBar';
import { space } from '@/constants/tokens';
import { useClaimableBars, type ClaimableBar } from '@/hooks/useVenueSetup';

import { SetupPage } from './SetupPage';
import { SetupHead } from './SetupParts';

/** "214 Smith St, Fitzroy · on Cocktail, 24 drinks". */
function barLine(b: ClaimableBar): string {
  const where = [b.address_line, b.locality ?? b.city].filter(Boolean).join(', ');
  return [where || b.bar_type || 'Bar', b.drinks ? `on Cocktail, ${b.drinks} drink${b.drinks === 1 ? '' : 's'}` : 'on Cocktail'].join(' · ');
}

/**
 * "Find your bar" on the owner's path (owner-setup step 2): one field, bars
 * only, by name or street. A listed bar opens its page, where the claim runs
 * venue setup for it; a bar that isn't here is added with its address.
 */
export function OwnerFindStep({ onAdd, onSkip }: { onAdd: (typed: string) => void; onSkip: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const found = useClaimableBars(search);
  const bars = found.data ?? [];
  const searched = search.trim().length >= 2;
  return (
    <SetupPage footer={<Button label="Not now" variant="ghost" onPress={onSkip} />}>
      <Field label="Bar name or street" icon="magnifyingglass" value={search} onChangeText={setSearch} placeholder="Little Rye, or Smith Street" autoCorrect={false} />
      {bars.length ? (
        <View style={styles.group}>
          <SetupHead>On Cocktail</SetupHead>
          {bars.map((b) => (
            <ResultRow
              key={b.id}
              title={b.display_name}
              caption={barLine(b)}
              avatar={{ uri: b.avatar_url, bar: { profileId: b.id } }}
              badge={b.claimed ? undefined : 'Not claimed yet'}
              tag={b.claimed ? 'Claimed' : undefined}
              query={search}
              onPress={() => router.push(`/p/${b.handle || b.id}` as Href)}
            />
          ))}
        </View>
      ) : null}
      {searched && found.data?.length === 0 ? <Caption tone="muted">No bar on Cocktail by that name or street.</Caption> : null}
      <View style={styles.group}>
        <SetupHead>Not on Cocktail yet</SetupHead>
        <ResultRow title="My bar isn’t here" caption="Add it with its address" icon="plus" accentIcon onPress={() => onAdd(search)} />
      </View>
    </SetupPage>
  );
}

/** Adding a bar that isn't on Cocktail (owner-setup step 3): its name and address, once, then venue setup. */
export function OwnerAddStep({ initialName, onAdded }: { initialName: string; onAdded: (profileId: string) => void }) {
  const router = useRouter();
  return (
    <SetupPage>
      <AddBarForm initialName={initialName} submitLabel="Set it up" onAdded={(v) => onAdded(v.id)} onOpenExisting={(id) => router.push(`/p/${id}` as Href)} />
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
});
