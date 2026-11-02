import { useRouter, type Href } from 'expo-router';

import { Body, Button } from '@/components/ds';
import { EquipmentArt, EquipmentFacts } from '@/components/techniques/EquipmentBody';
import { LEARN_CRUMBS, TechniquePage } from '@/components/techniques/TechniquePage';
import { equipmentById } from '@/lib/techniques';

/** One piece of kit, as Kept-learn draws it: the drawing, what it's for, On my shelf, Used in, Good to know and Where to buy one. */
export function EquipmentDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const e = equipmentById(id);
  if (!e) {
    return (
      <TechniquePage title="Not found" intro={<Body tone="muted">That isn’t in the equipment list.</Body>} crumbs={LEARN_CRUMBS}>
        <Button label="All equipment" onPress={() => router.replace('/equipment' as Href)} />
      </TechniquePage>
    );
  }
  return (
    <TechniquePage eyebrow="Equipment" title={e.name} intro={<Body tone="muted">{e.what}</Body>} art={<EquipmentArt id={e.id} />} crumbs={[...LEARN_CRUMBS, { label: 'Equipment', href: '/equipment' }]}>
      <EquipmentFacts e={e} />
    </TechniquePage>
  );
}
