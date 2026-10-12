import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useMakerGlassBars } from '@/hooks/useMakers';
import { andList } from '@/lib/makers';

/**
 * On a glass maker's page: the bars that pour into its glasses, from the
 * glassware each bar lists (bar_glassware). Nothing when none do.
 */
export function MakerGlassBars({ profileId, name }: { profileId: string; name: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data: bars = [] } = useMakerGlassBars(profileId);
  if (!bars.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">In bars</Headline>
      <Caption tone="muted">{`Bars that pour into ${name}’s glasses.`}</Caption>
      <View role="list">
        {bars.map((b) => (
          <PressableScale
            key={b.id}
            role="link"
            accessibilityLabel={`${b.display_name}, ${andList(b.glasses)}`}
            onPress={() => router.push(`/p/${b.handle}` as Href)}
            style={[styles.row, { borderBottomColor: ds.c.line }]}
          >
            <Body numberOfLines={1}>{b.display_name}</Body>
            <Caption tone="muted" numberOfLines={1}>
              {andList(b.glasses)}
            </Caption>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  row: { gap: space.xs, minHeight: 56, justifyContent: 'center', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
