import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, Headline, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';

export interface DrinkRowProps {
  name: string;
  /** Opens this page, unless onPress does something else. */
  href?: string;
  onPress?: () => void;
  imageUrl: string | null;
  /** CustomIcons glass key for the drawn placeholder. */
  glass: string | null;
  caption?: string;
  /** A second, longer line: a note of your own. */
  note?: string;
  /** At the end of the row: a score. Say it in `caption` or `label` too, for screen readers. */
  trailing?: ReactNode;
  /** What a screen reader hears, when it should say more than the name, caption and note. */
  label?: string;
}

/** A drink in a list: thumbnail and name, opening the drink page. */
export function DrinkRow({ name, href, onPress, imageUrl, glass, caption, note, trailing, label }: DrinkRowProps) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityLabel={`${label ?? [name, caption, note].filter(Boolean).join('. ')}, open`}
      onPress={onPress ?? (() => href && router.push(href as never))}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <View style={styles.thumb}>
        <DrinkImage source={imageUrl} glass={glass} accessibilityLabel={name} radius="control" hideTag />
      </View>
      <View style={styles.text}>
        <Headline numberOfLines={1}>{name}</Headline>
        {caption ? <Caption tone="muted">{caption}</Caption> : null}
        {note ? (
          <Caption numberOfLines={2}>
            {note}
          </Caption>
        ) : null}
      </View>
      {trailing}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56 },
  text: { flex: 1, gap: 2 },
});
