import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Surface, useDs } from '@/components/ds';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useKit } from '@/hooks/useKit';
import { canMake, EQUIPMENT, TECHNIQUES, TIER_LABEL, unlocks, type Equipment } from '@/lib/techniques';

/** My kit: one list of tools with a switch each. What you have filters the technique library. */
export function EquipmentScreen() {
  const ds = useDs();
  const { kit, toggle } = useKit();
  const can = TECHNIQUES.filter((t) => canMake(t, kit)).length;
  return (
    <TechniquePage
      title="My kit"
      intro={<Body tone="muted">Tell us what you have. Pots, jars, strainers, a fridge and a freezer are taken as given. Techniques that need something else move to the end.</Body>}
    >
      {/* The count on an ink card, the number big (prep-tech-kit). */}
      <View aria-live="polite" style={[styles.summary, { backgroundColor: ds.c.ink }]}>
        <DsText variant="title" color={ds.c.ground} style={styles.count}>
          {String(can)}
        </DsText>
        <Body color={ds.c.ground}>{`of ${TECHNIQUES.length} techniques you can make`}</Body>
      </View>
      <Surface style={styles.list}>
        {EQUIPMENT.map((e, i) => (
          <KitRow key={e.id} e={e} kit={kit} onToggle={toggle} last={i === EQUIPMENT.length - 1} />
        ))}
      </Surface>
    </TechniquePage>
  );
}

function KitRow({ e, kit, onToggle, last }: { e: Equipment; kit: ReadonlySet<string>; onToggle: (id: string) => void; last: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const have = kit.has(e.id);
  const n = unlocks(e.id, kit);
  const opens = n ? `${have ? 'opens' : 'would open'} ${n} ${n === 1 ? 'technique' : 'techniques'}` : null;
  return (
    <View style={[styles.row, !last && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <PressableScale role="link" accessibilityLabel={`${e.name}. ${TIER_LABEL[e.tier]}${opens ? `, ${opens}` : ''}. Opens its page`} onPress={() => router.push(`/equipment/${e.id}` as never)} style={styles.flex}>
        <Body>{e.name}</Body>
        <Caption tone="muted">{[e.tier, opens].filter(Boolean).join(' · ')}</Caption>
      </PressableScale>
      <Toggle on={have} label={`I have it: ${e.name}`} onPress={() => onToggle(e.id)} />
    </View>
  );
}

/** A large switch as drawn: an ink track with a white knob, tan when off. */
function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="switch" aria-checked={on} accessibilityLabel={label} onPress={onPress} style={[styles.track, { backgroundColor: on ? ds.c.ink : ds.c.lineStrong }]}>
      <View style={[styles.knob, { backgroundColor: ds.c.surface, alignSelf: on ? 'flex-end' : 'flex-start' }]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  count: { fontFamily: fontFamilies.monoMedium },
  list: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  track: { width: 52, height: 32, borderRadius: radius.pill, padding: 3, justifyContent: 'center' },
  knob: { width: 26, height: 26, borderRadius: radius.pill },
});
