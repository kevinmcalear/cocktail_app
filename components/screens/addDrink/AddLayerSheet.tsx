import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Sheet, SheetScrollView, Switch, useDs } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { samePick, type WizardPick } from '@/lib/drinkWizard';
import { iceKind, isLoose, QUICK_BUILDS, QUICK_LABEL, singular, type IceLayer, type IceTo, type QuickBuild } from '@/lib/iceBuild';

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
  /** Or a whole build in place of the layers (the wizard's Ice step). */
  onBuild?: (build: QuickBuild) => void;
  /** Dump the tin needs the ice it's shaken with. */
  canDump?: boolean;
}

/**
 * Add extra ice on top (canvas "Ice builds", row 2; Q21 + E24, 26 Oct): a
 * whole build in its place, or the venue's own ice first, as its Kit lists
 * it, the rest behind More ice; then how many pieces, or how high loose ice
 * goes and whether it's packed.
 */
export function AddLayerSheet({ visible, ...choices }: AddLayerSheetProps) {
  return (
    <Sheet style={styles.sheet} visible={visible} onClose={choices.onClose} accessibilityLabel="Add extra ice" header={<Headline role="heading">Add extra ice</Headline>} keyboard>
      {visible ? <LayerChoices {...choices} /> : null}
    </Sheet>
  );
}

/** The choices on their own, for a sheet that already is one (the drink editor's Ice). */
export function LayerChoices({ onClose, onAdd, options, venue, below, onBuild, canDump }: Omit<AddLayerSheetProps, 'visible'>) {
  const ds = useDs();
  const own = venue?.ice ?? [];
  const rest = options.filter((o) => !own.some((v) => samePick(v.pick, o)) && iceKind(o) !== 'none');
  const [picked, setPicked] = useState<WizardPick | null>(null);
  const [more, setMore] = useState(!own.length);
  const [n, setN] = useState(1);
  const [to, setTo] = useState<IceTo>('rim');
  const [packed, setPacked] = useState(false);
  const pick = (p: WizardPick) => {
    setPicked(p);
    setN(iceKind(p) === 'cubes' ? 3 : 1);
  };
  const loose = picked ? isLoose(picked) : false;
  const known = (name: string) => [...options, ...own.map((v) => v.pick)].some((o) => samePick(o, { id: null, name }));
  const add = () => {
    if (!picked) return;
    onAdd(loose ? { ice: picked, to, ...(packed ? { packed } : {}) } : { ice: picked, n });
    onClose();
  };
  return (
    <SheetScrollView contentContainerStyle={styles.body}>
      {below ? <Caption tone="muted">{`Goes on top of: ${below}.`}</Caption> : null}
      {onBuild ? (
        <View style={styles.group}>
          <Eyebrow>Or a whole build</Eyebrow>
          <View role="group" aria-label="Or a whole build" style={styles.chips}>
            {QUICK_BUILDS.filter((q) => canDump || q !== 'dump').map((q) => (
              <WizardChip
                key={q}
                kind="button"
                label={QUICK_LABEL[q]}
                onPress={() => {
                  onBuild(q);
                  onClose();
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
      {own.length ? (
        <View style={styles.group}>
          <Eyebrow>{`${venue?.name ?? 'Your'}’s ice`}</Eyebrow>
          <View role="radiogroup" aria-label={`${venue?.name ?? 'Your'}’s ice`} style={[styles.card, { backgroundColor: ds.c.surface }]}>
            {own.map(({ pick: p, source }, i) => {
              const kind = iceKind(p);
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
          <OwnField
            label="Other ice"
            ask={{ of: 'ice', known }}
            onAdd={(name, kind) => pick(rest.find((o) => samePick(o, { id: null, name })) ?? { id: null, name, ...(kind !== undefined ? { kind } : {}) })}
          />
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
          <CountStepper value={n} noun={singular(picked.name)} onChange={setN} />
        </View>
      ) : null}
      {onBuild ? (
        <View style={styles.buttons}>
          <Button label="Cancel" size="lg" variant="secondary" onPress={onClose} />
          <Button label="Add on top" size="lg" disabled={!picked} onPress={add} style={styles.flex} />
        </View>
      ) : (
        <Button label="Add on top" size="lg" disabled={!picked} onPress={add} />
      )}
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
  buttons: { flexDirection: 'row', gap: space.sm },
});
