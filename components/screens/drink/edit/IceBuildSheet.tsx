import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, Sheet, SheetScrollView } from '@/components/ds';
import { LayerChoices } from '@/components/screens/addDrink/AddLayerSheet';
import { IceLayers } from '@/components/screens/addDrink/IceLayers';
import { WizardChip } from '@/components/screens/addDrink/WizardChrome';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useVenueIce } from '@/hooks/useVenueIce';
import { samePick, type WizardPick } from '@/lib/drinkWizard';
import { iceBuildLine, QUICK_BUILDS, QUICK_LABEL, quickBuild, saysMore, whichQuick, type IceLayer } from '@/lib/iceBuild';
import { inTheGlass, kitIceRow, kitSourceLine } from '@/lib/venueKit';

/** An ice row, with its kind when it says (items.ice_kind): it passes as a pick. */
type Option = { id: string; name: string; ice_kind?: string | null };

interface IceBuildSheetProps {
  options: Option[];
  /** The layers by ice id, bottom first; one plain ice is one layer. */
  layers: IceLayer<string>[];
  onChange: (layers: IceLayer<string>[]) => void;
  /** Makes a new ice by name, with its kind when asked (the editor's handleAddPill), and gives its id. */
  addIce: (name: string, kind?: string | null) => Promise<string>;
  barId: string | null;
  madeWithId: string | null;
  onClose: () => void;
}

/**
 * The drink editor's Ice (canvas "Ice builds", row 6): the same layers as the
 * wizard, quick builds, and Add extra ice with the venue's ice first.
 * Adding shows its choices in this sheet, not a second one over it.
 */
export function IceBuildSheet({ options, layers, onChange, addIce, barId, madeWithId, onClose }: IceBuildSheetProps) {
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);
  const venue = useActiveVenue().venues.find((v) => v.id === barId) ?? null;
  const kitIce = (useVenueIce(barId).data ?? []).filter(inTheGlass);
  const byId = (id: string): WizardPick | null => options.find((o) => o.id === id) ?? null;
  const pickOf = (name: string): WizardPick => options.find((o) => samePick(o, { id: null, name })) ?? { id: null, name };
  // A layer whose ice is gone (merged, or not this person's to see) drops out, and is saved without it.
  const picks = layers.flatMap((l) => {
    const ice = byId(l.ice);
    return ice ? [{ ...l, ice }] : [];
  });
  // New ice is made by name before the layers change, so every layer has an id.
  const save = async (next: IceLayer<WizardPick>[]) => {
    try {
      const ids: string[] = [];
      for (const l of next) ids.push(l.ice.id ?? (await addIce(l.ice.name, l.ice.kind)));
      setFailed(false);
      onChange(next.map((l, i) => ({ ...l, ice: ids[i] })));
    } catch {
      setFailed(true);
    }
  };
  const quick = layers.length ? whichQuick(picks) : null;
  const top = picks[picks.length - 1];
  const sourceOf = (name: string) => {
    const r = kitIceRow(kitIce, name);
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
            {choosing && layers.length ? 'Add extra ice' : 'Ice in the glass'}
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
          venue={venue && kitIce.length ? { name: venue.name, ice: kitIce.map((r) => ({ pick: pickOf(r.name), source: kitSourceLine(r) || null })) } : null}
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
          {failed ? <Caption tone="accent">Couldn’t add that ice. Check your connection and try again.</Caption> : null}
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
