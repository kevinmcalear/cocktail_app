import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { hasContent } from '@/lib/drinkWizard';
import { recipesToFinish } from '@/lib/prepKinds';
import { sectionSlots, useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

/**
 * Drinks started for this section and not saved yet, each a Draft (Kevin, 24 Oct: "if I
 * started to make a drink, it should be on the menu"): each one's name and
 * Keep going, which opens its kept draft where it was left. Saving it puts it
 * in the section like any drink made from the menu.
 * Kept on the device and, signed in, in the account (hooks/useDraftSync), so
 * another device shows it too.
 */
export function UnfinishedDrinks({ barId, sectionKey }: { barId: string | null; sectionKey: string }) {
  const ds = useDs();
  const router = useRouter();
  const kept = useDrinkWizardStore((s) => s.kept);
  const drafts = sectionSlots(kept, wizardPlace(barId), sectionKey).filter((d) => hasContent(d.kept.draft));
  if (!drafts.length) return null;
  return (
    <View>
      {drafts.map(({ slot, name, kept: { draft } }) => {
        const title = draft.name.trim() || 'Untitled drink';
        // What's left inside it (make-anything-steps-3, step 9): "Draft · Miso banana liqueur recipe to finish".
        const left = recipesToFinish(draft.lines);
        const sub = left.length ? `Draft · ${left[0].name} recipe to finish${left.length > 1 ? `, and ${left.length - 1} more` : ''}` : 'Draft';
        const open = () => router.push({ pathname: '/add-cocktail', params: { menuSectionId: sectionKey, ...(barId ? { barId } : {}), ...(name ? { name } : {}) } });
        return (
          <PressableScale key={slot} role="button" accessibilityLabel={`${title}, ${sub.toLowerCase()}. Keep going`} onPress={open} haptic={false} style={styles.row}>
            <View aria-hidden style={[styles.tile, { borderColor: ds.c.lineStrong }]}>
              <IconSymbol name="pencil" size={18} color={ds.c.muted} />
            </View>
            <View style={styles.flex}>
              <DsText variant="body" numberOfLines={1}>
                {title}
              </DsText>
              <Caption tone="muted" numberOfLines={2}>
                {sub}
              </Caption>
            </View>
            <Caption color={ds.accentText}>Keep going</Caption>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: layout.minTapTarget },
  tile: { width: 52, aspectRatio: 8 / 9, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
