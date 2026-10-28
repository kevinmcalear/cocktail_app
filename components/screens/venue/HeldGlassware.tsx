import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { KitList } from '@/components/screens/kit/KitList';
import { ClaimNote } from '@/components/screens/venueSetup/SetupChecklistParts';
import { space } from '@/constants/tokens';
import { useHeldGlasses } from '@/hooks/useBarGlassware';
import { useGlassModelsById } from '@/hooks/useGlassModels';
import { anyLine, kindOf } from '@/lib/glassKinds';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import { useVenueSetup } from '@/store/useVenueSetup';

/**
 * Kit › Glassware before the venue's page is checked: the glasses held on
 * this device (setup's Glassware step, or added here), which go onto the page
 * once it is (useFlushHeldGlasses). Tapping one takes it off the list.
 */
export function HeldGlassware({ barId, name, onAdd }: { barId: string; name: string; onAdd?: () => void }) {
  const held = useHeldGlasses(barId);
  const dropGlass = useVenueSetup((s) => s.dropGlass);
  // A real glass added here keeps only its id; one from setup keeps its maker and name too.
  const models = useGlassModelsById(held.flatMap((h) => (h.model_id ? [h.model_id] : []))).data ?? [];
  const entries = held.map((h) => {
    const model = models.find((m) => m.id === h.model_id);
    const real = h.model_id ? [model?.maker?.display_name ?? h.maker, model?.name ?? h.name].filter(Boolean).join(' ') : '';
    return {
      id: h.key,
      name: (h.model_id ? null : h.name) ?? kindOf(h)?.label ?? GLASS_TYPE_LABEL[h.glass],
      line: real || anyLine(h),
      thumb: <GlassThumb glass={h.glass} variant={h.variant} outline={h.outline} />,
      action: 'Remove',
    };
  });
  return (
    <View style={styles.stack}>
      <KitList sections={[{ entries }]} onOpen={(key) => dropGlass(barId, key)} addLabel="Add a glass" onAdd={onAdd} empty="No glasses listed yet." />
      <Caption tone="muted">{`Kept on this device. They go on ${name}’s page once we’ve checked it’s yours.`}</Caption>
      <ClaimNote barId={barId} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
});
