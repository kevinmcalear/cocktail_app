import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { BrandProvider, Caption, Sheet, SheetScrollView, useBreakpoint, useDisplayFaces, useSheetClose } from '@/components/ds';
import { DEFAULT_ACCENT, displayFaces, font, nameStyle, space, type DisplayFace } from '@/constants/tokens';
import { useDialogStore } from '@/store/useDialogStore';

import type { BrandLook } from '../BrandPreview';
import { DialogBar, DialogHead, FlowHead } from './FlowHead';
import { Card, FaceHead, faceCount, FACES, FaceTiles, GroupLabel, MOOD, NAMES_NOTE, StyleChips, type PickerLook, type SetFace } from './TypeParts';

/** The web dialog's two columns (canvas Theme-type, web): the preview, then the choices. */
const WIDE_WIDTH = 900;
const PREVIEW_COLUMN = 380;

interface Props {
  visible: boolean;
  onClose: () => void;
  look: BrandLook;
  value: DisplayFace;
  onUse: (face: DisplayFace) => void;
}

/**
 * Type for names, picker A (canvas Theme-type, Kevin picked A on 30 Oct): the
 * bar's own name and menu, changing with every tap; then a style, each chip
 * written in its own face; then the faces in that style as Aa tiles. Done
 * keeps the pick; closing any other way with a new face asks "Discard
 * changes?" first. The phone's sheet, Android's full-screen dialog with
 * Material 3 chips, and on the wide web a dialog with the preview beside the
 * choices; at phone width the web fills the window and stacks like the phone.
 */
export function TypeSheet({ visible, onClose, look, value, onUse }: Props) {
  const [face, setFace] = useState(value);
  const breakpoint = useBreakpoint();
  const kind: PickerLook = Platform.OS === 'android' ? 'android' : Platform.OS === 'web' && breakpoint !== 'phone' ? 'wide' : 'phone';
  // Every face shows here, so all of them load while the picker is open.
  const family = useDisplayFaces(visible ? FACES : []);
  const set: SetFace = (f, size) => ({ ...nameStyle(f, size), fontFamily: family(f) });
  const accent = look.accent ?? DEFAULT_ACCENT;
  const done = () => onUse(face);

  // The web: Enter is Done, Esc cancels (the Sheet's own), while no question is up.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || useDialogStore.getState().queue.length) return;
      e.preventDefault();
      onUse(face);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, face, onUse]);

  const parts = { face, set, onPick: setFace };
  const card = (
    <BrandProvider accent={accent} groundTint={look.groundTint} displayFace={face}>
      <Card look={look} face={face} set={set} wide={kind === 'wide'} />
    </BrandProvider>
  );
  const chips = <StyleChips look={kind} accent={accent} {...parts} />;
  const mood = <Caption tone="muted">{MOOD[displayFaces[face].style]}</Caption>;
  const tiles = <FaceTiles look={kind} {...parts} />;
  const note = <Caption tone="muted">{NAMES_NOTE}</Caption>;

  return (
    <Sheet visible={visible} onClose={onClose} onShow={() => setFace(value)} accessibilityLabel="Type" kind="flow" ground phoneFull dirty={face !== value} style={kind === 'wide' ? styles.wide : undefined}>
      {/* The one prominent action, and the chosen face's ring, in the bar's colour. */}
      <BrandProvider accent={accent}>
        {kind === 'wide' ? (
          <>
            <DialogHead title="Type" onDone={done} />
            <SheetScrollView contentContainerStyle={styles.columns}>
              <View style={styles.previewColumn}>
                {card}
                {note}
              </View>
              <View style={styles.choices}>
                <Caption tone="muted" style={styles.strong}>Style</Caption>
                {chips}
                {mood}
                <FaceHead face={face} wide />
                {tiles}
                <Caption tone="muted">Tab to a group, arrow keys to move inside it, Enter for Done, Esc to cancel.</Caption>
              </View>
            </SheetScrollView>
          </>
        ) : kind === 'android' ? (
          <>
            <AndroidBar onSave={done} />
            <SheetScrollView contentContainerStyle={styles.android}>
              {card}
              <GroupLabel label="Style" />
              {chips}
              {mood}
              <GroupLabel label="Face" detail={[displayFaces[face].label, faceCount(face)].filter(Boolean).join(' · ')} />
              {tiles}
              {note}
            </SheetScrollView>
          </>
        ) : (
          <>
            <FlowHead title="Type" onDone={done} />
            <SheetScrollView contentContainerStyle={styles.body}>
              {card}
              <FaceHead face={face} />
              {chips}
              {mood}
              {tiles}
              {note}
            </SheetScrollView>
          </>
        )}
      </BrandProvider>
    </Sheet>
  );
}

/** Android's bar: X closes the way back does (asking first if the face changed), Save keeps it. */
function AndroidBar({ onSave }: { onSave: () => void }) {
  const close = useSheetClose();
  return <DialogBar title="Type" onClose={close} onSave={onSave} />;
}

const styles = StyleSheet.create({
  body: { gap: space.lg, padding: space.lg, paddingBottom: space.xxxl },
  android: { gap: space.md + 2, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
  wide: { maxWidth: WIDE_WIDTH },
  columns: { flexDirection: 'row', gap: space.xxl, padding: space.xl + space.xs },
  previewColumn: { width: PREVIEW_COLUMN, gap: space.md + 2 },
  choices: { flex: 1, minWidth: 0, gap: space.lg },
  strong: { ...font.semiBold },
});
