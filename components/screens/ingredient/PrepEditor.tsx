import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, Field, PressableScale, TextLink, useDs, useGutter } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { displayFaces, fontFamilies, layout, radius, space, type } from '@/constants/tokens';

export interface PrepEditorLine {
  ingredient_id: string;
  name: string;
  amount: string;
  unit: string;
}

interface PrepEditorProps {
  name: string;
  onName: (name: string) => void;
  lines: PrepEditorLine[];
  onAmount: (index: number, amount: string) => void;
  onAdd: () => void;
  description: string;
  onDescription: (text: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  /** The full form: brand, ABV, tags, who sees it, reordering and removing lines. */
  onAllFields: () => void;
}

/**
 * Editing a house prep (prep-prep-edit-shared): Back, PREP and Save, the name
 * in the venue's serif, then each line with its amount in a box to type in.
 * Save asks first when other drinks use it (useAskAtSave, in the route).
 */
export function PrepEditor(props: PrepEditorProps) {
  return (
    <VenueBrandProvider>
      <PrepEditorBody {...props} />
    </VenueBrandProvider>
  );
}

function PrepEditorBody({ name, onName, lines, onAmount, onAdd, description, onDescription, onBack, onSave, saving, onAllFields }: PrepEditorProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }]}>
        <View style={styles.head}>
          <PressableScale role="button" accessibilityLabel="Back" onPress={onBack} style={styles.headSide}>
            <Body>Back</Body>
          </PressableScale>
          <Caption tone="muted" style={styles.eyebrow}>
            PREP
          </Caption>
          <PressableScale role="button" accessibilityLabel="Save" aria-disabled={saving} disabled={saving} onPress={onSave} style={[styles.headSide, styles.right]}>
            <Body color={ds.accentText} style={styles.bold}>
              {saving ? 'Saving…' : 'Save'}
            </Body>
          </PressableScale>
        </View>
        <TextInput
          value={name}
          onChangeText={onName}
          aria-label="Name"
          placeholder="Name"
          placeholderTextColor={ds.c.faint}
          style={[type.title, styles.title, { fontFamily: displayFaces[ds.displayFace].regular, color: ds.c.ink }]}
        />
        <View role="list" aria-label="Recipe">
          {lines.map((l, i) => (
            <Line key={`${l.ingredient_id}-${i}`} line={l} onAmount={(a) => onAmount(i, a)} />
          ))}
        </View>
        <View style={styles.links}>
          <TextLink label="+ Add ingredient" onPress={onAdd} />
        </View>
        <Field label="About it" value={description} onChangeText={onDescription} placeholder="What it is and how it tastes" minLines={3} />
        <View style={styles.links}>
          <TextLink label="All fields" tone="ink" onPress={onAllFields} />
        </View>
      </ScrollView>
    </View>
  );
}

/** One line: the ingredient, then its amount in a box that rings in the accent while you type. */
function Line({ line, onAmount }: { line: PrepEditorLine; onAmount: (amount: string) => void }) {
  const ds = useDs();
  const [focused, setFocused] = useState(false);
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <Body numberOfLines={2} style={styles.flex}>
        {line.name}
      </Body>
      <View style={[styles.box, { backgroundColor: ds.c.raised, borderColor: focused ? ds.accentFill.fill : 'transparent' }]}>
        <TextInput
          value={line.amount}
          onChangeText={onAmount}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="decimal"
          keyboardType="decimal-pad"
          aria-label={`${line.name}, amount${line.unit ? ` in ${line.unit}` : ''}`}
          placeholder="0"
          placeholderTextColor={ds.c.faint}
          // ponytail: sized by its characters so the unit sits right after the number; a measured width if mono ever changes.
          style={[type.spec, styles.amount, { width: Math.max(1, line.amount.length) * 11 + 4, color: ds.c.ink }]}
        />
        {line.unit ? <Body style={[styles.mono, { color: ds.c.ink }]}>{line.unit}</Body> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: layout.page.text, alignSelf: 'center', gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: layout.minTapTarget },
  headSide: { minWidth: 72, minHeight: layout.minTapTarget, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  eyebrow: { letterSpacing: 1.2 },
  bold: { fontFamily: fontFamilies.bodySemiBold },
  title: { paddingVertical: space.xs, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minWidth: 88, height: 40, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 2 },
  amount: { fontFamily: fontFamilies.mono, textAlign: 'right', padding: 0 },
  mono: { fontFamily: fontFamilies.mono },
  links: { alignItems: 'flex-start', paddingVertical: space.xs },
});
