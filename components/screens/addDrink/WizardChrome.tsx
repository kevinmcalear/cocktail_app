import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';

/** On a desktop browser the footer ends the step (WizardFrame), not pinned: Next is a compact pill. */
export const FooterInline = createContext(false);

interface ChipProps {
  label: string;
  selected?: boolean;
  /** A quick add: "+ Lemon". */
  add?: boolean;
  kind?: 'radio' | 'checkbox' | 'button';
  /** Our guess from the spec: a dashed ring in the accent. */
  suggested?: boolean;
  /** A dashed chip that opens more choices ("More"). */
  dashed?: boolean;
  onPress: () => void;
}

/**
 * The wizard's chip: a quiet outline, solid ink when chosen (the accent is
 * kept for the one primary action), a dashed accent ring for our guess.
 */
export function WizardChip({ label, selected = false, add, kind = 'radio', suggested, dashed, onPress }: ChipProps) {
  const ds = useDs();
  const guess = suggested && !selected;
  return (
    <PressableScale
      role={kind}
      aria-checked={kind === 'button' ? undefined : selected}
      accessibilityLabel={add ? `Add ${label}` : suggested ? `${label}, suggested` : label}
      onPress={onPress}
      style={[
        styles.chip,
        add && styles.add,
        {
          borderColor: selected ? ds.c.ink : guess ? ds.accentText : ds.c.lineStrong,
          backgroundColor: selected ? ds.c.ink : 'transparent',
          borderStyle: guess || dashed ? 'dashed' : 'solid',
          borderWidth: guess ? 1.5 : 1,
        },
      ]}
    >
      {add ? <IconSymbol name="plus" size={14} color={ds.accentText} /> : null}
      <DsText variant="body" color={selected ? ds.c.ground : dashed ? ds.c.muted : ds.c.ink} style={selected ? styles.on : null}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/** A short confirmation over the footer, with a tick: "Shrub saved to your preps when you save the drink." */
export function WizardNotice({ children, action }: { children: string; action?: { label: string; onPress: () => void } }) {
  const ds = useDs();
  return (
    <View role="status" style={[styles.notice, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="checkmark" size={16} color={ds.accentText} />
      <Caption style={styles.flex}>{children}</Caption>
      {action ? <Button label={action.label} variant="ghost" size="sm" onPress={action.onPress} /> : null}
    </View>
  );
}

/** "WHAT GOES IN?" style labels: small capitals with air between the letters. */
export function Eyebrow({ children }: { children: string }) {
  return (
    <Caption tone="muted" style={styles.eyebrow} numberOfLines={1}>
      {children.toUpperCase()}
    </Caption>
  );
}

interface FooterProps {
  /** "Next: method", or the save on the last step. */
  nextLabel: string;
  /** An optional step offers Skip beside Next. */
  optional: boolean;
  /** What Skip says ("Later": leave the recipe for later). */
  skipLabel?: string;
  canNext: boolean;
  saving: boolean;
  onSkip: () => void;
  onNext: () => void;
  /** Just above the buttons: a short note with Undo ("Del Maguey Vida is on Little Rye's back bar"). */
  notice?: ReactNode;
}

/**
 * Pinned at the bottom of a wizard: Skip on optional steps, and Next (Save
 * on the review). On a desktop browser it ends the step instead, Next a
 * compact pill.
 */
export function WizardFooter({ nextLabel, optional, skipLabel = 'Skip', canNext, saving, onSkip, onNext, notice }: FooterProps) {
  const ds = useDs();
  const inline = useContext(FooterInline);
  return (
    <View style={[styles.footer, !inline && { backgroundColor: ds.c.ground }]}>
      {notice}
      <View style={styles.buttons}>
        {optional ? <Button label={skipLabel} variant="secondary" size="lg" onPress={onSkip} /> : null}
        <Button label={nextLabel} size="lg" disabled={!canNext || saving} onPress={onNext} style={inline ? styles.compact : styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: layout.minTapTarget, paddingHorizontal: space.md + 2, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.control },
  on: { fontFamily: fontFamilies.bodySemiBold },
  eyebrow: { letterSpacing: 0.6 },
  footer: { gap: space.sm, paddingTop: space.md },
  buttons: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  compact: { minWidth: 220 },
});
