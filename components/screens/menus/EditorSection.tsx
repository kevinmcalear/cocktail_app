import { StyleSheet, View } from 'react-native';
import DraggableFlatList, { NestableDraggableFlatList, type RenderItemParams } from 'react-native-draggable-flatlist';

import { Caption, DsText, PressableScale, Tag, useDs } from '@/components/ds';
import { gripOnly, supportsNestableDrag } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { EditSection } from '@/lib/menuLayout';
import { sectionRule } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { EditorRow, GRIP } from './EditorRow';

interface EditorSectionProps {
  section: EditSection;
  /** The section new drinks go into on desktop (clicking one in the library). */
  targeted?: boolean;
  onTarget?: () => void;
  onAdd: () => void;
  onSettings: () => void;
  /** A home menu: no prices on the rows. */
  home?: boolean;
  onRemove: (drinkId: string) => void;
  onReorder: (drinks: MenuDrink[]) => void;
  onMove: (from: number, to: number) => void;
}

const ListComponent = supportsNestableDrag ? NestableDraggableFlatList : DraggableFlatList;

/**
 * One section being edited: its name and rule, its drinks in order (drag to
 * reorder), and adding more. No box of its own: on desktop the section the
 * library adds to sits on a raised ground, tagged "Adding here".
 */
export function EditorSection({ section, targeted, onTarget, onAdd, onSettings, home, onRemove, onReorder, onMove }: EditorSectionProps) {
  const ds = useDs();
  const count = section.drinks.length;
  const short = section.minItems - count;
  const over = section.maxItems !== null ? count - section.maxItems : 0;
  const problem = short > 0 ? `Needs ${short} more` : over > 0 ? `${over} too many` : null;

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<MenuDrink>) => (
    <EditorRow drink={item} index={getIndex() ?? 0} count={count} home={home} active={isActive} drag={drag} onRemove={() => onRemove(item.id)} onMove={onMove} />
  );

  return (
    <View style={[styles.section, targeted && { backgroundColor: ds.c.surface }]}>
      <View style={styles.head}>
        <PressableScale
          accessibilityLabel={onTarget ? `${section.name}: add drinks here` : section.name}
          aria-selected={targeted}
          onPress={onTarget}
          disabled={!onTarget}
          style={styles.flex}
        >
          <DsText variant="title" numberOfLines={1}>
            {section.name}
          </DsText>
          <View style={styles.rule}>
            <Caption tone="muted">{`${sectionRule(section)} · ${count} in`}</Caption>
            {problem ? <Tag label={problem} tone="warning" /> : null}
          </View>
        </PressableScale>
        {targeted ? <Tag label="Adding here" tone="accent" /> : null}
        <PressableScale accessibilityLabel={`${section.name} settings`} onPress={onSettings} style={styles.icon}>
          <IconSymbol name="ellipsis" size={18} color={ds.c.muted} />
        </PressableScale>
      </View>
      {count ? (
        <ListComponent
          data={section.drinks}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => onReorder(data)}
          scrollEnabled={false}
          activationDistance={10}
          dragHitSlop={gripOnly(GRIP)}
        />
      ) : null}
      <PressableScale accessibilityLabel={`Add a drink to ${section.name}`} onPress={onAdd} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="plus" size={16} color={ds.c.ink} />
        <DsText variant="caption">Add a drink</DsText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.md, marginHorizontal: -space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rule: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1, gap: 2 },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  add: { marginTop: space.sm, minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
