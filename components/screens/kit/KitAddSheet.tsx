import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Sheet, SheetScrollView, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { IconName } from '@/components/ds';
import { radius, space } from '@/constants/tokens';

/**
 * A key for the sheet's questions that changes each time it opens: they
 * start from what they're given, and stay mounted while the sheet animates out.
 */
export function useOpenKey(visible: boolean): number {
  const [was, setWas] = useState(visible);
  const [opened, setOpened] = useState(0);
  if (visible !== was) {
    setWas(visible);
    if (visible) setOpened(opened + 1);
  }
  return opened;
}

/** One question of the Add sheet. */
export interface KitQuestion {
  title: string;
  intro?: string;
  body: ReactNode;
  /** The main button: "Next", "Add ice", "Save". */
  next: string;
  canNext?: boolean;
  /** Questions after the first can always be skipped. */
  onSkip?: () => void;
}

export interface KitAddSheetProps {
  visible: boolean;
  onClose: () => void;
  /** "Add ice", "Change Coupe". */
  label: string;
  /** Where it is, from 0, and how many questions this answer has. */
  step: number;
  total: number;
  question: KitQuestion;
  onNext: () => void;
  saving?: boolean;
  error?: string | null;
}

/**
 * Adding anything to the kit (Kit and ice, step 3): the same three questions
 * in the same order for a glass, an ice or a tool (what is it, where does it
 * come from, one more only when it matters). The same sheet and buttons; only
 * the words change. A centred dialog on the web (Sheet).
 */
export function KitAddSheet({ visible, onClose, label, step, total, question, onNext, saving, error }: KitAddSheetProps) {
  const ds = useDs();
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={label} keyboard>
      {/* A new question starts at its top. */}
      <SheetScrollView key={step} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          <View role="progressbar" aria-label={`Question ${step + 1} of ${total}`} aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} style={styles.dots}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i <= step ? ds.accentText : ds.c.lineStrong }]} />
            ))}
          </View>
          <Caption tone="muted" style={styles.flex}>{`${step + 1} of ${total}`}</Caption>
          <CloseButton />
        </View>
        <View style={styles.stack}>
          <Headline role="heading">{question.title}</Headline>
          {question.intro ? <Body tone="muted">{question.intro}</Body> : null}
        </View>
        {question.body}
        {error ? (
          <Caption tone="accent" role="alert">
            {error}
          </Caption>
        ) : null}
        <View style={styles.footer}>
          {question.onSkip ? <Button label="Skip" variant="secondary" disabled={saving} onPress={question.onSkip} /> : null}
          <Button label={saving ? 'Saving…' : question.next} disabled={saving || question.canNext === false} onPress={onNext} style={styles.flex} />
        </View>
      </SheetScrollView>
    </Sheet>
  );
}

/** The sheet's X: closes it the way the backdrop does. */
function CloseButton() {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <PressableScale role="button" accessibilityLabel="Close" onPress={close} hitSlop={8} style={[styles.close, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="xmark" size={16} color={ds.c.ink} />
    </PressableScale>
  );
}

/** A big answer with a picture: "Bought · From one of your suppliers." */
export function KitChoice({ icon, title, detail, selected, onPress }: { icon: IconName; title: string; detail: string; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={[styles.choice, { borderColor: selected ? ds.c.ink : ds.c.line, backgroundColor: selected ? ds.c.raised : 'transparent' }]}
    >
      <View style={[styles.choiceMark, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name={icon} size={20} color={ds.c.ink} />
      </View>
      <View style={styles.flex}>
        <Body>{title}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
    </PressableScale>
  );
}

/** A labelled row of chips inside a question. */
export function KitChipGroup({ label, children, multi }: { label: string; children: ReactNode; multi?: boolean }) {
  return (
    <View style={styles.stack}>
      <Caption tone="muted">{label}</Caption>
      <View role={multi ? 'group' : 'radiogroup'} aria-label={label} style={styles.chips}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.lg, padding: space.lg },
  progress: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dots: { flexDirection: 'row', gap: space.xs },
  dot: { width: 24, height: 4, borderRadius: radius.pill },
  stack: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: { flexDirection: 'row', gap: space.sm, paddingTop: space.sm },
  flex: { flex: 1, minWidth: 0 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  choiceMark: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
