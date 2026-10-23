import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, IngredientDrawing, PressableScale, useDs } from '@/components/ds';
import { IngredientPhoto } from '@/components/ds/IngredientDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { IngredientEditor } from '@/hooks/useIngredientEditor';
import { PICTURE_LABEL } from '@/lib/ingredientPicture';

import { PictureSheet } from './PictureSheet';

const TILE = 96;

/**
 * The picture beside the name on the edit pages. For an ingredient its editor
 * owns (canChoosePicture), a button in the accent ring with a pencil that
 * opens "Its picture", and a caption under the row naming the choice. Saved
 * with the page's Save. Anything else (a catalogue bottle, a draft) keeps its
 * drawing, as before.
 */
export function usePictureTile(editor: IngredientEditor): { tile: ReactNode; caption: ReactNode; sheet: ReactNode } {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const { form, set } = editor;
  const id = editor.draftId ? null : editor.selfId;
  const name = form.name || form.generic?.name || 'Ingredient';

  if (!editor.canChoosePicture || !id) {
    const tile = (
      <View style={[styles.still, { backgroundColor: ds.c.paper }]} accessibilityLabel={`Drawing of ${form.name || 'the ingredient'}`}>
        <IngredientDrawing id={id} name={name} drawn />
      </View>
    );
    return { tile, caption: null, sheet: null };
  }

  const label = PICTURE_LABEL[form.picture];
  const tile = (
    <PressableScale role="button" accessibilityLabel={`Change its picture. Now: ${label}`} onPress={() => setOpen(true)} style={[styles.tile, { borderColor: ds.accentFill.fill, backgroundColor: ds.c.paper }]}>
      <View style={styles.art}>
        {form.picture === 'photo' && form.photo ? <IngredientPhoto url={form.photo} /> : form.picture === 'none' ? null : <IngredientDrawing id={id} name={name} drawn />}
      </View>
      <View aria-hidden style={[styles.badge, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="pencil" size={15} color={ds.c.ink} />
      </View>
    </PressableScale>
  );
  const caption = (
    <Caption tone="muted" style={styles.caption}>
      {`${label} · tap to change`}
    </Caption>
  );
  const sheet = open ? <PictureSheet itemId={id} name={name} value={{ picture: form.picture, photo: form.photo }} onDone={(c) => set(c)} onClose={() => setOpen(false)} /> : null;
  return { tile, caption, sheet };
}

const styles = StyleSheet.create({
  still: { width: 72, height: 72, borderRadius: radius.control, overflow: 'hidden' },
  tile: { width: TILE, height: TILE, borderRadius: radius.card, borderWidth: 2, borderCurve: 'continuous' },
  art: { flex: 1, borderRadius: radius.card - 2, overflow: 'hidden' },
  badge: { position: 'absolute', right: -space.sm, bottom: -space.sm, width: 32, height: 32, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  // Clear of the pencil badge, which hangs below the tile.
  caption: { alignSelf: 'flex-end', marginTop: space.xs },
});
