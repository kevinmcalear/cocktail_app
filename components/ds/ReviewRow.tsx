import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import { Chip } from './Chip';
import { PressableScale } from './PressableScale';
import { Body, Caption, DsText, Spec } from './Text';
import { useDs } from './theme';

/**
 * Where a thing read from a photo or a paste stands: already yours, about to
 * be made, waiting for someone to say which, or left out.
 */
export type ReviewState = 'have' | 'new' | 'pick' | 'skip';

export interface ReviewChoice {
  id: string;
  label: string;
  detail?: string | null;
}

interface ReviewRowProps {
  state: ReviewState;
  title: string;
  /** What the state means here ("In the library", "New · Bourbon, Aperol"). The words carry the state; the mark only echoes it. */
  detail?: string | null;
  /** A spec amount before the title ("30 ml"). */
  amount?: string | null;
  /** The options for a pick, shown inline. */
  choices?: ReviewChoice[];
  chosen?: string | null;
  onChoose?: (id: string) => void;
  /** One text action at the end of the row: Finish, Undo, Bring back. */
  action?: { label: string; onPress: () => void; hint?: string };
  /** Anything the row still needs under it, like a "Kind of" field. */
  children?: ReactNode;
}

/** A text action in the venue's accent ("Add another page", "Finish"), at least 44 tall. */
export function TextLink({ label, onPress, accessibilityHint }: { label: string; onPress: () => void; accessibilityHint?: string }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={label} accessibilityHint={accessibilityHint} onPress={onPress} style={styles.link}>
      <DsText variant="body" color={ds.accentText}>
        {label}
      </DsText>
    </PressableScale>
  );
}

function Mark({ state }: { state: ReviewState }) {
  const ds = useDs();
  if (state === 'have') {
    return (
      <View style={[styles.mark, { backgroundColor: withAlpha(ds.accentText, 0.18) }]} aria-hidden>
        <IconSymbol name="checkmark" size={14} color={ds.accentText} />
      </View>
    );
  }
  if (state === 'new') {
    return (
      <View style={[styles.mark, styles.dashed, { borderColor: ds.accentText }]} aria-hidden>
        <IconSymbol name="plus" size={12} color={ds.accentText} />
      </View>
    );
  }
  if (state === 'pick') {
    return (
      <View style={[styles.mark, styles.ring, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.raised }]} aria-hidden>
        <IconSymbol name="questionmark" size={13} color={ds.c.ink} />
      </View>
    );
  }
  return (
    <View style={[styles.mark, styles.ring, { borderColor: ds.c.line }]} aria-hidden>
      <IconSymbol name="minus" size={12} color={ds.c.muted} />
    </View>
  );
}

/**
 * One line of a review: a drink on a menu, a line in a spec, a bottle on a
 * shelf. The same four states everywhere (docs/design_system.md, "Bring in").
 */
export function ReviewRow({ state, title, detail, amount, choices, chosen = null, onChoose, action, children }: ReviewRowProps) {
  const ds = useDs();
  const skipped = state === 'skip';
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.top}>
        <Mark state={state} />
        <View style={styles.flex}>
          <View style={styles.title}>
            {amount ? <Spec tone={skipped ? 'muted' : 'ink'}>{amount}</Spec> : null}
            <Body tone={skipped ? 'muted' : 'ink'} style={styles.flex}>
              {title}
            </Body>
          </View>
          {detail ? <Caption tone={state === 'new' ? 'accent' : 'muted'}>{detail}</Caption> : null}
        </View>
        {action ? <TextLink label={action.label} accessibilityHint={action.hint} onPress={action.onPress} /> : null}
      </View>
      {choices?.length && onChoose ? (
        <View role="radiogroup" aria-label={`Which ${title}`} style={styles.choices}>
          {choices.map((choice) => (
            <Chip key={choice.id} label={choice.detail ? `${choice.label} · ${choice.detail}` : choice.label} selected={chosen === choice.id} onPress={() => onChoose(choice.id)} />
          ))}
        </View>
      ) : null}
      {children ? <View style={styles.under}>{children}</View> : null}
    </View>
  );
}

const MARK = 28;

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  title: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  mark: { width: MARK, height: MARK, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  ring: { borderWidth: 1 },
  flex: { flex: 1, gap: 2 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingLeft: MARK + space.md },
  under: { gap: space.sm, paddingLeft: MARK + space.md },
  link: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
