import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Body, Button, Caption, Headline, Surface } from '@/components/ds';
import { TasteAnswers } from '@/components/screens/taste/TasteAnswers';
import { space } from '@/constants/tokens';
import { useSaveTasteAnswers } from '@/hooks/useFlavor';
import { COLD_START_DRINKS, QUICK_QUESTIONS, type Taste } from '@/lib/flavor';

/**
 * The cold start on Discover, for someone who skipped the questions at setup:
 * a few quick answers to start your taste. Any answered question counts.
 */
export function TasteQuestions({ rankedDrinks }: { rankedDrinks: number }) {
  const [answers, setAnswers] = useState<Taste>({});
  const save = useSaveTasteAnswers();
  const answered = Object.keys(answers).length;
  const toGo = COLD_START_DRINKS - rankedDrinks;

  return (
    <Surface style={styles.card}>
      <Headline role="heading">What do you like to drink?</Headline>
      <Body tone="muted">
        {`A few quick answers get you started. Every drink you rank sharpens it, and after ${toGo} more you'll see match scores.`}
      </Body>
      <TasteAnswers questions={QUICK_QUESTIONS} value={answers} onChange={setAnswers} />
      {save.error ? <Caption tone="muted">{`Couldn't save: ${save.error.message}`}</Caption> : null}
      <Button label={answered ? 'Show my picks' : 'Answer at least one'} disabled={!answered || save.isPending} onPress={() => save.mutate(answers, { onError: () => {} })} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
});
