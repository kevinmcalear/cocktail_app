import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, IngredientDrawing, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { ItemPrep } from '@/hooks/usePrepCard';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { leadTimeLabel, shelfLifeLabel } from '@/lib/scale';
import { groupForAction } from '@/lib/techniques';

import { DrinkHero } from '../drink/DrinkHero';
import type { Fact } from '../drink/DrinkFacts';
import type { ShownPicture } from '../drink/PictureViewer';

/**
 * The top of an ingredient page: its drawing on sketch paper, or its pictures
 * (its own photo, or for a drawn batch, the photos of the drink it makes).
 * With None there's no hero (IngredientScreen).
 */
export function IngredientHero({ id, name, pictures, height, fade }: { id: string; name: string; pictures: ShownPicture[]; height: number; fade: boolean }) {
  const ds = useDs();
  if (pictures.length) return <DrinkHero name={name} pictures={pictures} glass={null} itemId={null} height={height} fade={fade} />;
  // The drawing is square; on a phone it sits low, clear of the controls, with the page pulled up over its foot.
  const size = Math.min(height - (fade ? space.xxl : 0) - space.xxxl, 360);
  return (
    <View style={[styles.hero, { height, backgroundColor: ds.c.paper, paddingBottom: fade ? space.xxl : 0, justifyContent: fade ? 'flex-end' : 'center' }]} accessibilityLabel={`Drawing of ${name}`}>
      <View style={{ width: size, height: size }}>
        <IngredientDrawing id={id} name={name} drawn />
      </View>
    </View>
  );
}

/**
 * House prep, how it's made, and whose recipe it is; or for a bottle, its role.
 * A technique tag ("Syrup") opens the library group that teaches it.
 */
export function IngredientTags({ isPrep, actions, venueName, shared, mine, role, technical }: { isPrep: boolean; actions: string[]; venueName: string | null; shared: boolean; mine: boolean; role: string | null; technical: boolean }) {
  const ds = useDs();
  const router = useRouter();
  // The tags open the technique library, with Techniques switched on.
  const techniques = useVenueFeature('techniques');
  const lead: { label: string; accent?: boolean }[] = isPrep
    ? [{ label: 'House-made', accent: true }]
    : [technical ? 'Technical ingredient' : role === 'product' ? 'Bottle' : role === 'generic' ? 'Style' : null].filter((t): t is string => !!t).map((label) => ({ label }));
  const whose = isPrep ? (venueName ?? (mine ? 'Your recipe' : shared ? 'Shared recipe' : null)) : venueName;
  if (!lead.length && !actions.length && !whose) return null;
  return (
    <View style={styles.tags}>
      {lead.map((t) => (
        <Tag key={t.label} label={t.label} tone={t.accent ? 'accent' : 'default'} />
      ))}
      {isPrep
        ? actions.map((a) => {
            const group = techniques ? groupForAction(a) : null;
            if (!group) return <Tag key={a} label={a} />;
            return (
              <PressableScale key={a} role="link" accessibilityLabel={`${a}: open the technique library`} onPress={() => router.push(`/techniques?group=${group}` as never)} style={[styles.techTag, { backgroundColor: ds.c.raised }]}>
                <Caption>{a}</Caption>
                <IconSymbol name="chevron.right" size={12} color={ds.c.muted} />
              </PressableScale>
            );
          })
        : null}
      {whose ? <Tag label={whose} /> : null}
    </View>
  );
}

/** Keeps, store, takes: what you check before you start a batch. What it makes is the recipe's Makes pill (Item-page). */
export function prepFacts(prep: ItemPrep | null | undefined): Fact[] {
  if (!prep) return [];
  return [
    shelfLifeLabel(prep.shelf_life_hours) && { label: 'Keeps', value: shelfLifeLabel(prep.shelf_life_hours)! },
    // A short note reads whole ("Fridge, sealed", Desk-item-ginger); a long one says where, and the label and Where it lives carry the rest.
    prep.storage && { label: 'Store', value: prep.storage.length <= 24 ? prep.storage : prep.storage.split(/[,;(]/)[0].trim() || prep.storage },
    leadTimeLabel(prep.lead_time_minutes, prep.lead_time_note) && { label: 'Takes', value: leadTimeLabel(prep.lead_time_minutes, prep.lead_time_note)! },
  ].filter((f): f is Fact => !!f);
}

const styles = StyleSheet.create({
  hero: { width: '100%', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  techTag: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 24, paddingHorizontal: space.sm + 2, borderRadius: radius.pill },
});
