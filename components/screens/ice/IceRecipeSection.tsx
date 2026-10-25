import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Surface, Tag, TextLink, useDs } from '@/components/ds';
import { KitItemSection } from '@/components/screens/kit/KitItemPage';
import { IceThumb } from '@/components/ds/IceThumb';
import { radius, space } from '@/constants/tokens';
import { useAddTools, useBarKit } from '@/hooks/useBarKit';
import { useIceStartsFrom } from '@/hooks/useIceRecipe';
import { useItemPrep } from '@/hooks/usePrepCard';
import { useVenueIce, type VenueIce } from '@/hooks/useVenueIce';
import { equipmentById } from '@/lib/techniques/equipment';
import { iceDrawKind, kitHasTool, kitSourceLine, toolLabel } from '@/lib/venueKit';

export const iceRecipeHref = (barId: string, iceId: string) => `/settings/bar/${barId}/kit/ice/${iceId}?recipe=1` as Href;

/**
 * What an ice starts from (Kit and ice, steps 7 and 8): the venue's other ice
 * with where it comes from and Open, or a flavour, or water.
 */
export function StartsFromCard({ barId, from, onChange }: { barId: string; from: { id: string | null; name: string | null } | null; onChange?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const ice = useVenueIce(barId).data?.find((r) => !!from?.id && r.id === from.id) ?? null;
  const name = ice?.name ?? (from?.name || (from ? 'Something of ours' : 'Water'));
  const line = ice ? kitSourceLine(ice) : from ? 'A flavour' : 'Nothing else goes in';
  return (
    <View style={[styles.card, { backgroundColor: ds.c.raised }]}>
      <IceThumb kind={ice ? (iceDrawKind(ice) ?? 'large') : 'cubes'} />
      <View style={styles.flex}>
        <Caption tone="muted">Starts from</Caption>
        <Body numberOfLines={1}>{name}</Body>
        {line ? (
          <Caption tone="muted" numberOfLines={2}>
            {line}
          </Caption>
        ) : null}
      </View>
      {ice ? <TextLink label="Open" onPress={() => router.push(iceRecipeHref(barId, ice.id))} /> : null}
      {onChange ? <TextLink label="Change" onPress={onChange} /> : null}
    </View>
  );
}

/**
 * How an ice is made, to read (step 8): what it starts from, its steps, and
 * what it needs, saying which tools aren't in the venue's kit with a way to
 * add them. Kit › Ice's item page (PR 2) shows it; Edit opens the recipe.
 * Steps and recipe lines are for people with Prep (or house-made), as for
 * house preps: anyone else sees nothing here.
 */
export function IceRecipeSection({ barId, ice, canEdit }: { barId: string; ice: Pick<VenueIce, 'id' | 'name'>; canEdit: boolean }) {
  const router = useRouter();
  const { data: card } = useItemPrep(ice.id);
  const { data: from } = useIceStartsFrom(ice.id);
  const kit = useBarKit(barId).data ?? [];
  const addTools = useAddTools(barId);
  const steps = card?.steps ?? [];
  const tools = [...new Set(steps.flatMap((s) => s.equipment))];
  const missing = kit.length ? tools.filter((t) => !kitHasTool(kit, t)) : [];
  const ours = missing.filter((t) => equipmentById(t));
  const edit = () => router.push(iceRecipeHref(barId, ice.id));
  if (!card) return null;
  if (!steps.length && !from) {
    return canEdit ? (
      <KitItemSection title="How it’s made">
        <Body tone="muted">No recipe yet. Start from one of the usual ways and change it to how you do it.</Body>
        <Button label="Write how it’s made" variant="secondary" onPress={edit} />
      </KitItemSection>
    ) : null;
  }
  return (
    <View style={styles.section}>
      {from ? <StartsFromCard barId={barId} from={from} /> : null}
      <KitItemSection title="How it’s made">
        <View role="list" style={styles.steps}>
          {steps.map((s, i) => (
            <View key={s.position} role="listitem" style={styles.step}>
              <Caption style={styles.n}>{String(i + 1)}</Caption>
              <Body style={styles.flex}>{s.body}</Body>
            </View>
          ))}
        </View>
        {canEdit ? <TextLink label="Change how it’s made" onPress={edit} /> : null}
      </KitItemSection>
      {tools.length ? (
        <KitItemSection title="What it needs">
          <View style={styles.tags}>
            {tools.map((t) => (
              <Tag key={t} label={missing.includes(t) ? `${toolLabel(t)} · not in your kit` : toolLabel(t)} tone={missing.includes(t) ? 'warning' : 'outline'} icon={missing.includes(t) ? 'xmark' : 'checkmark'} />
            ))}
          </View>
        </KitItemSection>
      ) : null}
      {canEdit && ours.length ? (
        <Surface style={styles.missing}>
          <Body>{`Not in your kit: ${ours.map(toolLabel).join(', ')}.`}</Body>
          <Button label="Add to kit" variant="secondary" disabled={addTools.isPending} onPress={() => addTools.mutate(ours)} />
          {addTools.error ? <Caption tone="accent">Couldn’t add that. Check your connection and try again.</Caption> : null}
        </Surface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control,
  },
  flex: { flex: 1, minWidth: 0 },
  steps: { gap: space.sm },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  n: { width: 20, textAlign: 'center', paddingTop: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  missing: { gap: space.sm, padding: space.md },
});
