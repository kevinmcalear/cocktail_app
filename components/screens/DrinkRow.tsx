import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, Headline, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';

export interface DrinkRowProps {
  name: string;
  href: string;
  imageUrl: string | null;
  /** CustomIcons glass key for the drawn placeholder. */
  glass: string | null;
  caption?: string;
}

/** A drink in a list: thumbnail and name, opening the drink page. */
export function DrinkRow({ name, href, imageUrl, glass, caption }: DrinkRowProps) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityLabel={`${name}, open`}
      onPress={() => router.push(href as never)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <View style={styles.thumb}>
        <DrinkImage source={imageUrl} glass={glass} accessibilityLabel={name} radius="control" hideTag />
      </View>
      <View style={styles.text}>
        <Headline numberOfLines={1}>{name}</Headline>
        {caption ? <Caption tone="muted">{caption}</Caption> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56 },
  text: { flex: 1, gap: 2 },
});
