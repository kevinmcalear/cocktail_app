import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Display } from '@/components/ds';
import { space } from '@/constants/tokens';

import { ItalicLine, useTitleShadow } from './ItalicLine';

export { ItalicLine, TitleOnPhoto, useItalic, useTitleShadow } from './ItalicLine';

/**
 * The name block every drink and item page opens with (boards Decided-who-*,
 * Item-page): an eyebrow ("Caretaker's · House spec", "Beer · Pilsner"), the
 * name in the display face, then the credit in its italic. `credit` is a line
 * of text or a richer node (the drink's linked credit); `children` follow it.
 */
export function ItemTitle({ eyebrow, name, credit, children }: { eyebrow: string | null; name: string; credit?: ReactNode; children?: ReactNode }) {
  const shadow = useTitleShadow();
  return (
    <View style={styles.title}>
      {eyebrow ? (
        <Caption tone="muted" style={[styles.eyebrow, shadow]}>
          {eyebrow}
        </Caption>
      ) : null}
      <Display style={shadow}>{name}</Display>
      {typeof credit === 'string' ? <ItalicLine text={credit} /> : credit}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { gap: space.xs },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
