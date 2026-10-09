import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Spec, useDs } from '@/components/ds';
import { BuyList, Notes, Section, TechniqueRow } from '@/components/techniques/bits';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { radius, space } from '@/constants/tokens';
import { EQUIPMENT_KINDS, equipmentById, techniquesUsing, TIER_LABEL } from '@/lib/techniques';
import { useKit } from '@/hooks/useKit';

/** One piece of kit: what it's for, the cost, what to use without it, the safety point, and every technique it's needed for or helps with. */
export function EquipmentDetailScreen({ id }: { id: string }) {
  const ds = useDs();
  const router = useRouter();
  const { kit, toggle } = useKit();
  const e = equipmentById(id);
  if (!e) {
    return (
      <TechniquePage title="Not found" intro={<Body tone="muted">That isn’t in the equipment list.</Body>}>
        <Button label="All equipment" onPress={() => router.replace('/equipment' as never)} />
      </TechniquePage>
    );
  }
  const have = kit.has(e.id);
  const { needs, helps } = techniquesUsing(e.id);
  const kind = EQUIPMENT_KINDS.find((k) => k.id === e.kind)?.name;

  return (
    <TechniquePage eyebrow={kind ? `Equipment · ${kind}` : 'Equipment'} title={e.name} intro={<Body tone="muted">{e.what}</Body>}>
      <View style={styles.facts}>
        <View style={[styles.fact, { backgroundColor: ds.c.raised }]}>
          <Caption tone="muted">Cost</Caption>
          <Spec>{e.price ?? TIER_LABEL[e.tier]}</Spec>
        </View>
      </View>
      <Button label={have ? 'You have this' : 'I have this'} icon={have ? 'checkmark' : 'plus'} variant={have ? 'secondary' : 'primary'} onPress={() => toggle(e.id)} />
      {e.note ? (
        <Section title="Know this">
          <Notes items={[e.note]} />
        </Section>
      ) : null}
      {e.swap ? (
        <Section title="Without one">
          <Notes items={[e.swap]} icon="arrow.up.and.down" />
        </Section>
      ) : null}
      {needs.length ? (
        <Section title="Needed for">
          {needs.map((t) => (
            <TechniqueRow key={t.id} t={t} kit={kit} />
          ))}
        </Section>
      ) : null}
      {helps.length ? (
        <Section title="Helps with">
          {helps.map((t) => (
            <TechniqueRow key={t.id} t={t} kit={kit} />
          ))}
        </Section>
      ) : null}
      {e.buy?.length ? (
        <Section title="Where to buy">
          <BuyList links={e.buy} />
        </Section>
      ) : null}
      {!e.price ? <Caption tone="muted">Prices are rough tiers, not quotes. Check current prices before buying.</Caption> : null}
    </TechniquePage>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', gap: space.sm },
  fact: { flexGrow: 1, flexShrink: 1, minWidth: 0, padding: space.sm, borderRadius: radius.control, gap: 2 },
});
