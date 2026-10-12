import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body } from '@/components/ds';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { roleLabel } from '@/lib/roles';

const LOGO = 32;

/** The venues you belong to, each opening its own settings page, and setting up a new one (venue setup, b03). */
export function VenuesSection() {
  const router = useRouter();
  const { venues, isLoading } = useActiveVenue();

  return (
    <SettingsSection title="Venues" note="Each venue has its own brand, roles and team.">
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
      <SettingsRow label="Set up your bar" icon="plus" role="button" trailing={<View />} onPress={() => router.push('/venue-setup' as Href)} />
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: space.md },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.mark },
});
