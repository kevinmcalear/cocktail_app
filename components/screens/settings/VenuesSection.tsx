import { useRouter, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Body, LogoImage, useDisplayFaces, useDs } from '@/components/ds';
import { useTeamCard } from '@/components/nav/TeamCard';
import { logoFill } from '@/components/nav/VenueMarks';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { backbar, radius, space, type, type DisplayFace } from '@/constants/tokens';
import { accentFill } from '@/lib/color';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useHereVenue } from '@/hooks/useMode';
import { roleLabel } from '@/lib/roles';
import { teamLine } from '@/lib/shellNav';
import { startedSetup } from '@/lib/venueSetup';
import { useVenueSetup } from '@/store/useVenueSetup';

const LOGO = 32;

/** My team for the venue you're in, first in Venues (tools-settings-team-row). Employee and up. */
function TeamRow() {
  const router = useRouter();
  const here = useHereVenue();
  const { see, members, invites } = useTeamCard(here?.id ?? null);
  if (!here || !see) return null;
  return (
    <>
      <SettingsRow
        icon="person.2.fill"
        label="My team"
        detail={[here.name, members ? teamLine(members.length, invites.length) : null].filter(Boolean).join(' · ')}
        onPress={() => router.push('/team' as Href)}
      />
      <RowDivider />
    </>
  );
}

/**
 * My team where you are, the venues you belong to, each opening its own
 * settings page, and setting up a new one (venue setup, b03): a setup already
 * started opens where it stopped instead of making a second bar (owner-setup call 5).
 */
export function VenuesSection() {
  const router = useRouter();
  const { venues, isLoading } = useActiveVenue();
  const started = startedSetup(useVenueSetup((s) => s.runs));

  return (
    <SettingsSection title="Venues" note="Each venue has its own brand, roles and team.">
      <TeamRow />
      {isLoading ? <ListRowsSkeleton rows={2} /> : null}
      {!isLoading && venues.length === 0 ? <Body tone="muted" style={styles.empty}>You’re not on a venue’s team yet.</Body> : null}
      {venues.map((v, i) => (
        <View key={v.id}>
          {i > 0 ? <RowDivider /> : null}
          <SettingsRow
            label={v.name}
            detail={roleLabel(v.roleLevel)}
            leading={v.logoUrl ? <LogoImage uri={v.logoUrl} size={LOGO} radius={styles.logo.borderRadius} fill={logoFill(v)} /> : <VenueTile name={v.name} accent={v.accent} face={v.displayFace} />}
            onPress={() => router.push(`/settings/bar/${v.id}` as Href)}
          />
        </View>
      ))}
      {venues.length > 0 || isLoading ? <RowDivider /> : null}
      <SettingsRow label="Create a venue" icon="plus" role="button" trailing={<View />} onPress={() => router.push((started ?? '/venue-setup') as Href)} />
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
