import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Headline } from '@/components/ds';
import { SafetyPage } from '@/components/screens/safety/SafetyPage';
import { BRAND } from '@/constants/brand';
import { fontFamilies, space } from '@/constants/tokens';

/** A readable, single-column page for policies, on the same plain page as Support. Works signed in or out. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafetyPage title={title} intro={`${BRAND.productName} · Last updated ${BRAND.legalUpdated}`} backTo="/">
      <Stack.Screen options={{ headerShown: false, title }} />
      {children}
    </SafetyPage>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Headline role="heading">{heading}</Headline>
      {children}
    </View>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <Body>{children}</Body>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <View role="list" style={styles.bullets}>
      {items.map((item, i) => (
        <Body key={i} role="listitem">
          {'•  '}
          {item}
        </Body>
      ))}
    </View>
  );
}

export function SupportEmail() {
  return (
    <Body role="link" style={styles.link} onPress={() => void Linking.openURL(`mailto:${BRAND.supportEmail}`)}>
      {BRAND.supportEmail}
    </Body>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, marginTop: space.md },
  bullets: { gap: space.sm },
  // As Support's links: ink, underlined, a step heavier.
  link: { fontFamily: fontFamilies.bodySemiBold, textDecorationLine: 'underline' },
});
