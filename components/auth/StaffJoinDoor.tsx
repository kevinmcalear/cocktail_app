import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthBrand } from '@/components/auth/AuthShell';
import { BackbarTheme, Body, Button, Caption, Display, DsText, LogoImage, useDs, useGutter, type IconName } from '@/components/ds';
import { RoundNote } from '@/components/screens/firstRound/StepGroup';
import { space, STATUS } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

const CREST = 68;
/** How far down the bar's colour reaches before it is the ground. */
const SKY = 420;

/**
 * The door's words. The link is one link for everyone, so the door names the
 * bar that asked, not the person who shared it (Kevin, 3 Nov 2026: C13); "The
 * team" when the bar has no name.
 */
export function joinLines(bar: string, web: boolean) {
  return {
    title: `Join ${bar}`,
    body: `${bar.trim() || 'The team'} asked you on. You’ll see tonight’s menu, the specs and the prep list.`,
    note: web ? 'Works in your browser. Add it to your home screen for one tap.' : 'You join as a Bartender. An Admin can change that.',
  };
}

/**
 * The staff link opened signed out (board Kept-onboard, Staff door 1): the
 * bar's crest on its colour, Join <bar>, what they'll see, and the two ways
 * in. Both lead to the email code; a new account and a returning one are the
 * same code, so the second only changes the words on the next step.
 */
export function StaffJoinDoor({ brand, onContinue }: { brand: AuthBrand; onContinue: (returning: boolean) => void }) {
  const copy = joinLines(brand.name, Platform.OS === 'web');
  return (
    <DoorPage brand={brand} title={copy.title} body={copy.body} note={{ icon: Platform.OS === 'web' ? 'iphone' : 'person.2', text: copy.note }}>
      <Button label="Continue with email" icon="envelope" variant="ink" size="lg" onPress={() => onContinue(false)} />
      <Button label="I already have an account" variant="plain" onPress={() => onContinue(true)} />
    </DoorPage>
  );
}

export interface DoorPageProps {
  brand: AuthBrand;
  title: string;
  body: string;
  /** The buttons, main one first. */
  children: ReactNode;
  /** Under the buttons: an error, read out when it appears. */
  alert?: string | null;
  note?: { icon: IconName; text: string } | null;
}

/**
 * The door's page: the bar's colour fading into the ground, its crest, a
 * title and what it means, the buttons, then a note. In a column in the
 * middle on a wide screen (Miss-door-desk). The signed-out door and the
 * signed-in one (StaffLinkDoor) both use it.
 */
export function DoorPage(props: DoorPageProps) {
  return (
    <BackbarTheme>
      <Door {...props} />
    </BackbarTheme>
  );
}

function Door({ brand, title, body, children, alert, note }: DoorPageProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const tint = withAlpha(ds.accentFill.fill, ds.scheme === 'dark' ? 0.24 : 0.16);
  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <LinearGradient pointerEvents="none" colors={[tint, withAlpha(ds.c.ground, 0)]} style={styles.sky} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter, paddingTop: insets.top + space.xxxl * 2, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.column}>
          <Crest brand={brand} />
          <View style={styles.head}>
            <Display>{title}</Display>
            <Body tone="muted">{body}</Body>
          </View>
          <View style={styles.buttons}>{children}</View>
          {alert ? (
            <Caption color={STATUS.danger} role="alert">
              {alert}
            </Caption>
          ) : null}
          {note ? <RoundNote icon={note.icon} text={note.text} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** The bar's logo, or its first letter on its colour, in a ring. */
function Crest({ brand }: { brand: AuthBrand }) {
  const ds = useDs();
  const edge = { borderColor: ds.scheme === 'dark' ? ds.c.lineStrong : withAlpha(ds.c.surface, 0.7) };
  if (brand.logoUrl) return <LogoImage uri={brand.logoUrl} size={CREST} radius={CREST / 2} label={`${brand.name} logo`} style={[styles.ring, edge]} />;
  return (
    <View role="img" aria-label={`${brand.name} logo`} style={[styles.crest, styles.ring, edge, { backgroundColor: ds.accentFill.fill }]}>
      <DsText variant="title" color={ds.accentFill.text}>
        {brand.name.trim().charAt(0).toUpperCase() || '·'}
      </DsText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: SKY },
  scroll: { flexGrow: 1 },
  column: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: space.xl },
  head: { gap: space.md },
  buttons: { gap: space.xs },
  crest: { width: CREST, height: CREST, borderRadius: CREST / 2, alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 3 },
});
