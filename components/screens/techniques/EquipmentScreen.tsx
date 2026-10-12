import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Body, Caption, PressableScale, Spec, Surface, useDs } from '@/components/ds';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { backbar, space } from '@/constants/tokens';
import { useKit } from '@/hooks/useKit';
import { canMake, EQUIPMENT, TECHNIQUES, TIER_LABEL, unlocks, type Equipment } from '@/lib/techniques';

/** My kit: one list of tools with a switch each. What you have filters the technique library. */
export function EquipmentScreen() {
  const { kit, toggle } = useKit();
  const can = TECHNIQUES.filter((t) => canMake(t, kit)).length;
  return (
    <TechniquePage
      eyebrow="Techniques"
      title="My kit"
      intro={<Body tone="muted">Tell us what you have. Pots, jars, strainers, a fridge and a freezer are taken as given. Techniques that need something else move to the end.</Body>}
    >
      <View aria-live="polite" style={styles.summary}>
        <Spec>{String(can)}</Spec>
        <Body tone="muted">{`of ${TECHNIQUES.length} techniques you can make`}</Body>
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
      <Switch
        value={have}
        onValueChange={() => onToggle(e.id)}
        aria-label={`I have it: ${e.name}`}
        accessibilityLabel={`I have it: ${e.name}`}
        trackColor={{ false: ds.c.lineStrong, true: ds.c.ink }}
        thumbColor={backbar.light.surface}
        {...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm },
  list: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
