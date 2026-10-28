import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, EquipmentDrawing, Headline, IngredientDrawing, MatchText, PressableScale, useDs, useSheetClose, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { layout, radius, space } from '@/constants/tokens';
import type { FoundItem } from '@/hooks/useHomeBar';
import { useKit } from '@/hooks/useKit';
import { leftOutLine } from '@/lib/myBarAdd';
import { foundLine } from '@/lib/myBarText';
import { EQUIPMENT, EQUIPMENT_KINDS, matchesEquipment } from '@/lib/techniques';

import { BarTile, TileGrid } from './BarTile';

// The pieces of Add to your bar (AddToBarSheet): an idea tile, a typed
// result, a link under a tile, the ways on when nothing is found, the snap
// row, the footer, and the kit list.

/** A link under a tile: a house prep's Recipe, a style's "Which gin?". */
export function TileLink({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <PressableScale role="link" accessibilityLabel={a11y} onPress={onPress} style={styles.recipe}>
      <Caption tone="accent">{label}</Caption>
    </PressableScale>
  );
}

/** A house prep's recipe, to make it. */
export function RecipeLink({ name, onPress }: { name: string; onPress: () => void }) {
  return <TileLink label="Recipe" a11y={`${name} recipe`} onPress={onPress} />;
}

/** An idea to tick: on your bar shows a ring and a check, which says it without a caption. `meta` says what took a style's place. */
export function IdeaTile({ item, has, meta, onToggle }: { item: FoundItem; has: boolean; meta?: string; onToggle: (item: FoundItem, add: boolean) => void }) {
  return (
    <BarTile
      name={item.name}
      meta={meta ?? foundLine(item)}
      picture={<IngredientDrawing id={item.id} name={item.name} lazy />}
      role="checkbox"
      checked={has}
      accessibilityLabel={item.name}
      accessibilityHint={has ? 'Takes it off your bar' : 'Puts it on your bar'}
      badge={has ? 'check' : 'plus'}
      onPress={() => onToggle(item, !has)}
    />
  );
}

/** A typed result you tick to have: the drawing, the name, and a check or a plus. */
export function Result({ name, sub, query, thumb, has, onToggle, extra }: { name: string; sub?: string; query?: string; thumb?: ReactNode; has: boolean; onToggle: (on: boolean) => void; extra?: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <PressableScale role="checkbox" aria-checked={has} accessibilityLabel={name} accessibilityHint={has ? 'Takes it off your bar' : 'Puts it on your bar'} onPress={() => onToggle(!has)} style={styles.rowMain}>
        {thumb}
        <View style={styles.name}>
          <Headline numberOfLines={1}>
            <MatchText text={name} query={query} look="tint" />
          </Headline>
          {sub ? <Caption tone={has ? 'accent' : 'muted'}>{sub}</Caption> : null}
        </View>
        <IconSymbol name={has ? 'checkmark.circle.fill' : 'plus.circle'} size={26} color={has ? ds.accentText : ds.c.muted} />
      </PressableScale>
      {extra}
    </View>
  );
}

/** At the end of typed results: snap the bottle instead. */
export function SnapRow({ onSnap }: { onSnap: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="Snap the bottle" onPress={onSnap} style={styles.rowMain}>
      <View style={[styles.snapIcon, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="camera.fill" size={20} color={ds.c.ink} />
      </View>
      <Body tone="muted" style={styles.name}>
        Not here? Snap the bottle and we’ll find it.
      </Body>
    </PressableScale>
  );
}

/** One way on when a search finds nothing: an icon tile, what it does, and a line under it. */
function Way({ icon, title, line, onPress, disabled }: { icon: IconName; title: string; line: string; onPress: () => void; disabled?: boolean }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={title} accessibilityHint={line} onPress={onPress} disabled={disabled} style={[styles.rowMain, styles.way, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.wayIcon, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name={icon} size={20} color={ds.c.ink} />
      </View>
      <View style={styles.name}>
        <Headline numberOfLines={2}>{title}</Headline>
        <Caption tone="muted">{line}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
    </PressableScale>
  );
}

/** Nothing found: the drink wizard's three ways on, in its order: by name, made in house, or a photo. */
export function WaysOn({ name, adding, onName, onMake, onSnap }: { name: string; adding: boolean; onName: () => void; onMake: () => void; onSnap: () => void }) {
  return (
    <View>
      <Way icon="plus.circle" title={adding ? `Adding “${name}”…` : `Add “${name}”`} line="Just the name, on your bar now" onPress={onName} disabled={adding} />
      <Way icon="drop.fill" title="Make it in house" line="Write down how you make it, in House-made" onPress={onMake} />
      <Way icon="camera.fill" title="Snap it" line="A photo of the bottle or jar, and we’ll find it" onPress={onSnap} />
    </View>
  );
}

/** Under the results: what this opening added, and Done, which closes the sheet the way a drag does. */
export function DoneFooter({ line }: { line: string }) {
  const close = useSheetClose();
  return (
    <View style={styles.footer}>
      <Body tone="muted" numberOfLines={2} style={styles.name}>
        {line}
      </Body>
      <Button label="Done" size="sm" onPress={close} />
    </View>
  );
}

/**
 * The equipment list as tiles by kind, searched by name: what you tick here
 * is your kit. Only what `shown` lets through (not yours yet, or ticked
 * since the sheet opened); a search names what it left out in one line.
 */
export function KitResults({ query, cols, shown, onToggled }: { query: string; cols: number; shown: (id: string) => boolean; onToggled: (id: string, name: string, on: boolean) => void }) {
  const { owned, toggle } = useKit();
  const q = query.toLowerCase();
  const matched = q ? EQUIPMENT.filter((e) => matchesEquipment(e, q)) : EQUIPMENT;
  const list = matched.filter((e) => shown(e.id));
  const mine = matched.filter((e) => !shown(e.id)).map((e) => e.name);
  const left = q ? leftOutLine(mine) : null;
  if (!list.length) return <Body tone="muted">{left ?? (q ? `No kit called “${query}”.` : 'You have all of it.')}</Body>;
  return [
    left ? <Caption key="left" tone="muted">{left}</Caption> : null,
    ...EQUIPMENT_KINDS.flatMap((kind) => {
    const pieces = list.filter((e) => e.kind === kind.id);
    if (!pieces.length) return [];
    return [
      <View key={kind.id} style={styles.group}>
        <View style={styles.heading}>
          <Eyebrow>{kind.name}</Eyebrow>
        </View>
        <TileGrid cols={cols}>
          {pieces.map((e) => {
            const has = owned.includes(e.id);
            return (
              <BarTile
                key={e.id}
                name={e.name}
                meta={has ? 'You have it' : null}
                metaTone="accent"
                picture={<EquipmentDrawing id={e.id} lazy />}
                role="checkbox"
                checked={has}
                accessibilityLabel={e.name}
                accessibilityHint={e.what}
                badge={has ? 'check' : 'plus'}
                onPress={() => {
                  toggle(e.id);
                  onToggled(e.id, e.name, !has);
                }}
              />
            );
          })}
        </TileGrid>
      </View>,
    ];
  }),
  ];
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  heading: { paddingTop: space.md },
  recipe: { alignSelf: 'flex-start', minHeight: layout.minTapTarget, justifyContent: 'center' },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.xs },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
  name: { flex: 1, gap: 2 },
  way: { borderBottomWidth: StyleSheet.hairlineWidth },
  wayIcon: { width: 48, height: 48, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  snapIcon: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
