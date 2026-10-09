import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, Headline, PressableScale, Spec, Surface, useDs } from '@/components/ds';
import { Section } from '@/components/techniques/bits';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { space } from '@/constants/tokens';
import { canMake, EQUIPMENT, EQUIPMENT_KINDS, TECHNIQUES, techniquesUsing, TIER_LABEL, unlocks, type Equipment } from '@/lib/techniques';
import { useKit, useKitStore } from '@/store/useKitStore';

/** The bar's equipment: what each piece is for, roughly what it costs, and which you have. What you have filters the technique library. */
export function EquipmentScreen() {
  const kit = useKit();
  const can = TECHNIQUES.filter((t) => canMake(t, kit)).length;
  return (
    <TechniquePage
      eyebrow="Techniques"
      title="Equipment"
      intro={<Body tone="muted">Mark what you have. Pots, jars, fine strainers, coffee filters, a fridge and a freezer are taken as given.</Body>}
    >
      <Surface style={styles.summary}>
        <Spec>{`${can} of ${TECHNIQUES.length}`}</Spec>
        <Body tone="muted">techniques you can make with what you have</Body>
      </Surface>
      {EQUIPMENT_KINDS.map((k) => (
        <Section key={k.id} title={k.name}>
          {EQUIPMENT.filter((e) => e.kind === k.id).map((e) => (
            <EquipmentRow key={e.id} e={e} kit={kit} />
          ))}
        </Section>
      ))}
    </TechniquePage>
  );
}

function EquipmentRow({ e, kit }: { e: Equipment; kit: ReadonlySet<string> }) {
  const ds = useDs();
  const router = useRouter();
  const toggle = useKitStore((s) => s.toggle);
  const have = kit.has(e.id);
  const n = unlocks(e.id, kit);
  const used = techniquesUsing(e.id);
  const opens = n ? `${have ? 'Opens' : 'Would open'} ${n} ${n === 1 ? 'technique' : 'techniques'}` : used.needs.length + used.helps.length ? 'Helps with techniques' : null;
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <PressableScale role="link" accessibilityLabel={`${e.name}. ${e.what}`} onPress={() => router.push(`/equipment/${e.id}` as never)} style={styles.flex}>
        <Headline>{e.name}</Headline>
        <Body tone="muted">{e.what}</Body>
        <Caption tone="muted">{[e.price ?? TIER_LABEL[e.tier], opens].filter(Boolean).join(' · ')}</Caption>
      </PressableScale>
      <Chip label="I have it" accessibilityLabel={`I have it: ${e.name}`} multi selected={have} onPress={() => toggle(e.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
