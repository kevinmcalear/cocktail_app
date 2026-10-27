import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { iceNameOf, type IceLayer, type IceName, type IceTip } from '@/lib/iceBuild';
import { draftSketchInputs, type DraftLook } from '@/lib/sketch/draft';

// Each ice by name, with its kind when its item or pick says.
const named = (ice: IceName) => (typeof ice === 'string' ? { name: ice } : { name: ice.name, kind: ice.kind ?? ice.ice_kind ?? null });
const asBuild = (layers: readonly IceLayer<IceName>[]) => {
  const top = layers[layers.length - 1]?.ice;
  return { ice: top ? iceNameOf(top) : null, iceKind: top ? (named(top).kind ?? null) : null, build: layers.map((l) => ({ ...named(l.ice), n: l.n, to: l.to })) };
};

/**
 * A suggestion for how the ice sits (canvas "Ice builds", row 3): what it
 * says, the drink as it is beside the drink as suggested, and Use it or No
 * thanks. One at a time; the bartender can take it or leave it.
 */
export function IceTipCard({ tip, now, look, seed, onUse, onNo }: { tip: IceTip; now: readonly IceLayer<IceName>[]; look: DraftLook; seed: string; onUse: () => void; onNo: () => void }) {
  const ds = useDs();
  const key = JSON.stringify([look, now, tip.layers]);
  const [before, after] = useMemo(() => {
    const [l, a, b] = JSON.parse(key) as [DraftLook, IceLayer<IceName>[], IceLayer<IceName>[]];
    return [draftSketchInputs({ ...l, ...asBuild(a) }), draftSketchInputs({ ...l, ...asBuild(b) })];
  }, [key]);
  return (
    <View role="note" style={[styles.card, { backgroundColor: ds.c.raised }]}>
      <Headline role="heading">{tip.title}</Headline>
      <Body tone="muted">{tip.body}</Body>
      <View style={styles.pair} aria-hidden>
        <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
          <SketchDrawing inputs={before} seed={seed} detail="thumb" />
        </View>
        <IconSymbol name="arrow.right" size={16} color={ds.c.muted} />
        <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
          <SketchDrawing inputs={after} seed={seed} detail="thumb" />
        </View>
      </View>
      <View style={styles.actions}>
        <Button label={tip.yes} variant="secondary" onPress={onUse} />
        <Button label="No thanks" variant="ghost" onPress={onNo} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  pair: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  paper: { width: 84, height: 96, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
