import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { font, layout, radius, space, STATUS, type } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';
import type { WizardLine } from '@/lib/drinkWizard';
import { isLooseSalt } from '@/lib/unitGuess';

import { HeldTag, useHeldStyle } from './CombineTag';
import { LineGrip } from './DragRow';
import { unmatched } from './LineChoices';
import { Prompt } from './Prompt';

/** What a spec line needs on the draft page, open or closed. From IngredientsStep. */
export interface DraftLineParts {
  /** Write its recipe, here, in the nested page. */
  write: () => void;
  /** DragRow's grip: the line moves and combines closed, as it does open. */
  grip?: (node: ReactNode) => ReactNode;
  onMove?: (by: -1 | 1) => void;
  lifted?: boolean;
  /** Another line is held over this one (its name). */
  dropTarget?: string | null;
  /** Held over a line it can combine with (that line's name). */
  combineWith?: string | null;
  /** Made in parts, held over another part. */
  moveTo?: string | null;
  /** A venue's line, for Prep or Costs: what the pour costs, or a new bottle's chip. */
  detail?: ReactNode;
  /** What's open under the line: a new bottle's card. */
  below?: ReactNode;
}

interface Props extends DraftLineParts {
  line: WizardLine;
  /** The line's editor (LineRow), shown once it's tapped. */
  row: ReactNode;
  /** Under the open editor, whose bottle it's about (StockToggle). */
  hint?: ReactNode;
}

/** Still a recipe to write: a house-made the drink names that isn't one of yours yet. */
const toWrite = (l: WizardLine) => !l.id && (l.later || !!l.prep?.at);

/**
 * A spec line on the draft page (Prod-add-flow 3, Kept-add-helpers): "45 ml
 * Mezcal", in pencil until saved. A gap is amber: "?" and Add amount where
 * there's no amount, New for a house-made still to write, which also asks
 * to write it here (Write it now, Later). A tap opens the line's editor.
 * A line that matched nothing, or loose salt, opens straight away: it has a
 * question to answer. Closed, it's still held and moved by its grip (DragRow):
 * it folds, says what letting go does, and lights up to be dropped on.
 */
export function DraftLine({ line, row, write, hint, grip, onMove, lifted, dropTarget, combineWith, moveTo, detail, below }: Props) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const [later, setLater] = useState(false);
  const held = useHeldStyle(lifted, combineWith, dropTarget);
  const amber = readableAccent(STATUS.warning, ds.c.ground);
  if (open || unmatched(line) || isLooseSalt(line.name)) {
    return (
      <View>
        {row}
        {open && !lifted ? (
          <>
            {hint}
            <PressableScale role="button" accessibilityLabel={`Done with ${line.name}`} onPress={() => setOpen(false)} style={styles.done}>
              <DsText variant="label" tone="accent" style={styles.bold}>
                Done
              </DsText>
            </PressableScale>
          </>
        ) : null}
      </View>
    );
  }
  const top = line.unit === 'top';
  const missing = !top && !line.amount.trim();
  const fresh = toWrite(line);
  const flag = missing ? 'Add amount' : fresh ? 'New' : null;
  const said = top ? `Top with ${line.name}` : missing ? `${line.name}, no amount yet` : `${line.amount} ${line.unit} ${line.name}`;
  return (
    <View>
      <View role="listitem" style={[styles.wrap, { borderBottomColor: ds.c.line }, held]}>
        <HeldTag name={line.name} lifted={lifted} combineWith={combineWith} moveTo={moveTo} />
        <View style={styles.row}>
          {/* The grip keeps its place in the tree, so the drag holding it carries on as the line folds. */}
          {grip?.(<LineGrip name={line.name} onMove={onMove} />)}
          <PressableScale role="button" accessibilityLabel={`${said}${fresh ? ', a house-made to write' : ''}. Edit`} onPress={() => setOpen(true)} style={styles.line}>
            <View style={styles.amount}>
              <Body style={[styles.figure, { color: missing ? amber : ds.c.ink }]}>{top ? 'Top' : missing ? '?' : line.amount}</Body>
              {top || missing ? null : (
                <DsText variant="caption" tone="muted" style={styles.unit}>
                  {line.unit}
                </DsText>
              )}
            </View>
            <View style={styles.name}>
              <Body numberOfLines={1}>{line.name}</Body>
              {dropTarget ? <Caption tone="accent">Let go to combine</Caption> : null}
            </View>
            {flag && !lifted ? (
              <View style={[styles.flag, { backgroundColor: withAlpha(STATUS.warning, 0.16) }]}>
                <DsText variant="caption" color={amber} style={styles.bold}>
                  {flag}
                </DsText>
              </View>
            ) : null}
          </PressableScale>
        </View>
        {/* Beside the line's button, not in it: the detail can be a button of its own (a new bottle's chip). */}
        {detail && !lifted ? <View style={styles.detail}>{detail}</View> : null}
      </View>
      {lifted ? null : below}
      {fresh && !later && !lifted ? (
        <View style={styles.prompt}>
          <Prompt
            icon="flask"
            title={`${line.name} isn’t one of yours yet.`}
            body="Write it as a house-made, here, without leaving this drink."
            actions={[
              { label: 'Write it now', onPress: write },
              { label: 'Later', onPress: () => setLater(true) },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const AMOUNT = 68;

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 50 },
  amount: { width: AMOUNT, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 3 },
  // The spec boards' big figure (Miss-steps, Decided-who-creator), as the drink page's SpecRow sets it.
  figure: { fontSize: type.headline.fontSize, lineHeight: type.body.lineHeight, ...font.semiBold, fontVariant: ['tabular-nums'] },
  unit: { ...font.figures },
  name: { flex: 1, minWidth: 0 },
  flag: { borderRadius: radius.control - 2, paddingHorizontal: space.sm + 1, paddingVertical: space.xs + 2 },
  bold: { ...font.semiBold },
  done: { alignSelf: 'flex-end', minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.sm },
  prompt: { marginTop: space.md },
  // Under the name: past the grip and the amount.
  detail: { paddingLeft: space.xl + AMOUNT + space.md, paddingBottom: space.sm },
});
