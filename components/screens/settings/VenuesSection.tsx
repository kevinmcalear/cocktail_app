import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Body, useDisplayFaces, useDs } from '@/components/ds';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { backbar, radius, space, type, type DisplayFace } from '@/constants/tokens';
import { accentFill } from '@/lib/color';
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
            leading={v.logoUrl ? <Image source={{ uri: v.logoUrl }} style={styles.logo} /> : <VenueTile name={v.name} accent={v.accent} face={v.displayFace} />}
            onPress={() => router.push(`/settings/bar/${v.id}` as Href)}
          />
        </View>
      ))}
      {venues.length > 0 || isLoading ? <RowDivider /> : null}
      <SettingsRow label="Create a venue" icon="plus" role="button" trailing={<View />} onPress={() => router.push('/venue-setup' as Href)} />
    </SettingsSection>
  );
}

/** A venue without a logo: its initial in its display face's italic on its accent (tools-settings-phone). */
function VenueTile({ name, accent, face }: { name: string; accent: string | null; face: DisplayFace }) {
  const ds = useDs();
  const family = useDisplayFaces([face]);
  return (
    <View aria-hidden style={[styles.logo, styles.tile, { backgroundColor: accent ?? ds.c.raised }]}>
      <Text style={[styles.initial, { fontFamily: family(face, 'italic'), color: accent ? accentFill(accent, backbar.light.ink, backbar.dark.ink).text : ds.c.ink }]} allowFontScaling={false}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: type.headline.fontSize, lineHeight: LOGO },
  empty: { paddingVertical: space.md },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.control - space.xs + 1 },
});
