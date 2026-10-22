import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandProvider, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEFAULT_ACCENT, fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import { NoteSheet, type NoteAbout } from './NoteSheet';

/** What a note is sent with, besides its screen: the drink, its draft and the bar (with its name, for the sheet). */
export type TellUsAbout = Omit<NoteAbout, 'screen'>;

interface TellUsProps extends TellUsAbout {
  screen: string;
  /** What we'll add: "We'll add your ice to the app." */
  line: string;
}

/**
 * "Doing something different? Tell us", under a list of choices (the ice,
 * method and technique lists): opens the Tell us sheet, sent with the screen,
 * drink and bar it came from. In the Cocktail accent, not the venue's.
 */
export function TellUs({ line, ...about }: TellUsProps) {
  const [open, setOpen] = useState(false);
  // The sheet mounts on the first tap, then stays (so it can animate away and keep a picked photo).
  const [seen, setSeen] = useState(false);
  return (
    <BrandProvider accent={DEFAULT_ACCENT} accentText="ink">
      <Row
        line={line}
        onPress={() => {
          setSeen(true);
          setOpen(true);
        }}
      />
      {seen ? <NoteSheet visible={open} onClose={() => setOpen(false)} about={about} /> : null}
    </BrandProvider>
  );
}

function Row({ line, onPress }: { line: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`Doing something different? Tell us. ${line}`}
      onPress={onPress}
      style={[styles.row, { borderColor: ds.accentText, backgroundColor: withAlpha(ds.accentText, 0.08) }]}
    >
      <IconSymbol name="bubble.left" size={20} color={ds.accentText} />
      <View style={styles.flex}>
        <DsText variant="label" style={styles.title}>Doing something different? Tell us</DsText>
        <Caption tone="muted">{line}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.control + 4, borderWidth: 1 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamilies.bodySemiBold },
});
