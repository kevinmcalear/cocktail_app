import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, Chip, useDs } from '@/components/ds';
import { palateHues, radius, space } from '@/constants/tokens';
import { ANSWERS, type TasteQuestion, type Taste } from '@/lib/flavor';
import { FAMILY } from '@/lib/palate';

/**
 * The taste questions, one row of answers each. Tapping the chosen answer
 * again clears it: a question you leave blank is left to your rankings.
 */
export function TasteAnswers({ questions, value, onChange }: { questions: readonly TasteQuestion[]; value: Taste; onChange: (next: Taste) => void }) {
  const hues = palateHues[useDs().scheme];
  const pick = (dim: TasteQuestion['dim'], answer: number) => {
    const next = { ...value };
    if (next[dim] === answer) delete next[dim];
    else next[dim] = answer;
    onChange(next);
  };
  return (
    <View style={styles.list}>
      {questions.map((q) => (
        <View key={q.dim} style={styles.question}>
          <View style={styles.prompt}>
            {/* The dot is the question's petal colour, tying it to the flower. */}
            <View aria-hidden style={[styles.dot, { backgroundColor: hues[FAMILY[q.dim]] }]} />
            <Caption>{q.prompt}</Caption>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View role="radiogroup" accessibilityLabel={q.prompt} style={styles.chips}>
              {ANSWERS.map((a) => (
                <Chip key={a.label} label={a.label} selected={value[q.dim] === a.value} onPress={() => pick(q.dim, a.value)} />
              ))}
            </View>
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  question: { gap: space.xs },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  chips: { flexDirection: 'row', gap: space.sm },
});
