import { StyleSheet, View } from 'react-native';
import DraggableFlatList, { NestableDraggableFlatList, type RenderItemParams } from 'react-native-draggable-flatlist';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { STATUS } from '@/constants/palette';
import { gripOnly, supportsNestableDrag } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { EditSection } from '@/lib/menuLayout';
import { readableAccent } from '@/lib/color';
import { sectionLine } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { DropSlot, EditorRow, GRIP } from './EditorRow';
import { dropSection } from './useMenuDrag';

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
  /** Drinks made from this menu just now, marked New. */
  made?: string[];
  onRemove: (drinkId: string) => void;
  onReorder: (drinks: MenuDrink[]) => void;
  onMove: (from: number, to: number) => void;
  /** Desktop web: the browser's drag and drop (useMenuDrag) instead of the grip drag. */
  drag?: { at: number | null; dragging: string | null };
  /** A venue's menu: changes a drink's own price. */
  onPrice?: (drinkId: string, price: string | null) => void;
  /** Drinks also on another of the venue's menus, by id: that menu's name. */
  elsewhere?: Record<string, string>;
}

const noDrag = () => {};

const ListComponent = supportsNestableDrag ? NestableDraggableFlatList : DraggableFlatList;

/**
 * One section being edited: its name and rule, its drinks in order (drag to
 * reorder), and adding more. No box of its own: on desktop the section the
 * library adds to sits on a raised ground, tagged "Adding here".
 */
export function EditorSection({ section, sections, targeted, onTarget, onAdd, onSettings, home, made, onRemove, onReorder, onMove, onMoveTo, drag: web, onPrice, elsewhere }: EditorSectionProps) {
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
      isNew={!!made?.includes(item.id)}
      active={isActive}
      drag={web ? noDrag : drag}
      web={web ? { from: section.key, slot: web.at === getIndex() ? 'before' : web.at === count && getIndex() === count - 1 ? 'after' : null, dragging: web.dragging === item.id } : undefined}
      onRemove={() => onRemove(item.id)}
      onMove={onMove}
      others={others}
      onMoveTo={(toKey) => onMoveTo(item.id, toKey)}
      onPrice={onPrice ? (price) => onPrice(item.id, price) : undefined}
      alsoOn={elsewhere?.[item.id]}
    />
  );

  return (
    <View {...(web ? dropSection(section.key) : {})} style={[styles.section, targeted && { backgroundColor: ds.c.surface }]}>
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
        {targeted ? (
          // An outlined mono tag in the accent, as drawn: the one place the library adds to.
          <View style={[styles.adding, { borderColor: ds.accentText }]}>
            <Caption color={ds.accentText} style={styles.mono}>
              ADDING HERE
            </Caption>
          </View>
        ) : null}
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
      {web && !count && web.at === 0 ? <DropSlot /> : null}
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
  adding: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 2 },
  mono: { fontFamily: fontFamilies.mono, letterSpacing: 1.2 },
  add: { marginTop: space.sm, minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
