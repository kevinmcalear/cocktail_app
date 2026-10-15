import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Caption, DsText, GlassSurface, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, fontFamilies, layout, radius, space } from '@/constants/tokens';

export interface EditToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDone: () => void;
  saving: boolean;
  /** Desktop: a row in the page's header with Done as a pill, not glass over the hero. */
  wide?: boolean;
  /** Desktop's header: the More button, before Done. */
  more?: React.ReactNode;
  /** What the phone's glass sits on: the cream sketch paper (light glass) or a photo (dark). */
  media?: 'paper' | 'photo';
}

function HistoryButtons({ canUndo, canRedo, onUndo, onRedo, ink }: Pick<EditToolbarProps, 'canUndo' | 'canRedo' | 'onUndo' | 'onRedo'> & { ink: string }) {
  return (
    <>
      <PressableScale role="button" accessibilityLabel="Undo" aria-disabled={!canUndo} disabled={!canUndo} onPress={onUndo} style={[styles.icon, !canUndo && styles.off]}>
        <IconSymbol name="arrow.uturn.backward" size={20} color={ink} />
      </PressableScale>
      <PressableScale role="button" accessibilityLabel="Redo" aria-disabled={!canRedo} disabled={!canRedo} onPress={onRedo} style={[styles.icon, !canRedo && styles.off]}>
        <IconSymbol name="arrow.uturn.backward" size={20} color={ink} style={styles.flip} />
      </PressableScale>
    </>
  );
}

/**
 * Editing's toolbar (drink-edit-phone, drink-edit-desktop): undo and redo,
 * "Editing", and Done, which saves. On phones it floats in glass over the
 * hero; on desktop it's the header row.
 */
export function EditToolbar(props: EditToolbarProps) {
  const ds = useDs();
  const { onDone, saving, wide, more, media = 'photo' } = props;
  const scheme = media === 'paper' ? 'light' : 'dark';
  const ink = backbar[scheme].ink;
  const done = (
    <PressableScale
      role="button"
      accessibilityLabel={saving ? 'Saving' : 'Done editing, save'}
      disabled={saving}
      onPress={onDone}
      style={[wide ? styles.donePill : styles.doneRound, { backgroundColor: ds.accentFill.fill }]}
    >
      {saving ? (
        <ActivityIndicator color={ds.accentFill.text} />
      ) : wide ? (
        <>
          <DsText variant="label" color={ds.accentFill.text} style={styles.bold}>
            Done
          </DsText>
          <DsText variant="caption" color={ds.accentFill.text} style={styles.keys}>
            ⌘↵
          </DsText>
        </>
      ) : (
        <IconSymbol name="checkmark" size={22} color={ds.accentFill.text} />
      )}
    </PressableScale>
  );

  if (wide) {
    return (
      <View style={styles.wideRow}>
        <View style={[styles.badge, { backgroundColor: ds.c.raised }]}>
          <Caption tone="muted">Editing</Caption>
        </View>
        <View style={styles.push} />
        <HistoryButtons {...props} ink={ds.c.ink} />
        {more}
        {done}
      </View>
    );
  }
  return (
    <View style={styles.phoneRow}>
      <GlassSurface scheme={scheme} style={styles.pill}>
        <HistoryButtons {...props} ink={ink} />
      </GlassSurface>
      <GlassSurface scheme={scheme} style={styles.badgeGlass}>
        <DsText variant="label" color={ink}>
          Editing
        </DsText>
      </GlassSurface>
      {done}
    </View>
  );
}

const styles = StyleSheet.create({
  phoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', borderRadius: radius.pill, paddingHorizontal: space.xs },
  badgeGlass: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs + 2 },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.4 },
  flip: { transform: [{ scaleX: -1 }] },
  doneRound: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  donePill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill },
  bold: { fontFamily: fontFamilies.bodySemiBold },
  keys: { fontFamily: fontFamilies.monoMedium, opacity: 0.7 },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  badge: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  push: { flex: 1 },
});
