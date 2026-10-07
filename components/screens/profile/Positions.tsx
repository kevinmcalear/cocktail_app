import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useProfilePositions, type Position, type Profile } from '@/hooks/useProfiles';

/**
 * Only where someone works now. Past jobs (many from public research on
 * unclaimed profiles) stay off until the person opts in.
 * ponytail: no opt-in yet, so past jobs never show. The upgrade is a
 * per-job switch the person turns on.
 */
export const isShownPosition = (p: Pick<Position, 'is_current'>) => p.is_current;

/**
 * "Works at" on a person, "People" on a bar. Each row opens the other
 * profile. With emptyText it fills a tab: no heading, and a line when empty.
 */
export function Positions({ profile, emptyText }: { profile: Pick<Profile, 'id' | 'kind'>; emptyText?: string }) {
  const ds = useDs();
  const router = useRouter();
  // Filtered here, not in the query, so a persisted cache from before can't show them either.
  const positions = (useProfilePositions(profile).data ?? []).filter(isShownPosition);
  if (!positions.length) return emptyText ? <Body tone="muted">{emptyText}</Body> : null;
  const onPerson = profile.kind === 'person';
  return (
    <View style={styles.section}>
      {emptyText ? null : (
        <Caption tone="muted" style={styles.cap}>
          {onPerson ? 'Works at' : 'People'}
        </Caption>
      )}
      <View role="list">
        {positions.map((p) => {
          const other = onPerson ? p.bar : p.person;
          const title = p.is_current ? p.title : `Formerly ${p.title.charAt(0).toLowerCase()}${p.title.slice(1)}`;
          return (
            <PressableScale
              key={p.id}
              role="link"
              accessibilityLabel={`${other.display_name}, ${title}. Open their profile`}
              onPress={() => router.push(`/p/${other.handle}` as Href)}
              style={[styles.row, { borderBottomColor: ds.c.line }]}
            >
              <UserAvatar uri={other.avatar_url} name={other.display_name} size={40} />
              <View style={styles.flex}>
                <DsText variant="headline" numberOfLines={1}>
                  {other.display_name}
                </DsText>
                <Caption tone="muted" numberOfLines={1}>
                  {title}
                </Caption>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
