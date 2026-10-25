import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarKit } from '@/hooks/useBarKit';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useIcesStartingFrom } from '@/hooks/useIceRecipe';
import { useVenueIce } from '@/hooks/useVenueIce';
import { ICE_EXTRA_STEPS } from '@/lib/iceRecipes';
import { ICE_YIELD_UNITS } from '@/lib/prepCardForm';
import { kitHasTool, toolLabel } from '@/lib/venueKit';

import { MethodEdit } from '../ingredient/edit/MethodEdit';
import { KeepsSheet, keepsValues } from '../ingredient/edit/PrepSections';
import { RowDivider, SettingsRow } from '../settings/SettingsParts';
import { VenueSubPage } from '../venue/VenueSubPage';
import { IceRecipeSection, StartsFromCard } from './IceRecipeSection';
import { IceMadeStep, madeReady, type IceMade } from './IceMadeStep';
import { StartsFromSheet } from './StartsFromSheet';
import { StepToolsSheet } from './StepToolsSheet';
import { useIceRecipeEdit } from './useIceRecipeEdit';

/**
 * Kit › Ice › an ice › How it's made (Kit and ice, step 7): the house-prep
 * editor for an ice made here. Starts from another of the venue's ice (or a
 * flavour, or water), steps that each name their tools, checked against the
 * kit, and Makes and Keeps. With no steps yet it asks how it's made and writes
 * a starting recipe in our words. Anyone with Prep at the venue changes it.
 */
export function IceRecipeScreen({ barId, iceId }: { barId: string; iceId: string }) {
  const ds = useDs();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const canEdit = (useCapabilities(barId).data ?? []).includes('prep');
  const { data: ices = [], isLoading } = useVenueIce(barId);
  const ice = ices.find((r) => r.id === iceId) ?? null;
  const kit = useBarKit(barId).data ?? [];
  const edit = useIceRecipeEdit(barId, canEdit ? ice : null);
  const [made, setMade] = useState<IceMade>({ way: null, from: null });
  const [own, setOwn] = useState(false);
  const [sheet, setSheet] = useState<'from' | 'makes' | 'keeps' | { tools: string } | null>(null);
  const title = ice?.name ?? 'Ice';
  // Never offer an ice that starts from this one: the chain would loop.
  const after = useIcesStartingFrom(canEdit ? iceId : null).data ?? [];
  const others = ices.filter((r) => r.id !== iceId && !after.includes(r.id));

  if (!ice || !canEdit) {
    return (
      <VenueSubPage barId={barId} title={title}>
        {isLoading ? <Caption tone="muted">Loading…</Caption> : !ice ? <Body tone="muted">This ice isn’t on the venue’s list any more.</Body> : <IceRecipeSection barId={barId} ice={ice} canEdit={false} />}
      </VenueSubPage>
    );
  }
  const f = edit.fields;
  if (!f) {
    return (
      <VenueSubPage barId={barId} title={title}>
        <Caption tone="muted">{edit.loadError ? 'Couldn’t load how it’s made. Check your connection and try again.' : 'Loading…'}</Caption>
      </VenueSubPage>
    );
  }

  // --- No recipe yet: how do you make it? (step 6, question 3) ---
  if (!f.steps.length && !edit.startsFrom && !own && !edit.dirty) {
    return (
      <VenueSubPage barId={barId} title={title} intro="How do you make it? Start from one of these and change anything. It’s a recipe, like your house preps.">
        <IceMadeStep value={made} onChange={setMade} others={others} />
        <Button label="Make it" disabled={!madeReady(made, others)} onPress={() => made.way && (made.way === 'own' ? setOwn(true) : edit.start(made.way, made.from && { ...made.from, name: made.from.name.trim() }))} />
      </VenueSubPage>
    );
  }

  const missing = (t: string) => kit.length > 0 && !kitHasTool(kit, t);
  const values = keepsValues(f);
  const toolsStep = sheet && typeof sheet === 'object' ? f.steps.findIndex((s) => s.key === sheet.tools) : -1;
  return (
    <VenueSubPage barId={barId} title={title}>
      {edit.template ? (
        <View style={[styles.note, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="info.circle" size={16} color={ds.c.muted} />
          <Caption tone="muted" style={styles.flex}>Starting point, in our words (bar practice): change it to how you do it.</Caption>
        </View>
      ) : null}
      <StartsFromCard barId={barId} from={edit.startsFrom} onChange={() => setSheet('from')} />
      <MethodEdit
        heading="How it’s made"
        placeholder="Cut each slab into 50 mm cubes"
        summary={f.steps.length ? `${f.steps.length} ${f.steps.length === 1 ? 'step' : 'steps'}` : null}
        steps={f.steps}
        onChange={(steps) => edit.set({ steps })}
        tools={{ label: toolLabel, missing, onEdit: (key) => setSheet({ tools: key }) }}
      />
      {/* "Add a step" above is our own step; these add one of the usual ones. */}
      <View role="group" accessibilityLabel="Add one of the usual steps" style={styles.chips}>
        {ICE_EXTRA_STEPS.map((x) => (
          <Button key={x.key} label={x.label} icon="plus" variant="secondary" size="sm" accessibilityLabel={`Add a step: ${x.label}`} onPress={() => edit.set({ steps: [...f.steps, edit.toStep(x.step)] })} />
        ))}
      </View>
      <Surface>
        <SettingsRow label="Makes" value={values.makes ?? 'Add'} onPress={() => setSheet('makes')} />
        <RowDivider />
        <SettingsRow label="Keeps" value={[values.keeps, values.store].filter(Boolean).join(' · ') || 'Add'} onPress={() => setSheet('keeps')} />
      </Surface>
      <View style={styles.group}>
        <Headline role="heading">Who can change it</Headline>
        <Caption tone="muted">{`Anyone with Prep at ${venue?.name ?? 'the venue'}.`}</Caption>
      </View>
      {edit.problem ? <Caption tone="accent">{edit.problem}</Caption> : null}
      <Button label={edit.saving ? 'Saving…' : 'Save'} disabled={!edit.dirty || edit.saving} onPress={() => void edit.submit()} />

      {sheet === 'from' ? <StartsFromSheet ices={others} value={edit.startsFrom} onClose={() => setSheet(null)} onPick={(v) => (edit.setStartsFrom(v), setSheet(null))} /> : null}
      {sheet === 'makes' || sheet === 'keeps' ? <KeepsSheet field={sheet} fields={f} set={edit.set} units={ICE_YIELD_UNITS} onClose={() => setSheet(null)} /> : null}
      {toolsStep >= 0 ? (
        <StepToolsSheet
          step={toolsStep + 1}
          value={f.steps[toolsStep].tools}
          kit={kit}
          onClose={() => setSheet(null)}
          onDone={(tools) => (edit.set({ steps: f.steps.map((s, i) => (i === toolsStep ? { ...s, tools } : s)) }), setSheet(null))}
        />
      ) : null}
    </VenueSubPage>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control },
  flex: { flex: 1, minWidth: 0 },
});
