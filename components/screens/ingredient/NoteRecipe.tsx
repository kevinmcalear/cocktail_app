import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Headline, Spec, Surface, Tag, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useAdoptNoteRecipe, type PrepCardData } from '@/hooks/usePrepCard';
import { withAlpha } from '@/lib/color';
import { plainDbMessage } from '@/lib/dbError';
import type { NoteLine, NoteRecipe as Read } from '@/lib/noteRecipe';
import { formatQuantity, toQuantity } from '@/lib/quantity';

type Choice = 'keep' | 'swap' | 'add';

/** Which way the mix-up question went, and the lines that makes. The page holds it: the card shows it, the pinned bar saves it. */
export function useNoteChoice(read: Read | null) {
  const [choice, setChoice] = useState<Choice>('keep');
  const check = read?.check;
  const all = read?.lines ?? [];
  const lines: NoteLine[] = !check
    ? all
    : choice === 'swap' && check.listed
      ? all.map((l) => (l.name === check.listed ? { ...l, name: check.method } : l))
      : choice === 'add'
        ? [...all, { amount: null, unit: null, name: check.method }]
        : all;
  return { choice, setChoice, lines };
}

interface NoteRecipeProps {
  note: string;
  read: Read;
  choice: ReturnType<typeof useNoteChoice>;
}

/**
 * A recipe written as a note, read into lines and steps for the person who
 * can edit it (prep-prep-note). When the method names something the list
 * doesn't, the line carries a Check tag and the question offers the two
 * names. Use these lines and Edit first sit in the pinned bar (NoteBar); the
 * note as written opens under the card.
 */
export function NoteRecipe({ note, read, choice: { choice, setChoice, lines } }: NoteRecipeProps) {
  const ds = useDs();
  const [showNote, setShowNote] = useState(false);
  const check = read.check;
  // The line in question: the listed name, or after a swap the method's.
  const questioned = check ? (choice === 'swap' ? check.method : (check.listed ?? (choice === 'add' ? check.method : null))) : null;

  return (
    <View style={styles.stack}>
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
                  {l.name === questioned ? <Tag label="Check" tone="warning" /> : null}
                </View>
              );
            })}
          </View>
        ) : null}
        {check ? (
          <View style={[styles.question, { backgroundColor: withAlpha(ds.accentText, 0.1) }]}>
            <Body>{check.listed ? `The list says ${check.listed}, the method says to add ${check.method}. Which one?` : `The method adds ${check.method}, which isn’t in the list.`}</Body>
            <View role="radiogroup" aria-label="Which one" style={styles.chips}>
              {check.listed ? (
                <>
                  <Chip label={check.listed} selected={choice === 'keep'} onPress={() => setChoice('keep')} />
                  <Chip label={check.method} selected={choice === 'swap'} onPress={() => setChoice('swap')} />
                </>
              ) : (
                <>
                  <Chip label="Leave it out" selected={choice === 'keep'} onPress={() => setChoice('keep')} />
                  <Chip label={`Add ${check.method}`} selected={choice === 'add'} onPress={() => setChoice('add')} />
                </>
              )}
            </View>
          </View>
        ) : null}
        {read.steps.length ? <Caption tone="muted">{`And ${read.steps.length} ${read.steps.length === 1 ? 'step' : 'steps'}: ${read.steps.slice(0, 3).map((s) => s.replace(/\.$/, '')).join(' · ')}${read.steps.length > 3 ? '…' : '.'}`}</Caption> : null}
      </Surface>
      <TextLink label={showNote ? 'Hide the note' : 'Show the note as written'} onPress={() => setShowNote(!showNote)} />
      {showNote ? <Body tone="muted">{note}</Body> : null}
    </View>
  );
}

/** Pinned under a phone page while the recipe is still a note (inline on wide screens): Edit first, or Use these lines. */
export function NoteBar({ itemId, barId, read, lines, card, bottom, inline }: { itemId: string; barId: string | null; read: Read; lines: NoteLine[]; card: PrepCardData | undefined; bottom: number; inline?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const adopt = useAdoptNoteRecipe(itemId, barId);
  const save = () => adopt.mutate({ lines, steps: read.steps, card }, { onError: (e) => Alert.alert('Couldn’t use the lines', plainDbMessage(e) ?? e.message) });
  return (
    <View style={inline ? styles.inline : [styles.bar, { paddingBottom: bottom + space.md, backgroundColor: ds.c.ground, borderTopColor: ds.c.line }]}>
      <Button label="Edit first" variant="secondary" size="lg" onPress={() => router.push(`/ingredient/${itemId}/edit` as never)} style={styles.grow} />
      <Button label={adopt.isPending ? 'Saving…' : read.lines.length ? 'Use these lines' : 'Use these steps'} size="lg" disabled={adopt.isPending} onPress={save} style={styles.grow} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  card: { gap: space.md },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 72 },
  question: { borderRadius: radius.control, padding: space.md, gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  inline: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
});
