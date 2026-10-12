import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { usePageFrame } from '@/components/nav/PageFrame';
import { useAuth } from '@/ctx/AuthContext';
import { WebHead } from '@/components/WebHead';
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
  /** A small line above the title in the accent: the venue's name, "Last step". */
  eyebrow?: string | null;
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
export function StepProgress({ at, of, label, name = 'Setup' }: StepProgressValue) {
  const ds = useDs();
  return (
    <View style={styles.progressRow}>
      <View role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={of} aria-valuenow={at} style={styles.segments}>
        {Array.from({ length: of }, (_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < at ? ds.accentFill.fill : ds.c.raised }]} />
        ))}
      </View>
      {label ? <Caption tone="muted" style={styles.strong}>{label}</Caption> : null}
    </View>
  );
}

function Page({ title, intro, kicker, eyebrow, children, noBack, backTo = '/settings', action, onBack, progress, topRight, footer, aside }: SafetyPageProps) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  // Wide web: the page sits left beside the sidebar, which is the way around, so no Back.
  // Signed out (Support, a link opened cold) there is no sidebar, so Back stays.
  const frame = usePageFrame('text');
  const signedIn = !!useAuth().user;
  const sidebar = frame.wide && signedIn && !onBack;
  const [footerHeight, setFooterHeight] = useState(0);
  // A setup step: Back, the bar and "Later" share one row at the top.
  const setupBar = !!(onBack || progress || topRight);
  const back = onBack ?? (noBack || sidebar ? null : () => (router.canGoBack() ? router.back() : router.replace(backTo)));
  const page = (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{title}</title>
      </WebHead>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: sidebar && !setupBar ? frame.top : insets.top + layout.minTapTarget + space.xl + (setupBar ? space.sm : 0),
          paddingBottom: (footer ? footerHeight : insets.bottom) + space.xxxl,
          paddingHorizontal: gutter,
        }}
      >
        <View style={[frame.column, styles.readable]}>
          {/* With the sidebar there's no Back row, so the action sits over the title. */}
          {action && sidebar ? <View style={styles.inline}>{action}</View> : null}
          {kicker ? <Caption tone="muted">{kicker}</Caption> : null}
          {eyebrow ? (
            <Caption style={[styles.strong, { color: ds.accentText }]} numberOfLines={1}>
              {eyebrow}
            </Caption>
          ) : null}
          <Title role="heading">{title}</Title>
          {intro ? <Body tone="muted">{intro}</Body> : null}
          {children}
        </View>
      </ScrollView>
      {setupBar ? (
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter, backgroundColor: ds.c.ground }]}>
          <View style={[frame.column, styles.topRow]}>
            {onBack ? <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={onBack} /> : null}
            <View style={styles.flex}>{progress ? <StepProgress {...progress} /> : null}</View>
            {topRight}
          </View>
        </View>
      ) : back ? (
        <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
          <GlassButton accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'} icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} onPress={back} />
        </View>
      ) : null}
      {action && !sidebar && !setupBar ? <View style={[styles.action, { top: insets.top + space.sm, right: gutter }]}>{action}</View> : null}
      {footer ? (
        <View
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          style={[styles.footer, { backgroundColor: ds.c.ground, borderTopColor: ds.c.line, paddingBottom: insets.bottom + space.lg, paddingHorizontal: gutter }]}
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
  back: { position: 'absolute' },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  // Opaque, so a long step scrolls under it rather than through it.
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: space.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  segments: { flex: 1, flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: space.xs, borderRadius: radius.mark },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  footerColumn: { gap: space.xs },
  action: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: space.sm },
  inline: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm },
});
