import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { layout, space } from '@/constants/tokens';

import { PhotoEdge } from './PhotoMirror';

/** The pane's width from which the page splits in two (desktop board: 1200 up, less the sidebar). */
export const COLUMNS_FROM = 900;
/** The left column: the drawing at up to 400, the name under it. */
const SIDE = 440;
/** The spec column's reading width. */
const TEXT = 640;

interface DrinkColumnsProps {
  /** The drawing, name and the one action; or the photo panel, full height. */
  side: ReactNode;
  /** Runs across the page behind both columns: the sky. */
  behind?: ReactNode;
  /** The spec and the rest. */
  children: ReactNode;
  /** A photo fills its panel edge to edge and fades into the mirror behind the spec; a drawing sits in the gutter. */
  photo?: boolean;
  top: number;
  gutter: number;
}

/**
 * The drink page from 1200 up (canvas GWBCX, Desktop and web, "sticky side
 * column"): the picture, the name and the one action stay put on the left;
 * only the spec column scrolls. Nothing shrinks or animates, and a long spec
 * never loses its picture. Chosen by the pane's own width, not the window's,
 * so beside the Drinks list (460) the page keeps one column until there's
 * room for two.
 */
export function DrinkColumns({ side, behind, children, photo, top, gutter }: DrinkColumnsProps) {
  const bar = top + layout.minTapTarget + space.sm * 2;
  return (
    <View style={styles.row}>
      {behind}
      <View style={[styles.side, photo ? styles.photo : { paddingTop: bar, paddingLeft: gutter }]}>
        {side}
        {photo ? <PhotoEdge /> : null}
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: bar + space.lg, paddingBottom: space.xxxl, paddingHorizontal: gutter + space.lg }}>
        <View style={styles.text}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  side: { width: SIDE, gap: space.lg },
  photo: { width: layout.photoPanel, overflow: 'hidden' },
  flex: { flex: 1 },
  text: { maxWidth: TEXT, width: '100%' },
});
