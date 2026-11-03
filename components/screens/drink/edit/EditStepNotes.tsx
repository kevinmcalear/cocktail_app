import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Skeleton } from '@/components/ui/Skeleton';
import { font, radius, space, type } from '@/constants/tokens';
import type { useCocktailEditor } from '@/hooks/useCocktailEditor';
import { methodVerb } from '@/lib/specView';
import { ASIDE_MAX, draftSteps, noteLeft, NOTE_MAX, type StepWords } from '@/lib/stepNotes';

import { Eyebrow } from '../../addDrink/WizardChrome';
import { GrowingField } from './EditParts';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;
const ANDROID = Platform.OS === 'android';
/** The note box's padding plus its edge, so the words stay put when the edge thickens on focus. */
const BOX_INSET = 15;

type Editor = ReturnType<typeof useCocktailEditor>;
type Step = ReturnType<typeof draftSteps>[number];

/**
 * The words on a drink's steps, as the Steps view reads them (boards
 * Miss-steps, Miss-steps-cases, Miss-steps-desk): each step as the page names
 * it with an aside beside the name, a line of what's in it, and a note under
 * that. A garnish has a note and no aside. With no method to name it, the
 * first step says how to name it. Its steps are the page's, from the lines and
 * parts as they stand.
 */
export function EditStepNotes({ editor, known = [] }: { editor: Editor; /** The drink's methods as it loaded, named before the full list of methods is in. */ known?: readonly { method_item_id: string; method?: { name: string } | null }[] }) {
  const named = new Map([...known.map((m) => [m.method_item_id, m.method?.name ?? ''] as const), ...editor.methods.map((m) => [m.id, m.name] as const)]);
  const verb = methodVerb(editor.methodIds.map((id) => named.get(id) ?? ''));
  const parts = editor.parts && editor.parts.length > 1 ? editor.parts : null;
  const groups = draftSteps(editor.recipeItems, parts, verb);
  if (!groups.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headRow}>
        <Eyebrow>Steps</Eyebrow>
        <Caption tone="muted">Shown in Steps</Caption>
      </View>
      {editor.stepNotesStatus === 'loading' ? <StepsLoading /> : null}
      {editor.stepNotesStatus === 'failed' ? <StepsFailed onRetry={() => void editor.retryStepNotes()} /> : null}
      {editor.stepNotesStatus === 'ready'
        ? groups.map((g) => <StepField key={g.key} step={g} words={editor.stepNotes[g.key]} onChange={(patch) => editor.setStepNote(g.key, patch)} />)
        : null}
    </View>
  );
}

function StepField({ step, words, onChange }: { step: Step; words?: StepWords; onChange: (patch: Partial<StepWords>) => void }) {
  const ds = useDs();
  const [focus, setFocus] = useState<'aside' | 'note' | null>(null);
  const note = words?.note ?? '';
  const name = step.title ?? step.tag ?? 'The spec';
  const left = noteLeft(note);
  const onNote = focus === 'note';
  const asideOn = focus === 'aside';
  // iOS and the web: a card. Android: Material's outlined field, its label on the edge once there are words.
  const edge = onNote ? (ANDROID ? 2 : 1.5) : ANDROID ? 1 : StyleSheet.hairlineWidth;
  const box = {
    backgroundColor: ANDROID ? 'transparent' : ds.c.surface,
    borderColor: onNote ? ds.accentText : ANDROID ? ds.c.faint : ds.c.line,
    borderWidth: edge,
    padding: BOX_INSET - edge,
  };
  return (
    <View>
      <View style={[styles.head, { borderBottomColor: asideOn ? ds.accentText : ds.c.line, borderBottomWidth: asideOn ? 1.5 : StyleSheet.hairlineWidth }]}>
        {step.number ? (
          <DsText variant="label" color={ds.accentText} style={font.figuresMedium}>
            {step.number}
          </DsText>
        ) : null}
        <DsText variant="label" color={ds.accentText} style={font.semiBold}>
          {name}
        </DsText>
        {/* The page shows an aside only beside a step's name. */}
        {step.title ? (
          <TextInput
            value={words?.aside ?? ''}
            onChangeText={(aside) => onChange({ aside })}
            onFocus={() => setFocus('aside')}
            onBlur={() => setFocus(null)}
            maxLength={ASIDE_MAX}
            placeholder="Add an aside"
            placeholderTextColor={ds.c.muted}
            accessibilityLabel={`${name}: aside`}
            style={[styles.aside, NO_OUTLINE, { color: ds.c.ink }]}
          />
        ) : !step.tag ? (
          <DsText variant="label" tone="muted" style={styles.hint}>
            Pick a method to name this step
          </DsText>
        ) : null}
      </View>
      <DsText variant="label" tone="muted" numberOfLines={1} style={styles.lines}>
        {step.lines.map((l) => l.name).join(', ')}
      </DsText>
      <View>
        <GrowingField
          minHeight={48}
          value={note}
          onChangeText={(text) => onChange({ note: text })}
          onFocus={() => setFocus('note')}
          onBlur={() => setFocus(null)}
          maxLength={NOTE_MAX}
          placeholder={step.tag ? 'Add a note on the garnish' : 'Add a note under this step'}
          placeholderTextColor={ds.c.muted}
          accessibilityLabel={`${name}: note`}
          style={[styles.box, box, NO_OUTLINE, { color: ds.c.ink }]}
        />
        {ANDROID && (note || onNote) ? (
          <Caption color={onNote ? ds.accentText : ds.c.muted} style={[styles.floatLabel, { backgroundColor: ds.c.ground }]}>
            Note
          </Caption>
        ) : null}
      </View>
      {left ? (
        <Caption tone="muted" align="right" style={styles.left}>
          {left}
        </Caption>
      ) : null}
    </View>
  );
}

/** Two steps' shapes while the words come in. */
function StepsLoading() {
  return (
    <View style={styles.steps} aria-label="Loading the steps" role="progressbar">
      {[0, 1].map((i) => (
        <View key={i} style={styles.loading}>
          <Skeleton width={118} height={16} />
          <Skeleton width="70%" height={12} />
          <Skeleton height={52} />
        </View>
      ))}
    </View>
  );
}

function StepsFailed({ onRetry }: { onRetry: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.failed, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <IconSymbol name="exclamationmark.triangle" size={20} color={ds.accentText} />
      <View style={styles.failedText}>
        <Body style={font.semiBold}>Step words didn’t load</Body>
        <DsText variant="label" tone="muted">
          Everything else here still saves. Try again to write on the steps.
        </DsText>
        <Button label="Try again" variant="ink" size="sm" onPress={onRetry} style={styles.retry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.lg },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -space.md },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, minHeight: 44, paddingTop: space.lg, paddingBottom: 7 },
  aside: { ...type.label, ...font.regular, flex: 1, minWidth: 0, padding: 0 },
  hint: { flex: 1, minWidth: 0 },
  lines: { paddingTop: space.sm, paddingBottom: ANDROID ? 14 : space.sm },
  box: { ...type.label, ...font.regular, borderRadius: radius.control, textAlignVertical: 'top' },
  floatLabel: { position: 'absolute', left: 10, top: -9, paddingHorizontal: space.xs },
  left: { paddingTop: 6 },
  steps: { gap: space.xl },
  loading: { gap: space.md },
  failed: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth },
  failedText: { flex: 1, gap: space.xs },
  retry: { alignSelf: 'flex-start', marginTop: space.sm },
});
