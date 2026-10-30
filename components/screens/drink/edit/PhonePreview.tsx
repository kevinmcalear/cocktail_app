import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BreakpointOverride, Caption, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { previewItem } from '@/lib/editPreview';
import type { DatabaseItem } from '@/types/types';

import { DrinkScreen } from '../DrinkScreen';
import type { DrinkEditor } from './EditParts';

/** About an iPhone's screen, in points. */
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 780;
/** How wide the window must be for the preview to sit beside the hero card (400) and a form of at least 480. */
export const PREVIEW_ROOM = 400 + 480 + PHONE_WIDTH + space.xxl * 4;
// Everything shows: the preview is the finished page as its team reads it (the role levels are what the page masks by).
const OPEN = { role: 40, levels: { generic: 0, brand: 0, measurement: 0, prep: 0 } };
// The web keeps it in view while the form scrolls past.
const STICKY = Platform.OS === 'web' ? ({ position: 'sticky', top: space.xl } as object) : null;

/**
 * Desktop editing's right side (jam decision dec-23): the finished drink as a
 * phone shows it, the real drink page in a phone-sized frame, redrawn as you
 * edit. A preview, so nothing on it saves or reaches the network for the
 * drink's people, scores or menus.
 * ponytail: drafts from the older editor have no saved drink to lay over, so they get none.
 */
export function PhonePreview({ editor, saved }: { editor: DrinkEditor; saved: DatabaseItem }) {
  const ds = useDs();
  const photo = editor.localImages[0]?.url ?? null;
  // The whole phone in view: shorter on a short window.
  const height = Math.min(PHONE_HEIGHT, useWindowDimensions().height - space.xxxl * 3);
  return (
    <View style={[styles.column, STICKY]}>
      <Caption tone="muted">On a phone</Caption>
      <View accessibilityLabel="Preview of the drink page on a phone" style={[styles.frame, { height, borderColor: ds.c.lineStrong, backgroundColor: ds.c.ground }]}>
        <BreakpointOverride value="phone">
          <DrinkScreen item={previewItem(editor, saved)} pane preview={{ ...OPEN, heroSource: photo }} canEdit={false} onEdit={() => {}} inStudyPile={false} onToggleStudyPile={() => {}} />
        </BreakpointOverride>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: PHONE_WIDTH, gap: space.sm, alignItems: 'center' },
  frame: { width: PHONE_WIDTH, borderRadius: radius.sheet, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
