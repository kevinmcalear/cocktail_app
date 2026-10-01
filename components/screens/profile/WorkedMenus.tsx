import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useWorkedMenus } from '@/hooks/useProfiles';

/** Menus this person worked on, including at a bar that has closed. */
export function WorkedMenus({ profileId }: { profileId: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data: menus = [] } = useWorkedMenus(profileId);
  if (!menus.length) return null;
  return (
    <View style={styles.section}>
      <Caption tone="muted" style={styles.cap}>
        Menus
      </Caption>
      <View role="list">
        {menus.map((m) => {
          const when = [m.bar.display_name, m.bar.is_closed ? 'closed' : null, m.year].filter(Boolean).join(' · ');
          return (
            <PressableScale
              key={m.id}
              role="link"
              accessibilityLabel={`${m.name}, ${when}. Open the bar's profile`}
              onPress={() => router.push(`/p/${m.bar.handle}` as Href)}
              style={[styles.row, { borderBottomColor: ds.c.line }]}
            >
              <View style={styles.flex}>
                <DsText variant="headline" numberOfLines={1}>
                  {m.name}
                </DsText>
                <Caption tone="muted" numberOfLines={1}>
                  {when}
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
  row: { minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
});
