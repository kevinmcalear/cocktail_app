import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Headline, Surface } from '@/components/ds';
import { SafetyPage } from '@/components/screens/safety/SafetyPage';
import { BRAND } from '@/constants/brand';
import { fontFamilies, space } from '@/constants/tokens';

/**
 * Public help page, the store listings' Support URL (babyvom.it/support):
 * how to reach us and the questions people ask most. Works signed in or out.
 */
export default function Support() {
  return (
    <SafetyPage title="Support" intro={`Help with ${BRAND.productName}, and how to reach a person.`} backTo="/">
      <Surface style={styles.card}>
        <Headline role="heading">Get in touch</Headline>
        <Body>
          Email <TextLink href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</TextLink> about anything: a problem, a question, or something that looks wrong. A person reads
          every message.
        </Body>
      </Surface>

      <Question heading="Claiming a bar">
        On the bar&apos;s page, tap “Work here? Claim this page”. We check it&apos;s yours one of three ways: you signed in with
        an address at the bar&apos;s own website (instant), a six-digit code in the bar&apos;s Instagram bio, or a call to the
        bar on a number we look up ourselves. A moderator checks the last two, usually within a day.
      </Question>

      <Question heading="Joining a venue">
        Venues are invite only. Ask an Admin at your venue to invite you from their Team page, then open the link in the
        email they send.
      </Question>

      <Question heading="Reporting content or a person">
        Use Report on the drink, menu or profile (on a profile it sits under the ••• button, next to Block). A moderator
        reviews every report, and you can follow yours in Settings › Your reports.
      </Question>

      <Question heading="Deleting your account">
        In the app, open Settings › Account › Delete account. Without the app, follow the steps on{' '}
        <TextLink href="/legal/delete-account">Delete your account</TextLink>.
      </Question>

      <Question heading="Who can use it">
        You must be at least 18 and of legal drinking age where you live. We ask once, after you sign up.
      </Question>

      <View style={styles.footer}>
        <TextLink href="/legal/privacy">Privacy policy</TextLink>
        <TextLink href="/legal/terms">Terms of use</TextLink>
      </View>
    </SafetyPage>
  );
}

function Question({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View style={styles.question}>
      <Headline role="heading">{heading}</Headline>
      <Body tone="muted">{children}</Body>
    </View>
  );
}

function TextLink({ href, children }: { href: Href; children: string }) {
  return (
    <Link href={href}>
      <Body style={styles.link}>{children}</Body>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, marginVertical: space.md },
  question: { gap: space.xs, marginTop: space.md },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl, marginTop: space.xl },
  link: { fontFamily: fontFamilies.bodySemiBold, textDecorationLine: 'underline' },
});
