import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { STEP_COPY, WIZARD_STEPS, type WizardStep } from '@/lib/drinkWizard';

interface ChipProps {
  label: string;
  selected?: boolean;
  /** A quick add: "+ Lemon". */
  add?: boolean;
  kind?: 'radio' | 'checkbox' | 'button';
  /** Our guess from the spec: outlined in the accent, with a spark. */
  suggested?: boolean;
  onPress: () => void;
}

/** The wizard's chip: a quiet outline, filled in the accent when chosen. */
export function WizardChip({ label, selected = false, add, kind = 'radio', suggested, onPress }: ChipProps) {
  const ds = useDs();
  return (
    <PressableScale
      role={kind}
      aria-checked={kind === 'button' ? undefined : selected}
      accessibilityLabel={add ? `Add ${label}` : suggested ? `${label}, suggested` : label}
      onPress={onPress}
      style={[
        styles.chip,
        suggested && styles.suggested,
        {
          borderColor: selected || suggested ? ds.accentFill.fill : ds.c.lineStrong,
          backgroundColor: selected ? ds.accentFill.fill : 'transparent',
          borderWidth: suggested && !selected ? 2 : 1,
        },
      ]}
    >
      {suggested && !selected ? <IconSymbol name="sparkles" size={14} color={ds.c.ink} /> : null}
      <DsText variant="body" color={selected ? ds.accentFill.text : ds.c.ink} style={selected ? styles.on : null}>
        {add ? `+ ${label}` : label}
      </DsText>
    </PressableScale>
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
  step: WizardStep;
  canNext: boolean;
  saving: boolean;
  onSkip: () => void;
  onNext: () => void;
}

/** Pinned at the bottom: Skip on optional steps, and "Next: method" (Save on the review). */
export function WizardFooter({ step, canNext, saving, onSkip, onNext }: FooterProps) {
  const ds = useDs();
  const at = WIZARD_STEPS.indexOf(step);
  const following = WIZARD_STEPS[at + 1];
  const label = step === 'review' ? (saving ? 'Saving…' : 'Save drink') : `Next: ${STEP_COPY[following].short.toLowerCase()}`;
  return (
    <View style={[styles.footer, { backgroundColor: ds.c.ground }]}>
      {STEP_COPY[step].optional ? <Button label="Skip" variant="secondary" size="lg" onPress={onSkip} /> : null}
      <Button label={label} size="lg" disabled={!canNext || saving} onPress={onNext} style={styles.flex} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  suggested: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  on: { fontFamily: fontFamilies.bodySemiBold },
  eyebrow: { letterSpacing: 0.6 },
  footer: { flexDirection: 'row', gap: space.md, paddingTop: space.md },
  flex: { flex: 1 },
});
