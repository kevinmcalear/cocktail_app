import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, Sheet, SheetScrollView } from '@/components/ds';
import { LayerChoices } from '@/components/screens/addDrink/AddLayerSheet';
import { IceLayers } from '@/components/screens/addDrink/IceLayers';
import { WizardChip } from '@/components/screens/addDrink/WizardChrome';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarKit } from '@/hooks/useBarKit';
import { samePick, type WizardPick } from '@/lib/drinkWizard';
import { iceBuildLine, QUICK_BUILDS, QUICK_LABEL, quickBuild, saysMore, whichQuick, type IceLayer } from '@/lib/iceBuild';
import { ICE_LABEL, kitSourceLine, type IceKind } from '@/lib/venueKit';

type Option = { id: string; name: string };

interface IceBuildSheetProps {
  options: Option[];
  /** The layers by ice id, bottom first; one plain ice is one layer. */
  layers: IceLayer<string>[];
  onChange: (layers: IceLayer<string>[]) => void;
  /** Makes a new ice by name (the editor's handleAddPill) and gives its id. */
  addIce: (name: string) => Promise<string>;
  barId: string | null;
  madeWithId: string | null;
  onClose: () => void;
}

/**
 * The drink editor's Ice (canvas "Ice builds", row 6): the same layers as the
 * wizard, quick builds, and Add a layer on top with the venue's ice first.
 * Adding shows its choices in this sheet, not a second one over it.
 */
export function IceBuildSheet({ options, layers, onChange, addIce, barId, madeWithId, onClose }: IceBuildSheetProps) {
  const [adding, setAdding] = useState(false);
  const venue = useActiveVenue().venues.find((v) => v.id === barId) ?? null;
  const kitIce = (useBarKit(barId).data ?? []).filter((r) => r.kind === 'ice' && r.key in ICE_LABEL);
  const byId = (id: string): WizardPick => options.find((o) => o.id === id) ?? { id, name: 'Ice' };
  const pickOf = (name: string): WizardPick => options.find((o) => samePick(o, { id: null, name })) ?? { id: null, name };
  const picks = layers.map((l) => ({ ...l, ice: byId(l.ice) }));
  // New ice is made by name before the layers change, so every layer has an id.
  const save = async (next: IceLayer<WizardPick>[]) => {
    const ids: string[] = [];
    for (const l of next) ids.push(l.ice.id ?? (await addIce(l.ice.name)));
    onChange(next.map((l, i) => ({ ...l, ice: ids[i] })));
  };
  const named = picks.map((l) => ({ ...l, ice: l.ice.name }));
  const quick = layers.length ? whichQuick(named) : null;
  const top = named[named.length - 1];
  const sourceOf = (name: string) => {
    const r = kitIce.find((k) => ICE_LABEL[k.key as IceKind].toLowerCase() === name.trim().toLowerCase());
    return r ? kitSourceLine(r) || null : null;
  };
  const choosing = adding || !layers.length;
  return (
    <Sheet
      style={styles.sheet}
      visible
      onClose={onClose}
      accessibilityLabel="Ice in the glass"
      keyboard
      header={
        <View style={styles.head}>
          <Headline role="heading" style={styles.flex}>
            {choosing && layers.length ? 'Add a layer' : 'Ice in the glass'}
          </Headline>
          <Button label={adding ? 'Back' : 'Done'} size="sm" variant="ghost" onPress={adding ? () => setAdding(false) : onClose} />
        </View>
      }
    >
      {choosing ? (
        <LayerChoices
          onClose={() => setAdding(false)}
          onAdd={(l) => void save([...picks, l])}
          options={options}
          venue={venue && kitIce.length ? { name: venue.name, ice: kitIce.map((r) => ({ pick: pickOf(ICE_LABEL[r.key as IceKind]), source: kitSourceLine(r) || null })) } : null}
          below={top ? iceBuildLine([top]).replace(/^Over /, '') : null}
        />
      ) : (
        <SheetScrollView contentContainerStyle={styles.body}>
          <View role="radiogroup" accessibilityLabel="Ways to build the ice" style={styles.chips}>
            <WizardChip label="One kind" selected={!saysMore(layers)} onPress={() => void save(picks.slice(-1).map((l) => ({ ice: l.ice })))} />
            {QUICK_BUILDS.map((q) => (
              <WizardChip key={q} label={QUICK_LABEL[q]} selected={quick === q} onPress={() => void save(quickBuild(q, pickOf, madeWithId ? byId(madeWithId) : null))} />
            ))}
          </View>
          <IceLayers layers={picks} onChange={(next) => void save(next)} onAdd={() => setAdding(true)} sourceOf={sourceOf} />
          <Caption tone="muted">Clear every layer for no ice.</Caption>
        </SheetScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  sheet: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  body: { gap: space.lg, paddingBottom: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
