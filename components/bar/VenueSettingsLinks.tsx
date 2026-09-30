import { useRouter, type Href } from 'expo-router';
import { Button, useTheme, YStack } from 'tamagui';

import { IconSymbol } from '@/components/ui/icon-symbol';

/** The venue settings that have their own redesigned screens: publishing, dilution and pricing. */
export function VenueSettingsLinks({ barId }: { barId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const ink = theme.color?.get() as string;
  return (
    <YStack gap="$2">
      <Button icon={<IconSymbol name="globe" size={18} color={ink} />} onPress={() => router.push(`/settings/bar/${barId}/publishing` as Href)}>
        Publishing: who outside the venue sees your drinks
      </Button>
      <Button icon={<IconSymbol name="drop.fill" size={18} color={ink} />} onPress={() => router.push(`/settings/bar/${barId}/dilution` as Href)}>
        Dilution: how much water each method adds
      </Button>
      <Button icon={<IconSymbol name="dollarsign.circle.fill" size={18} color={ink} />} onPress={() => router.push(`/settings/bar/${barId}/pricing` as Href)}>
        Pricing: currency, tax and target GP
      </Button>
    </YStack>
  );
}
