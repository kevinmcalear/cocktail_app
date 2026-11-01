import { useDeferredValue, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BreakpointOverride, Caption, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { previewItem } from '@/lib/editPreview';
import type { SketchInputs } from '@/lib/sketch/types';
import type { DatabaseItem } from '@/types/types';

import { DrinkScreen } from '../DrinkScreen';
import type { DrinkEditor } from './EditParts';

const PHONE_WIDTH = layout.phoneFrame;
const PHONE_HEIGHT = 780;
/** How wide the window must be for the preview to sit beside the hero card (400) and a form of at least 480. */
export const PREVIEW_ROOM = 400 + 480 + PHONE_WIDTH + space.xxl * 4;
// Everything shows: the preview is the finished page as its team reads it (the role levels are what the page masks by).
const OPEN = { role: 40, levels: { generic: 0, brand: 0, measurement: 0, prep: 0 } };
// The web keeps it in view while the form scrolls past.
const STICKY = Platform.OS === 'web' ? ({ position: 'sticky', top: space.xl } as object) : null;

/**
 * The finished drink as a phone shows it (jam decision dec-23): the real
 * drink page in a phone-sized frame, in its preview mode, so nothing on it
 * saves, and it reads nothing of the drink's people, scores, menus or your
 * collection. `photo` leads the hero; with none, `sketch` draws it (else the
 * saved drawing). It redraws only when what it shows changes, and after the
 * keystroke (useDeferredValue), so typing stays quick.
 */
export function PhoneFrame(props: { item: DatabaseItem; photo?: string | null; sketch?: SketchInputs | null; sticky?: boolean }) {
  const ds = useDs();
  // A new object each render from the same draft: compared by what it says.
  const json = JSON.stringify([props.item, props.photo ?? null, props.sketch ?? null]);
  const shown = useDeferredValue(useMemo(() => JSON.parse(json) as [DatabaseItem, string | null, SketchInputs | null], [json]));
  const [item, photo, sketch] = shown;
  const { sticky } = props;
  // The whole phone in view: shorter on a short window.
  const height = Math.min(PHONE_HEIGHT, useWindowDimensions().height - space.xxxl * 3);
  return (
    <View style={[styles.column, sticky && STICKY]}>
      <Caption tone="muted">On a phone</Caption>
      <View accessibilityLabel="Preview of the drink page on a phone" style={[styles.frame, { height, borderColor: ds.c.lineStrong, backgroundColor: ds.c.ground }]}>
        <BreakpointOverride value="phone">
          <DrinkScreen item={item} pane preview={{ ...OPEN, heroSource: photo ?? null, sketch }} canEdit={false} onEdit={() => {}} inStudyPile={false} onToggleStudyPile={() => {}} />
        </BreakpointOverride>
      </View>
    </View>
  );
}

/**
 * Desktop editing's right side: the drink as saved with the edits laid over
 * it, redrawn as you type.
 * ponytail: drafts from the older editor have no saved drink to lay over, so they get none.
 */
export function PhonePreview({ editor, saved }: { editor: DrinkEditor; saved: DatabaseItem }) {
  return <PhoneFrame item={previewItem(editor, saved)} photo={editor.localImages[0]?.url} sticky />;
}

const styles = StyleSheet.create({
  column: { width: PHONE_WIDTH, gap: space.sm, alignItems: 'center' },
  frame: { width: PHONE_WIDTH, borderRadius: radius.sheet, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
