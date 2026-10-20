import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Sheet, SheetScrollView, Switch, useDs } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { samePick, type WizardPick } from '@/lib/drinkWizard';
import { iceKind, isLoose, type IceLayer, type IceTo } from '@/lib/iceBuild';

import { CountStepper, HeightPicker } from './IceLayers';
import { OwnField } from './PickStep';
import { Eyebrow, WizardChip } from './WizardChrome';

interface AddLayerSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (layer: IceLayer<WizardPick>) => void;
  /** Every ice to pick from (the venue's first, or one list at home). */
  options: WizardPick[];
  /** At a venue: its name and its own ice, in its order, with where each comes from. */
  venue?: { name: string; ice: { pick: WizardPick; source: string | null }[] } | null;
  /** What the new layer goes on: "4 cubes". */
  below?: string | null;
}

/**
 * Add a layer of ice on top (canvas "Ice builds", row 2): the venue's own ice
 * first, as its Kit lists it, the rest behind More ice; then how many pieces,
 * or how high loose ice goes and whether it's packed.
 */
export function AddLayerSheet({ visible, onClose, onAdd, options, venue, below }: AddLayerSheetProps) {
  return (
    <Sheet style={styles.sheet} visible={visible} onClose={onClose} accessibilityLabel="Add a layer" header={<Headline role="heading">Add a layer</Headline>} keyboard>
      {visible ? <LayerChoices {...{ onClose, onAdd, options, venue, below }} /> : null}
    </Sheet>
  );
}

/** The choices on their own, for a sheet that already is one (the drink editor's Ice). */
export function LayerChoices({ onClose, onAdd, options, venue, below }: Omit<AddLayerSheetProps, 'visible'>) {
  const ds = useDs();
  const own = venue?.ice ?? [];
  const rest = options.filter((o) => !own.some((v) => samePick(v.pick, o)) && iceKind(o.name) !== 'none');
  const [picked, setPicked] = useState<WizardPick | null>(null);
  const [more, setMore] = useState(!own.length);
  const [n, setN] = useState(1);
  const [to, setTo] = useState<IceTo>('rim');
  const [packed, setPacked] = useState(false);
  const pick = (p: WizardPick) => {
    setPicked(p);
    setN(iceKind(p.name) === 'cubes' ? 3 : 1);
  };
  const loose = picked ? isLoose(picked.name) : false;
  const add = () => {
    if (!picked) return;
    onAdd(loose ? { ice: picked, to, ...(packed ? { packed } : {}) } : { ice: picked, n });
    onClose();
  };
  return (
    <SheetScrollView contentContainerStyle={styles.body}>
      {below ? <Caption tone="muted">{`Goes on top of: ${below}.`}</Caption> : null}
      {own.length ? (
        <View style={styles.group}>
          <Eyebrow>{`${venue?.name ?? 'Your'}’s ice`}</Eyebrow>
          <View role="radiogroup" aria-label={`${venue?.name ?? 'Your'}’s ice`} style={[styles.card, { backgroundColor: ds.c.surface }]}>
            {own.map(({ pick: p, source }, i) => {
              const kind = iceKind(p.name);
              const on = samePick(p, picked);
              return (
                <PressableScale
                  key={p.id ?? p.name}
                  role="radio"
                  aria-checked={on}
                  accessibilityLabel={source ? `${p.name}. ${source}` : p.name}
                  onPress={() => pick(p)}
                  style={[styles.row, i > 0 && { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}
                >
                  {kind && kind !== 'none' ? <IceThumb kind={kind} /> : null}
                  <View style={styles.flex}>
                    <Body numberOfLines={1}>{p.name}</Body>
                    {source ? (
                      <Caption tone="muted" numberOfLines={1}>
                        {source}
                      </Caption>
                    ) : null}
                  </View>
                  {on ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}
      {more ? (
        <View style={styles.group}>
          {own.length ? <Eyebrow>More ice</Eyebrow> : null}
          <View role="radiogroup" aria-label="More ice" style={styles.chips}>
            {[...rest, ...(picked && ![...rest, ...own.map((v) => v.pick)].some((o) => samePick(o, picked)) ? [picked] : [])].map((o) => (
              <WizardChip key={o.id ?? `new:${o.name}`} label={o.name} selected={samePick(o, picked)} onPress={() => pick(o)} />
            ))}
          </View>
          <OwnField label="Other ice" onAdd={(name) => pick(rest.find((o) => samePick(o, { id: null, name })) ?? { id: null, name })} />
        </View>
      ) : (
        <PressableScale role="button" aria-expanded={false} accessibilityLabel="More ice" onPress={() => setMore(true)} style={[styles.more, { borderColor: ds.c.lineStrong }]}>
          <Body>More ice</Body>
          <IconSymbol name="chevron.down" size={12} color={ds.c.muted} />
        </PressableScale>
      )}
      {picked && loose ? (
        <View style={styles.group}>
          <Eyebrow>How high</Eyebrow>
          <HeightPicker value={to} onChange={setTo} />
          <View style={styles.between}>
            <Body>Packed</Body>
            <Switch value={packed} onValueChange={setPacked} label="Packed" />
          </View>
        </View>
      ) : picked ? (
        <View style={[styles.between, styles.group]}>
          <Body>How many</Body>
          <CountStepper value={n} noun={picked.name.toLowerCase().replace(/([^s])s$/, '$1')} onChange={setN} />
        </View>
      ) : null}
      <Button label="Add on top" size="lg" disabled={!picked} onPress={add} />
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  body: { gap: space.lg, paddingBottom: space.lg },
  group: { gap: space.sm },
  card: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  more: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
