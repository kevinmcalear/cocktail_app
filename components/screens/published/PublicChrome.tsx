import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, GlassButton, Headline, PressableScale, Surface, useBreakpoint, useDs } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';

// The public web's own chrome, around every signed-out page (/d, /p, /m, /r):
// the site nav, the footer, the sign-in band and the small capitals kicker.
// Boards: ppl-pub-drink-desktop, ppl-pub-drink-phone, ppl-pub-bar-*, ppl-pub-menu-*.

/** Where the nav goes. Signed out, the app's own screens ask you to sign in first. */
const LINKS: { label: string; href: Href }[] = [
  { label: 'Discover', href: '/discover' },
  // ponytail: Bars and Near me both open Discover (its map of bars); give them their own layer once Discover takes one in the URL.
  { label: 'Bars', href: '/discover' },
  { label: 'People', href: '/search' },
  { label: 'Near me', href: '/discover' },
];

// ponytail: Get the app opens Support until the store listings are live; then the App Store and Google Play links.
const GET_THE_APP: Href = '/support';

/** "Cocktail" in the italic display face: the site's name, home. */
function Wordmark({ size = 'nav' }: { size?: 'nav' | 'footer' }) {
  const router = useRouter();
  return (
    <PressableScale role="link" accessibilityLabel="Cocktail, home" onPress={() => router.push('/')} style={styles.tap}>
      <DsText variant={size === 'nav' ? 'title' : 'headline'} italic style={size === 'nav' ? styles.wordmark : undefined}>
        Cocktail
      </DsText>
    </PressableScale>
  );
}

function NavLink({ label, href }: { label: string; href: Href }) {
  const router = useRouter();
  return (
    <PressableScale role="link" accessibilityLabel={label} onPress={() => router.push(href)} style={styles.tap}>
      <Body tone="muted">{label}</Body>
    </PressableScale>
  );
}

/**
 * The site nav. Wide: Cocktail, Discover, Bars, People, Near me, and Get the
 * app. Phone: Cocktail, Get the app and a menu button that opens the links
 * under the bar (no sheet: it's a page's nav).
 */
export function PublicNav() {
  const ds = useDs();
  const router = useRouter();
  const wide = useBreakpoint() !== 'phone';
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.nav, { borderBottomColor: ds.c.line }]} role="navigation" aria-label="Cocktail">
      <View style={styles.navRow}>
        <Wordmark />
        {wide ? LINKS.map((l) => <NavLink key={l.label} {...l} />) : null}
        <View style={styles.flex} />
        <Button label="Get the app" variant={wide ? 'secondary' : 'primary'} onPress={() => router.push(GET_THE_APP)} />
        {wide ? null : (
          <GlassButton accessibilityLabel={open ? 'Close the menu' : 'Menu: Discover, Bars, People, Near me'} icon={open ? 'xmark' : 'line.horizontal.3'} onPress={() => setOpen((o) => !o)} />
        )}
      </View>
      {open && !wide ? (
        <View style={styles.menu}>
          {LINKS.map((l) => (
            <NavLink key={l.label} {...l} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Cocktail, Support, Privacy, Terms, and the site's address. */
export function PublicFooter() {
  const ds = useDs();
  const router = useRouter();
  const link = (label: string, href: Href) => (
    <PressableScale key={label} role="link" accessibilityLabel={label} onPress={() => router.push(href)} style={styles.tap}>
      <Caption tone="muted" style={styles.underline}>
        {label}
      </Caption>
    </PressableScale>
  );
  return (
    <View style={[styles.footer, { borderTopColor: ds.c.line }]} role="contentinfo">
      <Wordmark size="footer" />
      {link('Support', '/support')}
      {link('Privacy', '/legal/privacy')}
      {link('Terms', '/legal/terms')}
      <View style={styles.flex} />
      <Caption tone="muted">babyvom.it</Caption>
    </View>
  );
}

/** "MODERN CLASSIC · 2005": small capitals in the mono face over a name or a section. */
export function Kicker({ children }: { children: string }) {
  return (
    <Caption tone="muted" style={styles.kicker}>
      {children.toUpperCase()}
    </Caption>
  );
}

/**
 * The band near the foot of a public page that says what signing in gets you
 * ("Rank it, save it, find where it's poured best"), with Sign in.
 */
export function SignInBand({ text, title = 'Rank it, save it, find where it’s poured best' }: { text: string; title?: string }) {
  const router = useRouter();
  return (
    <Surface style={styles.band}>
      <View style={styles.bandText}>
        <Headline role="heading">{title}</Headline>
        <Body tone="muted">{text}</Body>
      </View>
      <Button label="Sign in" onPress={() => router.push('/auth/login')} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tap: { minHeight: 44, justifyContent: 'center' },
  wordmark: { marginRight: space.sm },
  nav: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    flexWrap: 'wrap',
  },
  menu: { paddingTop: space.sm, gap: space.xs },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.xl,
    rowGap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.xl,
  },
  underline: { textDecorationLine: 'underline' },
  kicker: { fontFamily: fontFamilies.monoMedium, letterSpacing: 1.4 },
  band: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.xl,
    rowGap: space.md,
    padding: space.xl,
  },
  bandText: { flexGrow: 1, flexBasis: 260, gap: space.xs },
});
