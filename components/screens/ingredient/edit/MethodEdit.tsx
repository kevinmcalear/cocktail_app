import { Platform, StyleSheet, View } from 'react-native';
import DraggableFlatList, { NestableDraggableFlatList, ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';

import { Body, Caption, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { dragGripStyle, gripOnly, supportsNestableDrag } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import type { PrepFields } from '@/lib/prepCardForm';
import { newStepField } from '@/lib/prepCardForm';

import { GrowingField } from '../../drink/edit/EditParts';

type Step = PrepFields['steps'][number];

const GRIP = 32;
const List = supportsNestableDrag ? NestableDraggableFlatList : DraggableFlatList;
const web = Platform.OS === 'web';
const NO_OUTLINE = web ? ({ outlineStyle: 'none' } as object) : null;

/** The tools each step names (a venue's ice): their names, which the kit lacks, and the sheet that picks them. */
export interface StepTools {
  label: (tool: string) => string;
  missing: (tool: string) => boolean;
  onEdit: (stepKey: string) => void;
}

interface MethodEditProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  /** "3 steps · 20 min", beside the heading. */
  summary: string | null;
  heading?: string;
  placeholder?: string;
  tools?: StepTools;
}

/**
 * A house prep's Method in Edit (ingredient-edit-proposal): each step with a
 * grip to reorder, its number, its words in a box, and an x to remove it; a
 * dashed row adds one. Saved with Done.
 */
export function MethodEdit({ steps, onChange, summary, heading = 'Method', placeholder = 'Stir the honey into the hot water', tools }: MethodEditProps) {
  const ds = useDs();
  const set = (key: string, body: string) => onChange(steps.map((s) => (s.key === key ? { ...s, body } : s)));
  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<Step>) => {
    const i = getIndex() ?? 0;
    return (
      <ScaleDecorator>
        <View style={[styles.row, { borderBottomColor: ds.c.line, backgroundColor: isActive ? ds.c.raised : ds.c.ground }]}>
          <PressableScale role="button" accessibilityLabel={`Reorder step ${i + 1}`} onLongPress={web ? undefined : drag} onPressIn={web ? drag : undefined} style={[styles.grip, dragGripStyle]}>
            <IconSymbol name="line.3.horizontal" size={18} color={ds.c.muted} />
          </PressableScale>
          <View style={[styles.number, { backgroundColor: ds.c.raised }]}>
            <Caption>{String(i + 1)}</Caption>
          </View>
          <View style={styles.flex}>
            <Caption tone="muted">{`Step ${i + 1}`}</Caption>
            <GrowingField
              minHeight={type.body.lineHeight + space.lg}
              value={item.body}
              onChangeText={(body) => set(item.key, body)}
              placeholder={placeholder}
              placeholderTextColor={ds.c.faint}
              aria-label={`Step ${i + 1}`}
              style={[styles.body, NO_OUTLINE, { color: ds.c.ink, backgroundColor: ds.c.surface }]}
            />
            {tools ? (
              <PressableScale role="button" accessibilityLabel={`Tools for step ${i + 1}: ${item.tools.map(tools.label).join(', ') || 'none'}. Change them`} onPress={() => tools.onEdit(item.key)} style={styles.tools}>
                {item.tools.map((t) => (
                  <Tag key={t} label={tools.missing(t) ? `${tools.label(t)} · not in your kit` : tools.label(t)} tone={tools.missing(t) ? 'warning' : 'outline'} icon="hammer.fill" />
                ))}
                <Tag label={item.tools.length ? 'Change' : 'Tools'} tone="outline" icon="plus" />
              </PressableScale>
            ) : null}
          </View>
          <PressableScale role="button" accessibilityLabel={`Remove step ${i + 1}`} onPress={() => onChange(steps.filter((s) => s.key !== item.key))} style={styles.remove}>
            <IconSymbol name="xmark" size={16} color={ds.c.muted} />
          </PressableScale>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">{heading}</Headline>
        {summary ? <Caption tone="muted">{summary}</Caption> : null}
      </View>
      <List data={steps} keyExtractor={(s) => s.key} renderItem={renderItem} onDragEnd={({ data }) => onChange(data)} activationDistance={8} dragHitSlop={gripOnly(GRIP)} />
      <PressableScale role="button" accessibilityLabel="Add a step to the method" onPress={() => onChange([...steps, newStepField()])} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="plus" size={18} color={ds.accentText} />
        <Body style={styles.medium}>Add a step</Body>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  grip: { width: GRIP, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  number: { width: 26, height: 26, marginTop: space.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  body: { ...type.body, fontFamily: fontFamilies.body, borderRadius: radius.control, padding: space.sm, textAlignVertical: 'top' },
  remove: { width: 32, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', marginTop: space.xs },
  medium: { fontFamily: fontFamilies.bodyMedium },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingTop: space.xs },
});
