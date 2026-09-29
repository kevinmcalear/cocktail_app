import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Headline, Surface } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSaveTasteAnswers } from '@/hooks/useFlavor';
import { ANSWERS, COLD_START_DRINKS, QUESTIONS, type Taste } from '@/lib/flavor';

/**
 * The cold start: a few quick questions that stand in for your taste until
 * you've ranked enough drinks. Skippable: any answered question counts.
 */
export function TasteQuestions({ initial, rankedDrinks, onDone }: { initial: Taste | null; rankedDrinks: number; onDone: () => void }) {
  const [answers, setAnswers] = useState<Taste>(initial ?? {});
  const save = useSaveTasteAnswers();
  const answered = Object.keys(answers).length;
  const toGo = COLD_START_DRINKS - rankedDrinks;

  return (
    <Surface style={styles.card}>
      <Headline role="heading">What do you like to drink?</Headline>
      <Body tone="muted">
        {`A few quick answers get you started. Rank ${toGo} more drink${toGo === 1 ? '' : 's'} you've had and we'll learn your taste from those instead.`}
      </Body>
      {QUESTIONS.map((q) => (
        <View key={q.dim} style={styles.question}>
          <Caption>{q.prompt}</Caption>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View role="radiogroup" accessibilityLabel={q.prompt} style={styles.chips}>
              {ANSWERS.map((a) => (
                <Chip
                  key={a.label}
                  label={a.label}
                  selected={answers[q.dim] === a.value}
                  onPress={() => setAnswers((prev) => ({ ...prev, [q.dim]: a.value }))}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      ))}
      {save.error ? <Caption tone="muted">{`Couldn't save: ${save.error.message}`}</Caption> : null}
      <Button
        label={answered ? 'Show my picks' : 'Answer at least one'}
        disabled={!answered || save.isPending}
        onPress={() => save.mutate(answers, { onSuccess: onDone, onError: () => {} })}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  question: { gap: space.xs },
  chips: { flexDirection: 'row', gap: space.sm },
});
