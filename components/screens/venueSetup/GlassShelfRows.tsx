import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { glassModelSize, type GlassModel } from '@/hooks/useGlassModels';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import { groupGlasses } from '@/lib/whatNext';

/** "Coupe · acrylic": the type, and the material when it isn't glass. */
const typeLine = (m: GlassModel) => [GLASS_TYPE_LABEL[m.glass], m.material && !/^glass$/i.test(m.material) ? m.material.toLowerCase() : null].filter(Boolean).join(' · ');

/** One glass: its drawing, name, type or range, size, and a round + that turns into a check once it's on the shelf. */
function ShelfRow({ model, sub, on, onToggle }: { model: GlassModel; sub: string; on: boolean; onToggle: () => void }) {
  const ds = useDs();
  const size = glassModelSize(model);
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <GlassThumb glass={model.glass} variant={model.variant} size={44} />
      <View style={styles.flex}>
        <Body numberOfLines={1}>{model.name}</Body>
        {sub ? (
          <Caption tone="muted" numberOfLines={1}>
            {sub}
          </Caption>
        ) : null}
      </View>
      {size ? <Caption tone="muted">{size}</Caption> : null}
      <PressableScale
        role="button"
        aria-pressed={on}
        accessibilityLabel={on ? `${model.name} is on your shelf. Remove` : `Add ${model.name}`}
        onPress={onToggle}
        style={[styles.toggle, on ? { backgroundColor: ds.accentFill.fill } : { borderColor: ds.c.lineStrong, borderWidth: 1 }]}
      >
        <IconSymbol name={on ? 'checkmark' : 'plus'} size={18} color={on ? ds.accentFill.text : ds.c.ink} />
      </PressableScale>
    </View>
  );
}

/**
 * Glasses in runs of the same maker: a search shows maker and range with a
 * count ("Cocktail Kingdom · Leopold · 4"), a shape's list shows the maker
 * in caps over each run and the range on each row.
 */
export function GlassShelfRows({ models, by, onShelf, onToggle }: { models: readonly GlassModel[]; by: 'range' | 'maker'; onShelf: (m: GlassModel) => boolean; onToggle: (m: GlassModel) => void }) {
  return (
    <View style={styles.groups}>
      {groupGlasses(models, by).map((g, i) => (
        <View key={`${g.title}-${i}`} style={styles.group}>
          <Caption tone="muted" role="heading" style={styles.head}>
            {(by === 'range' ? `${g.title} · ${g.models.length}` : g.title).toUpperCase()}
          </Caption>
          <View role="list">
            {g.models.map((m) => (
              <ShelfRow key={m.id} model={m} sub={by === 'range' ? typeLine(m) : (m.series ?? typeLine(m))} on={onShelf(m)} onToggle={() => onToggle(m)} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.lg },
  group: { gap: space.xs },
  head: { letterSpacing: 0.6, fontFamily: fontFamilies.bodyMedium },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  toggle: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
