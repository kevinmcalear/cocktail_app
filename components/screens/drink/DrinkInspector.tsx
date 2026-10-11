import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, PressableScale, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useBarZones, useItemLocations } from '@/hooks/useBackBar';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useViewAs } from '@/hooks/useViewAs';
import { locationLine } from '@/lib/backBar';
import type { ItemImageLink } from '@/lib/itemImages';
import { viewAsChoices } from '@/lib/roleLens';
import { photoShots, photosTaken } from '@/lib/servicePhotos';
import type { SpecLine } from '@/lib/spec';

import { Choice } from '../menus/MenuSheet';

interface DrinkInspectorProps {
  itemId: string;
  barId: string | null;
  name: string;
  links: ItemImageLink[] | undefined;
  lines: SpecLine[];
  glass: { id: string; name: string } | null;
  /** Your real role at the venue, or null off its team. */
  teamRole: number | null;
}

/**
 * The desktop inspector (board drink-desktop): the photo slots with how many
 * are real (opening the shot list), where each bottle, prep and the glass
 * lives at the bar, and View as with what each role adds.
 */
export function DrinkInspector({ itemId, barId, name, links, lines, glass, teamRole }: DrinkInspectorProps) {
  const ds = useDs();
  const router = useRouter();
  const shots = photoShots(links);
  const caps = useCapabilities(barId).data ?? [];
  const where = barId && caps.includes('locations') ? barId : null;
  const { data: zones = [] } = useBarZones(where);
  const { data: locations = [] } = useItemLocations(where);
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? null;
  const things = [...lines.flatMap((l) => (l.ingredientId && l.ingredient ? [{ id: l.ingredientId, name: l.ingredient }] : [])), ...(glass ? [{ id: glass.id, name: `${glass.name} glass` }] : [])];
  const placed = things.flatMap((t) => {
    const at = locations.find((l) => l.item_id === t.id);
    return at ? [{ ...t, place: locationLine(zoneName(at.zone_id), at.shelf) }] : [];
  });
  const openShots = () => router.push({ pathname: '/cocktail/[id]/photos', params: { id: itemId } } as unknown as Href);

  return (
    <View style={[styles.inspector, { borderLeftColor: ds.c.line }]} role="complementary" accessibilityLabel="Inspector">
      <View style={styles.head}>
        <Caption tone="muted" style={styles.eyebrow}>
          PHOTOS
        </Caption>
        <TextLink label={`${photosTaken(shots)} of ${shots.length}`} accessibilityHint="Opens the shot list" onPress={openShots} />
      </View>
      <View style={styles.thumbs}>
        {shots.slice(1).map((s) => (
          <PressableScale key={s.angle} role="link" accessibilityLabel={`${s.label}, ${s.status === 'photo' ? 'photo' : 'no photo yet'}. Open the shot list`} onPress={openShots} style={styles.thumb}>
            <DrinkImage source={s.picture?.url ?? null} generated={s.picture?.isSketch} itemId={s.picture ? undefined : itemId} accessibilityLabel={`${name}, ${s.label}`} aspectRatio={1} radius="control" />
            <Caption tone="muted">{s.label}</Caption>
          </PressableScale>
        ))}
      </View>
      {where ? (
        <View style={styles.group}>
          <Caption tone="muted" style={styles.eyebrow}>
            WHERE IT LIVES
          </Caption>
          {placed.length ? (
            placed.map((t) => (
              <View key={t.id} style={[styles.place, { borderBottomColor: ds.c.line }]} accessible accessibilityLabel={`${t.name}: ${t.place}`}>
                <Caption style={styles.flex} numberOfLines={1}>
                  {t.name}
                </Caption>
                <Caption tone="muted">{t.place}</Caption>
              </View>
            ))
          ) : (
            <Caption tone="muted">Nothing in this drink has a spot on the back bar yet.</Caption>
          )}
        </View>
      ) : null}
      {teamRole && teamRole > 10 ? <ViewAs realRole={teamRole} itemId={itemId} /> : null}
    </View>
  );
}

function ViewAs({ realRole, itemId }: { realRole: number; itemId: string }) {
  const router = useRouter();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs();
  const current = Math.min(viewAsRoleLevel ?? realRole, realRole);
  const choices = viewAsChoices(realRole);
  return (
    <View style={styles.group} role="radiogroup" accessibilityLabel="View as">
      <Caption tone="muted" style={styles.eyebrow}>
        VIEW AS
      </Caption>
      <View style={styles.roles}>
        {choices.map((c) => (
          <Choice key={c.level} label={c.label} selected={c.level === current} disabled={isSaving} onPress={() => void setViewAsRoleLevel(c.level === realRole ? null : c.level)} />
        ))}
      </View>
      <Caption tone="muted">{choices.find((c) => c.level === current)?.adds}</Caption>
      <TextLink label="What each role opens ›" onPress={() => router.push({ pathname: '/cocktail/[id]/roles', params: { id: itemId } } as unknown as Href)} />
    </View>
  );
}

const styles = StyleSheet.create({
  inspector: { width: 280, gap: space.lg, paddingLeft: space.xl, borderLeftWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { letterSpacing: 1.2 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thumb: { width: '47%', gap: space.xs, borderRadius: radius.control },
  group: { gap: space.sm },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
