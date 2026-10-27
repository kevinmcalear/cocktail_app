import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, GlassButton, PressableScale, Title, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { usePageFrame } from '@/components/nav/PageFrame';
import { useAuth } from '@/ctx/AuthContext';
import { WebHead } from '@/components/WebHead';
import { PublicPage } from '@/components/screens/published/PublicChrome';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';

/** Where a setup step is: the segments filled so far and the words beside them. */
export interface StepProgressValue {
  at: number;
  of: number;
  /** "Step 2 of 4", "Almost done". Null on a step that shows only the bar. */
  label: string | null;
  /** What the bar is for, for screen readers: "Setup", "Venue setup". */
  name?: string;
}

export interface SafetyPageProps {
  title: string;
  intro?: string;
  /** A small line above the title, like "Step 2 of 4". */
  kicker?: string | null;
  /** A small caps line above the title: the venue's name, "Last step". */
  eyebrow?: string | null;
  /** The eyebrow in the venue's accent (a step wearing its brand); muted otherwise. */
  eyebrowTone?: 'accent' | 'muted';
  /** Beside Back on a setup page without a progress bar: "Venue setup". */
  topLabel?: string;
  /** Above the title: the venue's logo with a check on venue setup's summary. */
  mark?: ReactNode;
  children: ReactNode;
  /** Hide the back button (the age check after sign-up has its own way on). */
  noBack?: boolean;
  /** Where Back goes when there's no history (a link opened cold). */
  backTo?: '/settings' | '/settings/profile' | '/';
  /** A setup step's own Back (the step before), shown on every width. */
  onBack?: () => void;
  /** A setup step's segmented progress bar, at the top beside Back. */
  progress?: StepProgressValue | null;
  /** At the top right, across from Back: "Later". */
  topRight?: ReactNode;
  /** Pinned to the bottom: Continue and Not now on a setup step. */
  footer?: ReactNode;
  /** Wide web only: a rail to the left of the page (venue setup's steps). */
  aside?: ReactNode;
  /** Top right, beside Back: Save, Preview, a count. */
  action?: ReactNode;
  /** Wide web: how wide the column grows; the setup checklist's Next card needs 'wide'. */
  frameWidth?: 'text' | 'wide';
}

/** The plain page the safety screens (and Not available) share: a title, a line of intro, a readable column. */
export function SafetyPage(props: SafetyPageProps) {
  return (
    <BackbarTheme>
      <Page {...props} />
    </BackbarTheme>
  );
}

/** Setup's progress: a segment per step, filled in the accent up to where they are. */
export function StepProgress({ at, of, label, name = 'Setup', wide }: StepProgressValue & { wide?: boolean }) {
  const ds = useDs();
  return (
    <View style={styles.progressRow}>
      {/* Wide web (canvas make-venue-desktop): a short bar in the middle, the step at the far right. */}
      {wide ? <View style={styles.flex} /> : null}
      <View role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={of} aria-valuenow={at} style={[styles.segments, wide && styles.segmentsWide]}>
        {Array.from({ length: of }, (_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < at ? ds.accentFill.fill : ds.c.raised }]} />
        ))}
      </View>
      {wide ? <View style={styles.flex} /> : null}
      {label ? <Caption tone="muted" style={styles.medium}>{label}</Caption> : null}
    </View>
  );
}

/** A setup step's Back: a bare chevron (canvas make-onboarding-*), with "Back" beside it on wide web. */
function SetupBack({ onPress, label }: { onPress: () => void; label?: string }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="Back" onPress={onPress} hitSlop={4} style={[styles.bareBack, label ? styles.backWithLabel : null]}>
      <IconSymbol name="chevron.left" size={20} color={ds.c.ink} />
      {label ? <Body style={styles.medium}>{label}</Body> : null}
    </PressableScale>
  );
}

function Page({ title, intro, kicker, eyebrow, eyebrowTone = 'muted', topLabel, mark, children, noBack, backTo = '/settings', action, onBack, progress, topRight, footer, aside, frameWidth = 'text' }: SafetyPageProps) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  // Wide web: the page sits left beside the sidebar, which is the way around, so no Back.
  // Signed out (Support, a link opened cold) there is no sidebar, so Back stays.
  const frame = usePageFrame(frameWidth);
  const signedIn = !!useAuth().user;
  const sidebar = frame.wide && signedIn && !onBack;
  const [footerHeight, setFooterHeight] = useState(0);
  // A setup step: Back, the bar and "Later" share one row at the top.
  const setupBar = !!(onBack || progress || topRight);
  // Venue setup on wide web: the rail on the left, and the step's buttons sit under it instead of pinned.
  const desk = !!aside && frame.wide;
  const pinned = footer && !desk;
  const back = onBack ?? (noBack || sidebar ? null : () => (router.canGoBack() ? router.back() : router.replace(backTo)));
  const heading = (
    <>
      {mark}
      {kicker ? <Caption tone="muted">{kicker}</Caption> : null}
      {eyebrow ? (
        <Caption style={[styles.eyebrow, { color: eyebrowTone === 'accent' ? ds.accentText : ds.c.muted }]} numberOfLines={1}>
          {eyebrow.toUpperCase()}
        </Caption>
      ) : null}
      <Title role="heading">{title}</Title>
      {intro ? <Body tone="muted">{intro}</Body> : null}
    </>
  );
  // Signed out on the web (Support, Privacy, a link that leads nowhere), the page wears the website's nav and footer like every public page (ppl-support-desktop).
  if (Platform.OS === 'web' && !signedIn && !setupBar && !aside) {
    return (
      <PublicPage title={title}>
        <View style={[styles.readable, styles.publicColumn]}>
          {heading}
          {children}
        </View>
      </PublicPage>
    );
  }
  const page = (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{title}</title>
      </WebHead>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        // iOS: room for the keyboard, so the field being typed in stays above it and a list of results scrolls clear of it (E13, E38).
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingTop: sidebar && !setupBar ? frame.top : insets.top + layout.minTapTarget + space.xl + (setupBar ? space.sm : 0),
          paddingBottom: (pinned ? footerHeight : insets.bottom) + space.xxxl,
          paddingHorizontal: gutter,
        }}
      >
        <View style={[frame.column, styles.readable]}>
          {/* With the sidebar there's no Back row, so the action sits over the title. */}
          {action && sidebar ? <View style={styles.inline}>{action}</View> : null}
          {heading}
          {children}
          {footer && desk ? <View style={[styles.deskFooter, { borderTopColor: ds.c.line }]}>{footer}</View> : null}
        </View>
      </ScrollView>
      {setupBar ? (
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter, backgroundColor: ds.c.ground }]}>
          <View style={[frame.column, styles.topRow]}>
            {onBack ? <SetupBack onPress={onBack} label={desk ? 'Back' : undefined} /> : null}
            {topLabel && !progress ? <Caption tone="muted" style={styles.medium}>{topLabel}</Caption> : null}
            <View style={styles.flex}>{progress ? <StepProgress {...progress} wide={desk} /> : null}</View>
            {topRight}
          </View>
        </View>
      ) : back ? (
        <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
          <GlassButton accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'} icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} onPress={back} />
        </View>
      ) : null}
      {action && !sidebar && !setupBar ? <View style={[styles.action, { top: insets.top + space.sm, right: gutter }]}>{action}</View> : null}
      {pinned ? (
        <View
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          style={[styles.footer, { backgroundColor: ds.c.ground, paddingBottom: insets.bottom + space.lg, paddingHorizontal: gutter }]}
        >
          <View style={[frame.column, styles.footerColumn]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
  if (!aside || !frame.wide) return page;
  return (
    <View style={[styles.screen, styles.withAside, { backgroundColor: ds.c.ground }]}>
      {aside}
      {page}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  withAside: { flexDirection: 'row' },
  readable: { gap: space.md },
  // The board's 720 reading column, centred under the site nav.
  publicColumn: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: space.xxl },
  back: { position: 'absolute' },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  medium: { fontFamily: fontFamilies.bodyMedium },
  eyebrow: { fontFamily: fontFamilies.bodyMedium, letterSpacing: 0.6 },
  bareBack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minWidth: layout.minTapTarget, height: layout.minTapTarget, marginLeft: -space.sm - 2 },
  backWithLabel: { gap: space.xs, paddingRight: space.sm },
  segmentsWide: { flexGrow: 0, flexShrink: 0, flexBasis: 280, width: 280 },
  deskFooter: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.xl, paddingTop: space.xl, borderTopWidth: StyleSheet.hairlineWidth },
  // Opaque, so a long step scrolls under it rather than through it.
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: space.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  segments: { flex: 1, flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: space.xs, borderRadius: radius.mark },
  // No rule above it (canvas make-onboarding-*): the ground behind the buttons is enough.
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.lg },
  footerColumn: { gap: space.xs },
  action: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: space.sm },
  inline: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm },
});
