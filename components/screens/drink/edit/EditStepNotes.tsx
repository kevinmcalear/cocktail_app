import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Caption, DsText, Headline, useDs } from '@/components/ds';
import { font, radius, space, type } from '@/constants/tokens';
import type { useCocktailEditor } from '@/hooks/useCocktailEditor';
import { methodVerb } from '@/lib/specView';
import { ASIDE_MAX, draftSteps, NOTE_MAX } from '@/lib/stepNotes';

import { GrowingField } from './EditParts';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/**
 * The words on a drink's steps, as the Steps view reads them (boards
 * Decided-spec-groups, who-bartender, who-creator): an aside beside a step's
 * name ("hard, with ice") and a note under its lines. Its steps are the
 * page's, from the lines and parts as they stand; a garnish has a note and no
 * name, so no aside.
 */
export function EditStepNotes({ editor, known = [] }: { editor: ReturnType<typeof useCocktailEditor>; /** The drink's methods as it loaded, named before the full list of methods is in. */ known?: readonly { method_item_id: string; method?: { name: string } | null }[] }) {
  const ds = useDs();
  const named = new Map([...known.map((m) => [m.method_item_id, m.method?.name ?? ''] as const), ...editor.methods.map((m) => [m.id, m.name] as const)]);
  const verb = methodVerb(editor.methodIds.map((id) => named.get(id) ?? ''));
  const parts = editor.parts && editor.parts.length > 1 ? editor.parts : null;
  const groups = draftSteps(editor.recipeItems, parts, verb);
  if (!editor.stepNotesRead || !groups.length) return null;
  const field = { color: ds.c.ink, backgroundColor: ds.c.surface };

  return (
    <View style={styles.section}>
      <View style={styles.headRow}>
        <Headline role="heading">Steps</Headline>
        <Caption tone="muted">Shown in Steps</Caption>
      </View>
      {groups.map((g) => {
        const words = editor.stepNotes[g.key];
        const name = g.title ?? g.tag ?? 'The spec';
        return (
          <View key={g.key} style={styles.step}>
            <View style={styles.head}>
              {g.number ? (
                <DsText variant="label" color={ds.accentText} style={font.figuresMedium}>
                  {g.number}
                </DsText>
              ) : null}
              <DsText variant="label" color={ds.accentText} style={font.semiBold}>
                {name}
              </DsText>
              {/* The page shows an aside only beside a step's name. */}
              {g.title ? (
                <TextInput
                  value={words?.aside ?? ''}
                  onChangeText={(aside) => editor.setStepNote(g.key, { aside })}
                  maxLength={ASIDE_MAX}
                  placeholder="An aside: hard, with ice"
                  placeholderTextColor={ds.c.muted}
                  accessibilityLabel={`${name}: aside`}
                  style={[styles.aside, NO_OUTLINE, { color: ds.c.muted, borderBottomColor: ds.c.line }]}
                />
              ) : null}
            </View>
            <GrowingField
              minHeight={48}
              value={words?.note ?? ''}
              onChangeText={(note) => editor.setStepNote(g.key, { note })}
              maxLength={NOTE_MAX}
              placeholder={g.tag ? 'On a pick, resting across the rim' : 'Under this step: strain over one large cube'}
              placeholderTextColor={ds.c.muted}
              accessibilityLabel={`${name}: note`}
              style={[styles.box, NO_OUTLINE, field]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  step: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  aside: { ...type.label, ...font.regular, flex: 1, minWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.xs },
  box: { ...type.label, ...font.regular, borderRadius: radius.control, padding: space.md, textAlignVertical: 'top' },
});
