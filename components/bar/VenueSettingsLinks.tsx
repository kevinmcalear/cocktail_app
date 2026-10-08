import { useRouter, type Href } from 'expo-router';

import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';

/** The venue settings that have screens of their own: publishing, dilution and pricing. */
export function VenueSettingsLinks({ barId }: { barId: string }) {
  const router = useRouter();
  const go = (page: string) => () => router.push(`/settings/bar/${barId}/${page}` as Href);
  return (
    <SettingsSection title="More settings">
      <SettingsRow icon="globe" label="Publishing" detail="Who outside the venue sees your drinks" onPress={go('publishing')} />
      <RowDivider />
      <SettingsRow icon="drop.fill" label="Dilution" detail="How much water each method adds" onPress={go('dilution')} />
      <RowDivider />
      <SettingsRow icon="dollarsign.circle.fill" label="Pricing" detail="Currency, tax and target GP" onPress={go('pricing')} />
    </SettingsSection>
  );
}
