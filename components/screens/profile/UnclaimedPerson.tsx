import { StyleSheet, View } from 'react-native';

import { Caption, Tag, Title, useBreakpoint } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import type { Profile } from '@/hooks/useProfiles';

import { MadeByList, useMadeBy, WorkedAt } from './MadeBy';
import { Stat, Stats } from './ProfileSections';
import { ThisIsMe } from './ThisIsMe';

/**
 * Someone's page nobody has claimed yet (find-yourself step 3): who they are
 * and where, "5 drinks credited · 2 bars · 2 menus", where they worked and
 * when, then everything credited to them, grouped by bar and menu. On a wide
 * screen "Are you Ash?" sits under the numbers and Made by beside them; on a
 * phone This is me and Not me are pinned to the bottom (ProfileScreen).
 */
export function UnclaimedPerson({ profile }: { profile: Profile }) {
  const wide = useBreakpoint() !== 'phone';
  const made = useMadeBy(profile);
  const bar = made.positions.find((p) => p.is_current)?.bar.display_name;
  const place = [bar, profile.locality || profile.city].filter(Boolean).join(', ');
  const { drinks, bars, menus } = made.stats;
  const about = (
    <View style={styles.column}>
      <View style={styles.header}>
        <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={64} />
        <View style={styles.name}>
          <Title>{profile.display_name}</Title>
          {place ? <Caption tone="muted">{place}</Caption> : null}
          <Tag label="Not claimed yet" />
        </View>
      </View>
      <Stats ruled>
        <Stat value={drinks} label={drinks === 1 ? 'drink credited' : 'drinks credited'} ruled />
        <Stat value={bars} label={bars === 1 ? 'bar' : 'bars'} ruled />
        <Stat value={menus} label={menus === 1 ? 'menu' : 'menus'} ruled />
      </Stats>
      {wide ? <WorkedAt made={made} /> : null}
      {wide ? <ThisIsMe profile={profile} /> : null}
    </View>
  );
  return (
    <View style={wide ? styles.columns : styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      {about}
      <View style={wide ? styles.main : styles.body}>
        <MadeByList name={profile.display_name} made={made} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.xxl },
  column: { flexGrow: 1, flexShrink: 1, flexBasis: 280, maxWidth: 360, gap: space.xl },
  main: { flexGrow: 2, flexShrink: 1, flexBasis: 360, minWidth: 0, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  name: { flex: 1, minWidth: 0, gap: space.xs },
});
