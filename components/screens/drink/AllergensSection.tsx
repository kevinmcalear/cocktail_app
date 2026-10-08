import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, LockedSection, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useDrinkAllergens } from '@/hooks/useAllergens';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { allergenLabel, containsLine, viaLine } from '@/lib/allergens';
import { roleLabel } from '@/lib/roles';

interface AllergensSectionProps {
  itemId: string;
  barId: string | null;
  /** /dev/drink only: no server to ask. */
  preview?: boolean;
}

/**
 * Allergens rolled up from the recipe, so a server can answer a guest. Opens
 * at Floor (the talking_points capability) on venue drinks, so it's readable
 * even when the spec is locked. Hidden when nothing in the spec declares an
 * allergen; once one does, unchecked ingredients are said out loud too.
 */
export function AllergensSection({ itemId, barId, preview }: AllergensSectionProps) {
  const { data: capabilities } = useCapabilities(preview ? null : barId);
  const { data: opensAtLevel } = useCapabilityOpensAt(preview ? null : barId, 'talking_points');
  const unlocked = !barId || !!capabilities?.includes('talking_points');
  const { data, isPending } = useDrinkAllergens(preview || !unlocked ? null : itemId);
  if (preview) return null;
  if (unlocked && !isPending && !data?.allergens.length) return null;
  const opensAt = opensAtLevel ? roleLabel(opensAtLevel) : 'Employee';
  return (
    <LockedSection title="Allergens" unlocked={unlocked} opensAt={opensAt}>
      {data ? <Allergens data={data} /> : <Body tone="muted">Checking the recipe.</Body>}
    </LockedSection>
  );
}

function Allergens({ data }: { data: NonNullable<ReturnType<typeof useDrinkAllergens>['data']> }) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const paths = data.allergens.flatMap((a) => a.via.map((p) => ({ key: `${a.allergen}-${p.join('/')}`, allergen: a.allergen, line: viaLine(p) })));
  const hasDetail = paths.some((p) => p.line);
  return (
    <View style={styles.block}>
      {data.allergens.length ? (
        <View style={styles.tags}>
          {data.allergens.map((a) => (
            <Tag key={a.allergen} label={`Contains ${allergenLabel(a.allergen).toLowerCase()}`} tone="warning" />
          ))}
        </View>
      ) : null}
      <Body>{containsLine(data)}</Body>
      {hasDetail ? (
        <PressableScale
          accessibilityLabel={open ? 'Hide where each allergen comes from' : 'Show where each allergen comes from'}
          aria-expanded={open}
          onPress={() => setOpen((o) => !o)}
          style={styles.more}
        >
          <Caption tone="muted">{open ? 'Hide details' : 'Where from'}</Caption>
          <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={14} color={ds.c.muted} />
        </PressableScale>
      ) : null}
      {open
        ? paths.map((p) =>
            p.line ? (
              <Caption key={p.key} tone="muted">
                {allergenLabel(p.allergen)} {p.line}
              </Caption>
            ) : null
          )
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  more: { minHeight: layout.minTapTarget, flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start' },
});
