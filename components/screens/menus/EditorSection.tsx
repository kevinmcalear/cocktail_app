import { StyleSheet, View } from 'react-native';
import DraggableFlatList, { NestableDraggableFlatList, type RenderItemParams } from 'react-native-draggable-flatlist';

import { Caption, DsText, PressableScale, Tag, useDs } from '@/components/ds';
import { STATUS } from '@/constants/palette';
import { gripOnly, supportsNestableDrag } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { EditSection } from '@/lib/menuLayout';
import { readableAccent } from '@/lib/color';
import { sectionLine } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { EditorRow, GRIP } from './EditorRow';

interface EditorSectionProps {
  section: EditSection;
  /** The section new drinks go into on desktop (clicking one in the library). */
  targeted?: boolean;
  onTarget?: () => void;
  /** Desktop: the targeted section's own Add a drink. A phone has one after every section. */
  onAdd?: () => void;
  /** Every section, for a row's "Move to another section". */
  sections: EditSection[];
  onMoveTo: (drinkId: string, toKey: string) => void;
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
export function EditorSection({ section, sections, targeted, onTarget, onAdd, onSettings, home, onRemove, onReorder, onMove, onMoveTo }: EditorSectionProps) {
  const ds = useDs();
  const count = section.drinks.length;
  const line = sectionLine(section);
  const others = sections.filter((s) => s.key !== section.key).map((s) => ({ key: s.key, name: s.name }));

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<MenuDrink>) => (
    <EditorRow
      drink={item}
      index={getIndex() ?? 0}
      count={count}
      home={home}
      active={isActive}
      drag={drag}
      onRemove={() => onRemove(item.id)}
      onMove={onMove}
      others={others}
      onMoveTo={(toKey) => onMoveTo(item.id, toKey)}
    />
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
          <Caption tone="muted" color={line.problem ? readableAccent(STATUS.warning, ds.c.ground) : undefined}>
            {line.text}
          </Caption>
        </PressableScale>
        {targeted ? <Tag label="Adding here" tone="accent" /> : null}
        <PressableScale accessibilityLabel={`${section.name} section options: rename, rules, paste a list`} onPress={onSettings} style={styles.icon}>
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
          dragHitSlop={gripOnly(GRIP, 'right')}
        />
      ) : null}
      {onAdd ? (
        <PressableScale accessibilityLabel={`Add a drink to ${section.name}`} onPress={onAdd} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="plus" size={16} color={ds.c.ink} />
          <DsText variant="caption">Add a drink</DsText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.md, marginHorizontal: -space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, gap: 2 },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  add: { marginTop: space.sm, minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
