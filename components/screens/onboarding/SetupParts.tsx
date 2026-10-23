import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';

/** "Little Rye" -> "LR": the first letters of the first two words ("Cellar & Co" -> "CC", the "&" isn't one). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[a-z0-9\u00c0-\uffff]/i.test(w));
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '·';
}

/** A section's small muted caps over a setup step's group ("WHAT THAT MEANS", "NOT HERE?"). */
export function SetupHead({ children }: { children: string }) {
  return (
    <Caption tone="muted" role="heading" style={styles.head}>
      {children.toUpperCase()}
    </Caption>
  );
}

/**
 * A venue or person without a picture: their initials in the display face,
 * in an outlined circle. `accent` rings it in the venue's colour (the invite
 * welcome); `italic` sets the initials in the face's italic.
 */
export function Monogram({ name, size = 48, accent, italic, quiet, plain }: { name: string; size?: number; accent?: boolean; italic?: boolean; quiet?: boolean; plain?: boolean }) {
  const ds = useDs();
  const tone = accent ? ds.accentText : quiet ? ds.c.muted : ds.c.ink;
  return (
    <View
      aria-hidden
      style={[
        styles.mark,
        { width: size, height: size, borderColor: accent ? ds.accentText : quiet ? ds.c.line : ds.c.lineStrong, backgroundColor: accent ? ds.c.ground : ds.c.surface },
      ]}
    >
      {plain ? (
        // A person's small initial, in the body face (canvas make-onboarding-find).
        <Caption tone="muted">{initials(name)}</Caption>
      ) : (
      <DsText variant={size >= 64 ? 'title' : 'headline'} italic={italic} color={tone} style={size >= 64 ? null : { fontFamily: italic ? fontFamilies.instrumentItalic : fontFamilies.instrument }}>
        {initials(name)}
      </DsText>
      )}
    </View>
  );
}

/** A choice as a card with its radio dot on the left, the chosen one ringed in the accent (setup's who-sees and claim steps). */
export function RadioCard({ label, detail, selected, disabled, onPress, children }: { label: string; detail?: string; selected: boolean; disabled?: boolean; onPress: () => void; children?: ReactNode }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={[styles.card, { backgroundColor: selected ? ds.c.raised : ds.c.surface, borderColor: selected ? ds.accentText : ds.c.line }]}
    >
      <View style={[styles.dot, { borderColor: selected ? ds.accentText : ds.c.lineStrong, borderWidth: selected ? 7 : 2 }]} />
      <View style={styles.flex}>
        <DsText variant="body" style={styles.strong}>
          {label}
        </DsText>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
        {children}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  head: { letterSpacing: 1.2, fontFamily: fontFamilies.bodyMedium, marginTop: space.sm },
  mark: { borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  dot: { width: 22, height: 22, borderRadius: radius.pill, marginTop: 1 },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
