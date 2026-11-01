import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, DsText, PressableScale, useDs } from '@/components/ds';
import { font, layout, radius, space, STATUS } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';
import type { WizardLine } from '@/lib/drinkWizard';
import { isLooseSalt } from '@/lib/unitGuess';

import { unmatched } from './LineChoices';
import { Prompt } from './Prompt';

interface Props {
  line: WizardLine;
  /** The line's editor (LineRow), shown once it's tapped. */
  row: ReactNode;
  /** Write its recipe, here, in the nested page. */
  write: () => void;
}

/** Still a recipe to write: a house-made the drink names that isn't one of yours yet. */
const toWrite = (l: WizardLine) => !l.id && (l.later || !!l.prep?.at);

/**
 * A spec line on the draft page (Prod-add-flow 3, Kept-add-helpers): "45 ml
 * Mezcal", in pencil until saved. A gap is amber: "?" and Add amount where
 * there's no amount, New for a house-made still to write, which also asks
 * to write it here (Write it now, Later). A tap opens the line's editor.
 * A line that matched nothing, or loose salt, opens straight away: it has a
 * question to answer.
 */
export function DraftLine({ line, row, write }: Props) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const [later, setLater] = useState(false);
  const amber = readableAccent(STATUS.warning, ds.c.ground);
  if (open || unmatched(line) || isLooseSalt(line.name)) {
    return (
      <View>
        {row}
        {open ? (
          <PressableScale role="button" accessibilityLabel={`Done with ${line.name}`} onPress={() => setOpen(false)} style={styles.done}>
            <DsText variant="label" tone="accent" style={styles.bold}>
              Done
            </DsText>
          </PressableScale>
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
      <PressableScale role="button" accessibilityLabel={`${said}${fresh ? ', a house-made to write' : ''}. Edit`} onPress={() => setOpen(true)} style={[styles.line, { borderBottomColor: ds.c.line }]}>
        <View style={styles.amount}>
          <Body style={[styles.figure, { color: missing ? amber : ds.c.ink }]}>{top ? 'Top' : missing ? '?' : line.amount}</Body>
          {top || missing ? null : (
            <DsText variant="caption" tone="muted" style={styles.unit}>
              {line.unit}
            </DsText>
          )}
        </View>
        <Body numberOfLines={1} style={styles.name}>
          {line.name}
        </Body>
        {flag ? (
          <View style={[styles.flag, { backgroundColor: withAlpha(STATUS.warning, 0.16) }]}>
            <DsText variant="caption" color={amber} style={styles.bold}>
              {flag}
            </DsText>
          </View>
        ) : null}
      </PressableScale>
      {fresh && !later ? (
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

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 68, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 3 },
  figure: { ...font.figuresMedium },
  unit: { ...font.figures },
  name: { flex: 1 },
  flag: { borderRadius: radius.control - 2, paddingHorizontal: space.sm + 1, paddingVertical: space.xs + 2 },
  bold: { ...font.semiBold },
  done: { alignSelf: 'flex-end', minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.sm },
  prompt: { marginTop: space.md },
});
