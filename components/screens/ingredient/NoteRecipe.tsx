import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Headline, Spec, Surface, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useAdoptNoteRecipe, type PrepCardData } from '@/hooks/usePrepCard';
import { withAlpha } from '@/lib/color';
import { plainDbMessage } from '@/lib/dbError';
import type { NoteLine, NoteRecipe as Read } from '@/lib/noteRecipe';
import { formatQuantity, toQuantity } from '@/lib/quantity';

interface NoteRecipeProps {
  itemId: string;
  barId: string | null;
  note: string;
  read: Read;
  card: PrepCardData | undefined;
}

type Choice = 'keep' | 'swap' | 'add';

/**
 * A recipe written as a note, read into lines and steps for the person who
 * can edit it: use them as they are, or fix them in the editor first. When
 * the method adds something the list doesn't (or calls it something else),
 * it asks which is right before anything is saved.
 */
export function NoteRecipe({ itemId, barId, note, read, card }: NoteRecipeProps) {
  const ds = useDs();
  const router = useRouter();
  const adopt = useAdoptNoteRecipe(itemId, barId);
  const [choice, setChoice] = useState<Choice>('keep');
  const [showNote, setShowNote] = useState(false);
  const check = read.check;
  const lines: NoteLine[] = !check
    ? read.lines
    : choice === 'swap' && check.listed
      ? read.lines.map((l) => (l.name === check.listed ? { ...l, name: check.method } : l))
      : choice === 'add'
        ? [...read.lines, { amount: null, unit: null, name: check.method }]
        : read.lines;
  const save = () =>
    adopt.mutate(
      { lines, steps: read.steps, card },
      { onError: (e) => Alert.alert('Couldn’t use the lines', plainDbMessage(e) ?? e.message) },
    );

  return (
    <Surface style={styles.card}>
      <View style={styles.head}>
        <IconSymbol name="sparkles" size={20} color={ds.accentText} />
        <View style={styles.flex}>
          <Headline>{read.lines.length ? 'This recipe is a note' : 'This method is a note'}</Headline>
          <Caption tone="muted">
            {read.lines.length
              ? 'Here’s how we read it. Use these lines and it scales, you can Make it, and its allergens count.'
              : 'Here are its steps. Use them and Make walks through them one at a time.'}
          </Caption>
        </View>
      </View>
      {lines.length ? (
        <View role="list">
          {lines.map((l, i) => {
            const q = toQuantity(l.amount, l.unit);
            return (
              <View key={`${l.name}${i}`} role="listitem" style={[styles.line, { borderBottomColor: ds.c.line }]}>
                <Spec tone="accent" style={styles.amount}>
                  {q ? formatQuantity(q) : ''}
                </Spec>
                <View style={styles.flex}>
                  <Body>{l.name}</Body>
                  {l.note ? <Caption tone="muted">{l.note}</Caption> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {check ? (
        <View style={[styles.question, { backgroundColor: withAlpha(ds.accentText, 0.1) }]}>
          <Body>{check.listed ? `The list says ${check.listed}; the method adds ${check.method}. Which is right?` : `The method adds ${check.method}, which isn’t in the list.`}</Body>
          <View role="radiogroup" accessibilityLabel="Which is right" style={styles.chips}>
            <Chip label={check.listed ? `Keep ${check.listed}` : 'Leave it out'} selected={choice === 'keep'} onPress={() => setChoice('keep')} />
            {check.listed ? <Chip label={`${check.method} instead`} selected={choice === 'swap'} onPress={() => setChoice('swap')} /> : null}
            <Chip label={`Add ${check.method} too`} selected={choice === 'add'} onPress={() => setChoice('add')} />
          </View>
        </View>
      ) : null}
      {read.steps.length ? <Caption tone="muted">{`And ${read.steps.length} ${read.steps.length === 1 ? 'step' : 'steps'}: ${read.steps.slice(0, 3).map((s) => s.replace(/\.$/, '')).join(' · ')}${read.steps.length > 3 ? '…' : '.'}`}</Caption> : null}
      <View style={styles.actions}>
        <Button label={adopt.isPending ? 'Saving…' : read.lines.length ? 'Use these lines' : 'Use these steps'} disabled={adopt.isPending} onPress={save} />
        <Button label="Edit first" variant="secondary" onPress={() => router.push(`/ingredient/${itemId}/edit` as never)} />
      </View>
      <TextLink label={showNote ? 'Hide the note' : 'Show the note as written'} onPress={() => setShowNote(!showNote)} />
      {showNote ? <Body tone="muted">{note}</Body> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 72 },
  question: { borderRadius: radius.control, padding: space.md, gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
