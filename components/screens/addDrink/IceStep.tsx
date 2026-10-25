import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { TellUs, type TellUsAbout } from '@/components/feedback/TellUs';
import { IcePrompt } from '@/components/screens/kit/IcePrompt';
import { space } from '@/constants/tokens';
import type { BarGlass } from '@/hooks/useBarGlassware';
import type { VenueIce } from '@/hooks/useVenueIce';
import { methodIceLabel, samePick, sketchLook, type StepProps, type WizardPick } from '@/lib/drinkWizard';
import { iceBuildLine, iceKind, iceTip, QUICK_BUILDS, QUICK_LABEL, quickBuild, saysMore, whichQuick, type IceLayer } from '@/lib/iceBuild';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { iceDrawKind, inTheGlass, isVenueIce, kitIceRow, kitSourceLine, venueIceKinds } from '@/lib/venueKit';

import { AddLayerSheet } from './AddLayerSheet';
import { IceLayers } from './IceLayers';
import { IceTipCard } from './IceTipCard';
import { PickStep } from './PickStep';
import { Eyebrow, WizardChip } from './WizardChrome';

interface IceStepProps extends StepProps {
  ices: WizardPick[];
  /** The venue's ice, listed first under "Your ice". */
  barIce: string[];
  suggested?: string | null;
  why?: string | null;
  /** The desktop page's one-row pickers. */
  compact?: boolean;
  /** The venue's Kit (its ice, where each comes from, a spear's length) and glasses (their heights), for the layers and suggestions. */
  kit?: readonly VenueIce[];
  barGlasses?: readonly BarGlass[];
  barVariants?: readonly string[];
  venueName?: string | null;
  /** The venue the drink is at: an ice it doesn't pour asks to be added (IcePrompt). */
  barId?: string | null;
  /** Under the list, beside it (the parent's spacing): "Doing something different? Tell us". */
  tellUs?: TellUsAbout;
}


/**
 * The ice it's made with, named for the method ("Blended with"; #697), then
 * In the glass (canvas "Ice builds", approved 20 Oct 2026): one kind, or a
 * build from the bottom up (cubes under pebble, a spear on a cube) with quick
 * builds, the venue's ice first, and one suggestion at a time.
 */
export function IceStep({ draft, set, ices, barIce, suggested, why, compact, kit = [], barGlasses, barVariants = [], venueName, barId, tellUs }: IceStepProps) {
  const [adding, setAdding] = useState(false);
  const made = methodIceLabel(draft.methods.map((m) => m.name));
  const mine = barIce.length ? { has: (p: WizardPick) => isVenueIce(barIce, p.name), label: 'Your ice', restLabel: 'Other ice' } : undefined;

  const layers: IceLayer<WizardPick>[] = draft.iceBuild?.length ? draft.iceBuild : draft.ice && iceKind(draft.ice.name) !== 'none' ? [{ ice: draft.ice }] : [];
  // The top layer is the drink's one ice (items.ice_id), for everything that reads only one.
  const setLayers = (next: IceLayer<WizardPick>[]) => set({ iceBuild: next.length ? next : null, ice: next.length ? next[next.length - 1].ice : null });
  const pickOf = (name: string) => ices.find((o) => samePick(o, { id: null, name })) ?? { id: null, name };
  const named = layers.map((l) => ({ ...l, ice: l.ice.name }));
  const quick = layers.length ? whichQuick(named) : null;

  // The venue's ice, where each comes from, and how long its spears are.
  const kitIce = kit.filter(inTheGlass);
  const sourceOf = (name: string) => {
    const r = kitIceRow(kitIce, name);
    return r ? kitSourceLine(r) || null : null;
  };
  const spearMm = kitIce.find((r) => iceDrawKind(r) === 'spear')?.length_mm ?? null;

  // The glass as drawn, and its height when the venue's glass of that kind says.
  const look = sketchLook(draft, barVariants);
  const lookKey = JSON.stringify(look);
  const glassKind = useMemo(() => draftSketchInputs(JSON.parse(lookKey)).glass, [lookKey]);
  const glass = barGlasses?.find((g) => !!g.name && !!draft.glass && isVenueIce([g.name], draft.glass.name)) ?? barGlasses?.find((g) => g.glass === glassKind && g.is_default);
  const tip = layers.length
    ? iceTip({
        layers: named,
        glass: glassKind,
        glassName: glass?.name ? `the ${glass.name}` : null,
        glassHeightMm: glass?.model?.height_mm ?? null,
        spearMm,
        methods: draft.methods.map((m) => m.name),
        madeWith: draft.methodIce?.name ?? null,
        off: draft.iceTipsOff,
      })
    : null;

  const top = named[named.length - 1];
  return (
    <>
      <View style={styles.stack}>
        {made ? (
          <View style={styles.group}>
            <Eyebrow>{made}</Eyebrow>
            <PickStep label={made} ownLabel="Other ice" compact={compact} options={ices} selected={draft.methodIce ? [draft.methodIce] : []} onChange={([ice]) => set({ methodIce: ice ?? null })} />
            <Caption tone="muted">Follows the method: shaken with, stirred over, blended with.</Caption>
          </View>
        ) : null}
        <View style={styles.group}>
          <Eyebrow>In the glass</Eyebrow>
          <View role="radiogroup" accessibilityLabel="Ways to build the ice" style={styles.chips}>
            <WizardChip label="One kind" selected={!saysMore(layers)} onPress={() => setLayers(layers.length ? [{ ice: layers[layers.length - 1].ice }] : [])} />
            {QUICK_BUILDS.map((q) => (
              <WizardChip key={q} label={QUICK_LABEL[q]} selected={quick === q} onPress={() => setLayers(quickBuild(q, pickOf, draft.methodIce ?? null))} />
            ))}
          </View>
          {layers.length ? (
            <IceLayers layers={layers} onChange={setLayers} onAdd={() => setAdding(true)} sourceOf={sourceOf} />
          ) : (
            <PickStep label="In the glass" ownLabel="Other ice" compact={compact} options={ices} selected={draft.ice ? [draft.ice] : []} onChange={([ice]) => set({ ice: ice ?? null, iceBuild: null })} suggested={suggested} why={why} mine={mine} />
          )}
          {/* ponytail: the first layer from the bottom the venue may lack; a build of two missing asks one at a time. */}
          <IcePrompt barId={barId} ice={firstMissing(named, kit)} drink={draft.name} />
          {tip ? (
            <IceTipCard
              tip={tip}
              now={named}
              look={look}
              seed={draft.id ?? 'new-drink'}
              onUse={() => setLayers(tip.layers.map((l) => ({ ...l, ice: pickOf(l.ice) })))}
              onNo={() => set({ iceTipsOff: [...(draft.iceTipsOff ?? []), tip.id] })}
            />
          ) : null}
        </View>
        <AddLayerSheet
          visible={adding}
          onClose={() => setAdding(false)}
          onAdd={(l) => setLayers([...layers, l])}
          options={ices}
          venue={venueName && kitIce.length ? { name: venueName, ice: kitIce.map((r) => ({ pick: pickOf(r.name), source: kitSourceLine(r) || null })) } : null}
          below={top ? iceBuildLine([top]).replace(/^Over /, '') : null}
        />
      </View>
      {tellUs ? <TellUs screen="Adding a drink › Ice" line="We’ll add your ice to the app." {...tellUs} /> : null}
    </>
  );
}

/** The lowest ice in the build the venue pours nothing drawn like, else the top (IcePrompt then stays quiet). */
function firstMissing(layers: readonly { ice: string }[], kit: readonly VenueIce[]): string | undefined {
  const kinds = venueIceKinds(kit);
  return layers.find((l) => !kinds.includes(iceKind(l.ice) as never))?.ice ?? layers[layers.length - 1]?.ice;
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
