import { Stack } from 'expo-router';
import { WebHead } from '@/components/WebHead';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';
import { ScrollView, Text, YStack } from 'tamagui';

import { BRAND } from '@/constants/brand';

/** A readable, single-column page for policies. Works signed in or out. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title }} />
      <WebHead>
        <title>{`${title} · ${BRAND.productName}`}</title>
      </WebHead>
      <YStack width="100%" maxWidth={720} alignSelf="center" paddingHorizontal="$5" paddingVertical="$7" gap="$5">
        <YStack gap="$2">
          <Text fontSize={32} fontWeight="700" color="$color" accessibilityRole="header">
            {title}
          </Text>
          <Text fontSize={14} color="$color11">
            {BRAND.productName} · Last updated {BRAND.legalUpdated}
          </Text>
        </YStack>
        {children}
      </YStack>
    </ScrollView>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <YStack gap="$2.5">
      <Text fontSize={19} fontWeight="700" color="$color" accessibilityRole="header">
        {heading}
      </Text>
      {children}
    </YStack>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <Text fontSize={16} lineHeight={25} color="$color">
      {children}
    </Text>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <YStack gap="$2">
      {items.map((item, i) => (
        <Text key={i} fontSize={16} lineHeight={25} color="$color">
          {'•  '}
          {item}
        </Text>
      ))}
    </YStack>
  );
}

export function SupportEmail() {
  return (
    <Text
      fontSize={16}
      color="$color8"
      textDecorationLine="underline"
      accessibilityRole="link"
      onPress={() => void Linking.openURL(`mailto:${BRAND.supportEmail}`)}
    >
      {BRAND.supportEmail}
    </Text>
  );
}
