import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TellUs, type TellUsAbout } from '@/components/feedback/TellUs';
import { IcePrompt } from '@/components/screens/kit/IcePrompt';
import { space } from '@/constants/tokens';
import type { BarGlass } from '@/hooks/useBarGlassware';
import type { VenueIce } from '@/hooks/useVenueIce';
import { samePick, sketchLook, type StepProps, type WizardPick } from '@/lib/drinkWizard';
import { iceBuildLine, iceKind, iceTip, quickBuild, type IceLayer } from '@/lib/iceBuild';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { iceDrawKind, inTheGlass, isVenueIce, kitIceRow, kitSourceLine, venueIceKinds } from '@/lib/venueKit';

import { AddLayerSheet } from './AddLayerSheet';
import { IceLayers } from './IceLayers';
import { IceTipCard } from './IceTipCard';
import { PickStep } from './PickStep';
import { Eyebrow } from './WizardChrome';

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
 * The ice in the glass (canvas "Ice builds", approved 20 Oct 2026; Q21 + E24,
 * 26 Oct): an ice picked straight away, the venue's first, then Add extra ice
 * to build it up (cubes under pebble, a spear on a cube) or pick a whole
 * build, and one suggestion at a time. What it's shaken with is on the Method
 * step (MethodIceLine).
 */
export function IceStep({ draft, set, ices, barIce, suggested, why, compact, kit = [], barGlasses, barVariants = [], venueName, barId, tellUs }: IceStepProps) {
  const [adding, setAdding] = useState(false);
  const mine = barIce.length ? { has: (p: WizardPick) => isVenueIce(barIce, p.name), label: venueName ? `${venueName}’s ice` : 'Your ice', restLabel: 'Other ice' } : undefined;

  const layers: IceLayer<WizardPick>[] = draft.iceBuild?.length ? draft.iceBuild : draft.ice && iceKind(draft.ice.name) !== 'none' ? [{ ice: draft.ice }] : [];
  // The top layer is the drink's one ice (items.ice_id), for everything that reads only one.
  const setLayers = (next: IceLayer<WizardPick>[]) => set({ iceBuild: next.length ? next : null, ice: next.length ? next[next.length - 1].ice : null });
  const pickOf = (name: string) => ices.find((o) => samePick(o, { id: null, name })) ?? { id: null, name };
  const named = layers.map((l) => ({ ...l, ice: l.ice.name }));
  // The chips pick the bottom ice (cubes start at 3, like Add extra ice); extra ice stays on top. No ice is served up, with no build.
  const base = layers[0] && !layers[0].tin ? layers[0].ice : null;
  const pickBase = (ice: WizardPick | undefined) => {
    if (ice && iceKind(ice.name) === 'none') return set({ ice, iceBuild: null });
    setLayers(ice ? [{ ice, ...(iceKind(ice.name) === 'cubes' ? { n: 3 } : {}) }, ...layers.slice(1)] : []);
  };

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
        <View style={styles.group}>
          <Eyebrow>In the glass</Eyebrow>
          <PickStep label="In the glass" ownLabel="Other ice" compact={compact} options={ices} selected={base ? [base] : !layers.length && draft.ice ? [draft.ice] : []} onChange={([ice]) => pickBase(ice)} suggested={suggested} why={why} mine={mine}>
            {layers.length ? <IceLayers layers={layers} onChange={setLayers} onAdd={() => setAdding(true)} sourceOf={sourceOf} /> : null}
          </PickStep>
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
          onBuild={(q) => setLayers(quickBuild(q, pickOf, draft.methodIce ?? null))}
          canDump={!!draft.methodIce}
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
});
