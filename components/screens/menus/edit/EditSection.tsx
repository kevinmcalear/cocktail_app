import { StyleSheet, View } from 'react-native';
import DraggableFlatList, { NestableDraggableFlatList, type RenderItemParams } from 'react-native-draggable-flatlist';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { gripOnly, supportsNestableDrag } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, space, STATUS } from '@/constants/tokens';
import { readableAccent } from '@/lib/color';
import type { EditSection as Section } from '@/lib/menuLayout';
import { sectionLine } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import type { MenuInk } from '../page/MenuDrawing';
import type { RowPricing } from '../RowPrice';
import { UnfinishedDrinks } from '../UnfinishedDrinks';
import { dropSection } from '../useMenuDrag';
import { DropSlot, EditRow, HANDLE } from './EditRow';

interface EditSectionProps {
  section: Section;
  /** The menu's venue, or null at home: where its unfinished drinks were kept. */
  barId: string | null;
  ink: MenuInk;
  /** Drinks made from this menu just now, marked New. */
  made: string[];
  /** The pencil after the name: rename, rules, move, paste a list, remove. */
  onSettings: () => void;
  onAdd: () => void;
  onRemove: (drinkId: string) => void;
  onReorder: (drinks: MenuDrink[]) => void;
  onMove: (from: number, to: number) => void;
  onOpen: (drink: MenuDrink) => void;
  /** A venue's menu: the price box changes the drink's own price and this menu's. */
  pricing?: (drink: MenuDrink) => RowPricing;
  elsewhere: Record<string, string>;
  /** Desktop web: the browser's drag and drop (useMenuDrag) across sections, in place of the handle drag. */
  drag?: { at: number | null; dragging: string | null };
}

const noDrag = () => {};
const List = supportsNestableDrag ? NestableDraggableFlatList : DraggableFlatList;

/**
 * One section of the menu being edited in place: the page's small-capitals
 * name with a pencil and its count, its rows (drag the handle to reorder),
 * then "Add a drink to Stirred" (Menu-who-creator-edit). A section short of
 * its rule says so in amber under the name.
 */
export function EditSection({ section, barId, ink, made, onSettings, onAdd, onRemove, onReorder, onMove, onOpen, pricing, elsewhere, drag: web }: EditSectionProps) {
  const ds = useDs();
  const count = section.drinks.length;
  const line = sectionLine(section);
  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<MenuDrink>) => {
    const i = getIndex() ?? 0;
    return (
      <EditRow
        drink={item}
        index={i}
        count={count}
        ink={ink}
        isNew={made.includes(item.id)}
        active={isActive}
        drag={web ? noDrag : drag}
        onRemove={() => onRemove(item.id)}
        onMove={onMove}
        onOpen={() => onOpen(item)}
        pricing={pricing?.(item)}
        alsoOn={elsewhere[item.id]}
        web={web ? { from: section.key, slot: web.at === i ? 'before' : web.at === count && i === count - 1 ? 'after' : null, dragging: web.dragging === item.id } : undefined}
      />
    );
  };
  return (
    <View {...(web ? dropSection(section.key) : {})} style={styles.section}>
      <PressableScale accessibilityLabel={`${section.name || 'Section'}: rename, rules, move, paste a list`} onPress={onSettings} style={styles.head}>
        <View style={styles.name}>
          <Caption tone="muted" role="heading" numberOfLines={1} style={styles.caps}>
            {(section.name || 'Untitled section').toUpperCase()}
          </Caption>
          <IconSymbol name="pencil" size={13} color={ds.c.muted} />
        </View>
        <Caption tone="muted" style={font.figures}>
          {count}
        </Caption>
      </PressableScale>
      {line.problem ? (
        <Caption color={readableAccent(STATUS.warning, ds.c.ground)} style={styles.rule}>
          {line.text}
        </Caption>
      ) : null}
      {count ? (
        <List
          data={section.drinks}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => onReorder(data)}
          scrollEnabled={false}
          activationDistance={10}
          dragHitSlop={gripOnly(HANDLE)}
        />
      ) : null}
      {web && !count && web.at === 0 ? <DropSlot /> : null}
      <UnfinishedDrinks barId={barId} sectionKey={section.key} />
      <PressableScale accessibilityLabel={`Add a drink to ${section.name || 'this section'}`} onPress={onAdd} style={[styles.add, { borderTopColor: ds.c.lineStrong }]}>
        <IconSymbol name="plus" size={18} color={ds.accentText} />
        <DsText variant="body" color={ds.accentText} style={font.semiBold} numberOfLines={1}>
          {`Add a drink to ${section.name || 'this section'}`}
        </DsText>
      </PressableScale>
      <View style={[styles.close, { borderTopColor: ds.c.lineStrong }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 36, paddingBottom: space.xs },
  name: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  caps: { letterSpacing: 1.5, ...font.figures },
  rule: { paddingBottom: space.sm },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth },
  close: { borderTopWidth: StyleSheet.hairlineWidth },
});
