import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Field } from '@/components/ds';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateOnboardingBar } from '@/hooks/useOnboarding';
import { showMessage } from '@/lib/dialogs';
import { roleLabel } from '@/lib/roles';

const LOGO = 32;

/** The venues you belong to, each opening its own settings page, and making a new one. */
export function VenuesSection() {
  const router = useRouter();
  const make = useCreateOnboardingBar();
  const { venues, isLoading } = useActiveVenue();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = () =>
    make.mutate(name, {
      onSuccess: () => {
        setName('');
        setCreating(false);
      },
      onError: (e) => showMessage('The venue wasn’t made', e.message),
    });

  return (
    <SettingsSection title="Venues" note="Each venue has its own brand, access levels and team.">
      {isLoading ? <ListRowsSkeleton rows={2} /> : null}
      {!isLoading && venues.length === 0 ? <Body tone="muted" style={styles.empty}>You’re not on a venue’s team yet.</Body> : null}
      {venues.map((v, i) => (
        <View key={v.id}>
          {i > 0 ? <RowDivider /> : null}
          <SettingsRow
            label={v.name}
            detail={roleLabel(v.roleLevel)}
            icon="building.2.fill"
            leading={v.logoUrl ? <Image source={{ uri: v.logoUrl }} style={styles.logo} /> : undefined}
            onPress={() => router.push(`/settings/bar/${v.id}` as Href)}
          />
        </View>
      ))}
      {venues.length > 0 || isLoading ? <RowDivider /> : null}
      {creating ? (
        <View style={styles.create}>
          <Field label="Venue name" value={name} onChangeText={setName} placeholder="The Corner Bar" autoFocus />
          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={() => { setCreating(false); setName(''); }} />
            <Button label={make.isPending ? 'Creating…' : 'Create venue'} onPress={create} disabled={make.isPending || !name.trim()} />
          </View>
        </View>
      ) : (
        <SettingsRow label="Create a venue" icon="plus" role="button" trailing={<View />} onPress={() => setCreating(true)} />
      )}
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: space.md },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.mark },
  create: { gap: space.md, paddingVertical: space.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
});
