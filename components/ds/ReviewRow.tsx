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
  /** What the state means here ("In your bar", "New drink · Rye whiskey, Fig syrup"). The words carry the state; the mark only echoes it. */
  detail?: string | null;
  /** A spec amount before the title ("30 ml"). */
  amount?: string | null;
  /** Tapping the amount shows where it's written on the page. */
  onAmount?: () => void;
  /** What leads the row instead of the mark (a crop of the printed line, a bottle's number); the mark then sits in the detail line, or at the end with `markAtEnd`. */
  lead?: ReactNode;
  markAtEnd?: boolean;
  /** At the very end (a price in Geist Mono). */
  end?: ReactNode;
  /** In mono at the row's end: a price read from a menu ("18"). */
  trailing?: string | null;
  /** The options for a pick, shown inline. */
  choices?: ReviewChoice[];
  chosen?: string | null;
  onChoose?: (id: string) => void;
  /** One text action at the end of the row: Finish, Undo, Bring back. */
  action?: { label: string; onPress: () => void; hint?: string };
  /** Tap the row (a have row: see or change the match). */
  onPress?: () => void;
  pressHint?: string;
  /** Hard to read: the row is outlined in the accent with the reason ("Check this: ¾ or ½?"). */
  flag?: string | null;
  /** A muted title without the skip strike ("Couldn't read this one"). */
  mutedTitle?: boolean;
  /** Anything the row still needs under it, like the ingredients of a new drink. */
  children?: ReactNode;
}

/** A text action, in the venue's accent unless `tone` says ink ("Add another page", "Finish"), at least 44 tall. */
export function TextLink({ label, onPress, accessibilityHint, tone = 'accent' }: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  /** `ink` where the screen's one accent is already spoken for (a menu's Guest card beside Go live). */
  tone?: 'accent' | 'ink';
}) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={label} accessibilityHint={accessibilityHint} onPress={onPress} style={styles.link}>
      <DsText variant="body" color={tone === 'ink' ? ds.c.ink : ds.accentText}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/** The state's mark (docs/design_system.md): have is an ink tick on a faint ink circle; new, the only one in the accent, a dashed plus. */
export function ReviewMark({ state, size = MARK }: { state: ReviewState; size?: number }) {
  const ds = useDs();
  const box = { width: size, height: size };
  const glyph = Math.round(size * 0.55);
  if (state === 'have') {
    return (
      <View style={[styles.mark, box, { backgroundColor: withAlpha(ds.c.ink, 0.12) }]} aria-hidden>
        <IconSymbol name="checkmark" size={glyph} color={ds.c.ink} />
      </View>
    );
  }
  if (state === 'new') {
    return (
      <View style={[styles.mark, box, styles.dashed, { borderColor: ds.accentText }]} aria-hidden>
        <IconSymbol name="plus" size={glyph - 2} color={ds.accentText} />
      </View>
    );
  }
  if (state === 'pick') {
    return (
      <View style={[styles.mark, box, styles.ring, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.raised }]} aria-hidden>
        <IconSymbol name="questionmark" size={glyph} color={ds.c.ink} />
      </View>
    );
  }
  return (
    <View style={[styles.mark, box, styles.ring, { borderColor: ds.c.line }]} aria-hidden>
      <IconSymbol name="minus" size={glyph - 2} color={ds.c.muted} />
    </View>
  );
}

/**
 * One line of a review: a drink on a menu, a line in a spec, a bottle on a
 * shelf. The same four states everywhere (docs/design_system.md, "Bring in").
 */
export function ReviewRow({ state, title, detail, amount, trailing, onAmount, lead, markAtEnd, end, choices, chosen = null, onChoose, action, onPress, pressHint, flag, mutedTitle, children }: ReviewRowProps) {
  const ds = useDs();
  const skipped = state === 'skip';
  // An amount is its own column, like a spec (canvas make-bringin-recipe); the mark then sits in the detail line.
  const column = amount !== undefined && amount !== null;
  const inline = (!!lead || column) && !markAtEnd;
  const amountText = <Spec tone={skipped ? 'muted' : flag ? 'accent' : 'ink'}>{amount ?? ''}</Spec>;
  const main = (
    <View style={styles.top}>
      {lead ?? (column ? null : <ReviewMark state={state} />)}
      {column && onAmount && amount ? (
        <PressableScale accessibilityLabel={`${title} amount, ${amount}. Show it on the page`} onPress={onAmount} style={styles.amount}>
          {amountText}
        </PressableScale>
      ) : column ? (
        <View style={styles.amount}>{amountText}</View>
      ) : null}
      <View style={styles.flex}>
        <View style={styles.title}>
          <Body tone={skipped || mutedTitle ? 'muted' : 'ink'} style={[styles.flex, skipped && styles.struck]}>
            {title}
          </Body>
        </View>
        {flag || detail ? (
          <View style={styles.detail}>
            {inline && !flag ? <ReviewMark state={state} size={16} /> : null}
            <Caption tone={flag || state === 'new' ? 'accent' : 'muted'} style={styles.flex}>
              {flag ?? detail}
            </Caption>
          </View>
        ) : null}
      </View>
      {action ? <TextLink label={action.label} accessibilityHint={action.hint} onPress={action.onPress} /> : null}
      {trailing ? <Spec tone={skipped ? 'muted' : 'ink'}>{trailing}</Spec> : null}
      {end}
      {markAtEnd ? <ReviewMark state={state} size={24} /> : null}
    </View>
  );
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }, flag && [styles.flagged, { borderColor: withAlpha(ds.accentText, 0.45), backgroundColor: withAlpha(ds.accentText, 0.08) }]]}>
      {onPress ? (
        <PressableScale accessibilityLabel={`${title}. ${detail ?? ''}`} accessibilityHint={pressHint} onPress={onPress}>
          {main}
        </PressableScale>
      ) : (
        main
      )}
      {choices?.length && onChoose ? (
        <View role="radiogroup" aria-label={`Which ${title}`} style={[styles.choices, lead || amount ? styles.choicesUnder : null]}>
          {choices.map((choice) => (
            <Chip key={choice.id} label={choice.detail ? `${choice.label} · ${choice.detail}` : choice.label} selected={chosen === choice.id} onPress={() => onChoose(choice.id)} />
          ))}
        </View>
      ) : null}
      {children ? <View style={[styles.under, lead || amount ? styles.choicesUnder : null]}>{children}</View> : null}
    </View>
  );
}

const MARK = 24;

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flagged: { marginHorizontal: -space.md, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.control },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  title: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  detail: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, marginTop: 2 },
  struck: { textDecorationLine: 'line-through' },
  amount: { width: 58, minHeight: 44, justifyContent: 'center' },
  mark: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  ring: { borderWidth: 1 },
  flex: { flex: 1, gap: 2 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingLeft: MARK + space.md },
  choicesUnder: { paddingLeft: 70 },
  under: { gap: space.sm, paddingLeft: MARK + space.md },
  link: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
