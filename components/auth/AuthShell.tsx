import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, Display, DsText, GlassButton, LogoImage, Title, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BRAND } from '@/constants/brand';
import { STATUS } from '@/constants/palette';
import { readableAccent, withAlpha } from '@/lib/color';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';

const LOGO = 88;

/** A venue's own name and logo, shown in place of the product name on its staff link. */
export interface AuthBrand {
  name: string;
  logoUrl: string | null;
}

interface AuthShellProps {
  title: string;
  /** A line, or a line with a highlighted part ("We sent a code to <email>"). */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  brand?: AuthBrand;
  /** Display (56) is the default; steps inside a flow, like the code step, use the title size (34). */
  titleSize?: 'display' | 'title';
  /** A round Back button above the title. */
  onBack?: () => void;
}

/**
 * The frame for signing in, signing up and the email-link screens: the
 * product (or venue) name, a big serif title, then the form, on the Back Bar
 * ground. Lifts above the keyboard on iOS and Android.
 */
export function AuthShell(props: AuthShellProps) {
  return (
    <BackbarTheme>
      <Frame {...props} />
    </BackbarTheme>
  );
}

function Frame({ title, subtitle, children, footer, brand, titleSize = 'display', onBack }: AuthShellProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.select({ ios: 'padding', android: 'height' })}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            // Top-aligned (canvas make-onboarding-signin*): a screen without Back starts its title where Back would end.
            { paddingHorizontal: gutter, paddingTop: insets.top + space.xxxl + space.sm + (onBack ? 0 : space.xxxl), paddingBottom: insets.bottom + space.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.column, { gap: titleSize === 'title' ? space.xl : space.xxl }]}>
            {onBack ? (
              <View style={styles.back}>
                <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={onBack} />
              </View>
            ) : null}
            <View style={styles.head}>
              {brand?.logoUrl ? (
                <LogoImage uri={brand.logoUrl} size={LOGO} radius={radius.card} style={styles.logo} label={`${brand.name} logo`} />
              ) : brand ? (
                <View style={[styles.logo, styles.mark, { borderColor: ds.accentText }]} role="img" aria-label={`${brand.name} logo`}>
                  <DsText variant="title" italic color={ds.accentText}>
                    {initials(brand.name)}
                  </DsText>
                </View>
              ) : null}
              {/* The product (or venue) name heads the first screen; the steps after it go straight to their title. */}
              {titleSize === 'display' ? (
                <Caption tone="accent" style={styles.eyebrow}>
                  {brand?.name ?? BRAND.productName}
                </Caption>
              ) : null}
              {titleSize === 'title' ? <Title>{title}</Title> : <Display>{title}</Display>}
              {subtitle ? <Body tone="muted">{subtitle}</Body> : null}
            </View>
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** "Little Rye" -> "LR": the first letters of the first two words. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '·';
}

/** A form-level message under the fields. Errors say what went wrong and how to fix it. */
export function AuthMessage({ tone, children }: { tone: 'error' | 'info'; children: string }) {
  const ds = useDs();
  // An error sits in a box tinted the status red (canvas make-onboarding-signin-code-wrong).
  const red = readableAccent(STATUS.danger, ds.c.ground);
  const color = tone === 'error' ? red : ds.c.muted;
  return (
    <View style={[styles.message, tone === 'error' && [styles.errorBox, { backgroundColor: withAlpha(red, 0.12) }]]} role={tone === 'error' ? 'alert' : 'status'}>
      <IconSymbol name={tone === 'error' ? 'exclamationmark.circle' : 'info.circle'} size={18} color={color} />
      <Caption color={tone === 'error' ? ds.c.ink : color} style={styles.messageText}>
        {children}
      </Caption>
    </View>
  );
}

/** A quiet text link: "No account? Create one". `muted` for the quietest ones. */
export function AuthLink({ href, label, lead, muted }: { href: Href; label: string; lead?: string; muted?: boolean }) {
  return (
    <View style={styles.linkRow}>
      {lead ? <Body tone="muted">{lead}</Body> : null}
      <Link href={href} asChild>
        <Pressable role="link" hitSlop={space.sm} style={styles.link}>
          <Body tone={muted ? 'muted' : 'ink'} style={styles.linkText}>
            {label}
          </Body>
        </Pressable>
      </Link>
    </View>
  );
}

/** Waiting on something (an email link, the session). */
export function AuthSpinner({ label }: { label?: string }) {
  const ds = useDs();
  return (
    <View style={styles.spinner} role="progressbar" aria-label={label ?? 'Loading'}>
      <ActivityIndicator color={ds.c.muted} />
      {label ? <Caption tone="muted">{label}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  column: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  back: { alignSelf: 'flex-start' },
  head: { gap: space.sm },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.card, marginBottom: space.md },
  mark: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.pill, width: 64, height: 64 },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamilies.bodyMedium },
  body: { gap: space.lg },
  footer: { alignItems: 'center', gap: space.xs },
  message: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  messageText: { flex: 1, paddingTop: 1 },
  errorBox: { paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.control },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: space.xs },
  link: { minHeight: layout.minTapTarget, justifyContent: 'center' },
  linkText: { fontFamily: fontFamilies.bodyMedium },
  spinner: { alignItems: 'center', gap: space.md, paddingVertical: space.lg },
});
