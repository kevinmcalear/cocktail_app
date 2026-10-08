import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Headline, PalateFlower, PressableScale, Spec, Surface, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { ANSWERS, LABEL, QUESTIONS, QUICK_QUESTIONS, type Taste } from '@/lib/flavor';
import { itemHref } from '@/lib/itemRoutes';
import { changeBetween, type PalateMonth, type Shaper } from '@/lib/palate';
import { formatScore } from '@/lib/ranking';

import { FamilyDot } from './PalateParts';

const MONTH = new Intl.DateTimeFormat(undefined, { month: 'short' });
export const monthName = (key: string) => MONTH.format(new Date(`${key}-15T12:00:00Z`));

/** The drinks that moved your palate most: loved ones pull a taste out, disliked ones push it in. */
export function ShapedBy({ shapers }: { shapers: Shaper[] }) {
  const router = useRouter();
  if (!shapers.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">What shaped it</Headline>
      <View role="list">
        {shapers.map((s) => (
          <PressableScale
            key={s.itemId}
            role="link"
            accessibilityLabel={`${s.name}, ${formatScore(s.score)}. ${s.way === 'none' ? 'Barely moves it' : `${s.way === 'pull' ? 'More' : 'Less'} ${s.moved.map((d) => LABEL[d]).join(' and ')}`}`}
            onPress={() => router.push(itemHref('Cocktail', s.itemId) as Href)}
            style={styles.shaper}
          >
            <PalateFlower values={s.profile} size={44} rings={false} />
            <View style={styles.flex}>
              <View style={styles.between}>
                <Body numberOfLines={1} style={styles.flex}>
                  {s.name}
                </Body>
                <Spec tone={s.way === 'push' ? 'muted' : 'ink'}>{formatScore(s.score)}</Spec>
              </View>
              <View style={styles.tags}>
                {s.way === 'none' ? (
                  <Caption tone="muted">barely moves it</Caption>
                ) : (
                  s.moved.map((d) => <Tag key={d} tone={s.way === 'pull' ? 'accent' : 'default'} label={`${s.way === 'pull' ? '+' : '−'} ${LABEL[d]}`} />)
                )}
              </View>
            </View>
          </PressableScale>
        ))}
      </View>
      <Caption tone="muted">Loved drinks pull a taste out. Disliked ones push it in. A drink in the middle barely moves it.</Caption>
    </View>
  );
}

/** Your palate at the end of each of the last few months, and what changed. */
export function OverTime({ months }: { months: PalateMonth[] }) {
  const ds = useDs();
  if (months.length < 2) return null;
  const change = changeBetween(months[0].taste, months.at(-1)!.taste);
  return (
    <View style={styles.section}>
      <Headline role="heading">Over time</Headline>
      <Surface style={styles.months}>
        {months.map((m, i) => (
          <View key={m.key} style={styles.month}>
            <PalateFlower values={m.taste} size={68} rings={false} on={ds.c.surface} />
            <Caption tone={i === months.length - 1 ? 'ink' : 'muted'}>{monthName(m.key)}</Caption>
          </View>
        ))}
      </Surface>
      <Caption tone="muted">{change ? `Since ${monthName(months[0].key)}: ${change}.` : `About the same since ${monthName(months[0].key)}.`}</Caption>
    </View>
  );
}

/**
 * What you said, one row per question. Tap a row to change it; tap the chosen
 * answer again to leave that taste to your rankings.
 */
export function SaidAnswers({ value, onChange }: { value: Taste; onChange: (next: Taste) => void }) {
  const ds = useDs();
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const shown = QUESTIONS.filter((q) => all || QUICK_QUESTIONS.includes(q) || typeof value[q.dim] === 'number');
  const pick = (dim: keyof Taste, answer: number) => {
    const next = { ...value };
    if (next[dim] === answer) delete next[dim];
    else next[dim] = answer;
    onChange(next);
  };
  return (
    <View style={styles.section}>
      <Headline role="heading">What you said</Headline>
      <Caption tone="muted">Change an answer and the flower moves with it.</Caption>
      <Surface style={styles.said}>
        {shown.map((q, i) => {
          const answer = ANSWERS.find((a) => a.value === value[q.dim]);
          const isOpen = open === q.dim;
          return (
            <View key={q.dim} style={[styles.saidRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ds.c.line }]}>
              <PressableScale
                role="button"
                aria-expanded={isOpen}
                accessibilityLabel={`${q.prompt} ${answer?.label ?? 'Not answered'}`}
                onPress={() => setOpen(isOpen ? null : q.dim)}
                style={styles.saidHead}
              >
                <FamilyDot dim={q.dim} />
                <Body style={styles.flex}>{q.prompt}</Body>
                <Caption tone={answer ? 'ink' : 'muted'}>{answer?.label ?? 'Not asked'}</Caption>
                <IconSymbol name={isOpen ? 'chevron.up' : 'chevron.down'} size={14} color={ds.c.faint} />
              </PressableScale>
              {isOpen ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View role="radiogroup" accessibilityLabel={q.prompt} style={styles.chips}>
                    {ANSWERS.map((a) => (
                      <Chip key={a.label} label={a.label} selected={value[q.dim] === a.value} onPress={() => pick(q.dim, a.value)} />
                    ))}
                  </View>
                </ScrollView>
              ) : null}
            </View>
          );
        })}
      </Surface>
      {all ? null : <Button label="Answer all twelve" variant="secondary" onPress={() => setAll(true)} style={styles.start} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  between: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  shaper: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  months: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: space.lg },
  month: { alignItems: 'center', gap: space.sm },
  said: { paddingHorizontal: space.lg },
  saidRow: { paddingBottom: space.xs },
  saidHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm },
  chips: { flexDirection: 'row', gap: space.sm, paddingBottom: space.sm },
  start: { alignSelf: 'flex-start' },
});
