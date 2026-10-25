import { useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Caption, IngredientDrawing, PressableScale, Tag, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { ItemPrep } from '@/hooks/usePrepCard';
import { formatQuantity, toQuantity } from '@/lib/quantity';
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
            const group = groupForAction(a);
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

/** Makes, keeps, store, takes: what you check before you start a batch. */
export function prepFacts(prep: ItemPrep | null | undefined): Fact[] {
  if (!prep) return [];
  const y = toQuantity(prep.yield_amount, prep.yield_unit);
  return [
    y && { label: 'Makes', value: formatQuantity(y) },
    shelfLifeLabel(prep.shelf_life_hours) && { label: 'Keeps', value: shelfLifeLabel(prep.shelf_life_hours)! },
    // The tile says where ("Fridge"); the label and Where it lives carry the rest ("sealed bottle").
    prep.storage && { label: 'Store', value: prep.storage.split(/[,;(]/)[0].trim() || prep.storage },
    leadTimeLabel(prep.lead_time_minutes, prep.lead_time_note) && { label: 'Takes', value: leadTimeLabel(prep.lead_time_minutes, prep.lead_time_note)! },
  ].filter((f): f is Fact => !!f);
}

/** Pinned under a phone page: Make the size picked ("Make 1.1 L"), and a jump to the drinks it goes in. */
export function MakeBar({ bottom, onMake, makes, drinks, onDrinks }: { bottom: number; onMake: () => void; makes: string | null; drinks: number; onDrinks: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.bar, { paddingBottom: bottom + space.md, backgroundColor: ds.c.ground, borderTopColor: ds.c.line }]}>
      <Button label={makes ? `Make ${makes}` : 'Make'} icon="play.fill" size="lg" onPress={onMake} style={styles.make} />
      {drinks ? <Button label={`In ${drinks} ${drinks === 1 ? 'drink' : 'drinks'}`} variant="secondary" size="lg" onPress={onDrinks} /> : null}
    </View>
  );
}

/** The More (three dots) sheet: edit, print, proof, make your own. */
export function MoreSheet({ name, actions, onClose }: { name: string; actions: { label: string; onPress: () => void }[]; onClose: () => void }) {
  return (
    <MenuSheet visible onClose={onClose} title={name}>
      <View>
        {actions.map((a, i) => (
          <View key={a.label}>
            {i > 0 ? <RowDivider /> : null}
            <SettingsRow
              label={a.label}
              role="button"
              onPress={() => {
                onClose();
                // iOS won't present a modal while another is still going away.
                setTimeout(a.onPress, Platform.OS === 'ios' ? 450 : 0);
              }}
            />
          </View>
        ))}
      </View>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  techTag: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 24, paddingHorizontal: space.sm + 2, borderRadius: radius.pill },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  make: { flex: 1 },
});
