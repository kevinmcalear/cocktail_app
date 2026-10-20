import type { ReactNode } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { Profile } from '@/hooks/useProfiles';
import { BAR_CLAIM_METHODS, METHOD_COPY, OUR_INSTAGRAM, REVIEW_REASON, claimPlace, emailCheck, emailUnavailable, pageInstagram, spacedCode, type BarClaimMethod } from '@/lib/claimVerification';
import { instagramUrl } from '@/lib/profiles';

export interface MethodDetail {
  available: boolean;
  detail: string;
  instant: boolean;
}

/** Each way of checking, with whether it works for this page and this person, in words. */
export function methodDetails(profile: Profile, email: string | null | undefined): Record<BarClaimMethod, MethodDetail> {
  const check = emailCheck(email, profile.website, profile.is_closed);
  const place = claimPlace(profile.kind);
  const handle = pageInstagram(profile);
  return {
    email: {
      available: check.ok !== false,
      detail:
        check.ok === 'instant'
          ? `You signed in with an address at ${check.domain}, the ${place}’s own website.`
          : check.ok === 'review'
            ? `You signed in at ${check.domain}. A moderator checks it, because ${REVIEW_REASON[check.reason]}.`
            : emailUnavailable(check),
      instant: check.ok === 'instant',
    },
    instagram: {
      available: !!handle,
      detail: handle
        ? `Send this code to ${OUR_INSTAGRAM ? `@${OUR_INSTAGRAM}` : 'us'} in a message from @${handle}. A person checks, usually within a day.`
        : 'This page has no Instagram to check.',
      instant: false,
    },
    phone: {
      available: true,
      detail: `We ring the number on ${profile.display_name}’s page, not one you give us, and ask for a six-digit code.`,
      instant: false,
    },
  };
}

const ICONS: Record<BarClaimMethod, IconName> = { email: 'envelope', instagram: 'paperplane.fill', phone: 'phone' };

/** How fast each way is, as the pill on its card. */
function speed(method: BarClaimMethod, d: MethodDetail): string | null {
  if (method === 'email') return d.instant ? 'Instant' : null;
  if (method === 'instagram') return 'About a day';
  return 'Slowest';
}

/**
 * The ways to prove a bar is yours, as cards (canvas make-venue-claim), with
 * the six-digit code shown inside the Instagram card before anything is
 * sent (b19), then Open Instagram and Copy code.
 */
export function ClaimMethods({
  profile,
  details,
  method,
  code,
  disabled,
  onPick,
}: {
  profile: Profile;
  details: Record<BarClaimMethod, MethodDetail>;
  method: BarClaimMethod;
  code: string;
  disabled?: boolean;
  onPick: (m: BarClaimMethod) => void;
}) {
  const handle = pageInstagram(profile);
  // ponytail: copying needs expo-clipboard on phones (a store build); the web copies, phones select the digits.
  const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;
  return (
    <>
      <View role="radiogroup" accessibilityLabel={`How we check it’s your ${claimPlace(profile.kind)}`} style={styles.cards}>
        {BAR_CLAIM_METHODS.map((m) => {
          const d = details[m];
          const on = method === m;
          const pill = speed(m, d);
          const label = m === 'phone' ? `A call to the ${claimPlace(profile.kind)}` : METHOD_COPY[m].label;
          return (
            <MethodCard key={m} icon={ICONS[m]} label={label} pill={pill} detail={d.detail} on={on} available={d.available} disabled={disabled} onPress={() => onPick(m)}>
              {on && m !== 'email' ? (
                <ClaimCode
                  code={code}
                  note={
                    m === 'instagram'
                      ? `Send it from the bar’s own account, not a personal one. Whoever runs @${handle} can send it. Nothing to edit or take down after.`
                      : 'Whoever answers reads us this code, so leave it with the team.'
                  }
                />
              ) : null}
            </MethodCard>
          );
        })}
      </View>
      {method === 'instagram' && handle ? (
        <View style={styles.buttons}>
          <Button label="Open Instagram" variant="secondary" icon="link" onPress={() => Linking.openURL(OUR_INSTAGRAM ? instagramUrl(OUR_INSTAGRAM) : 'https://www.instagram.com/direct/inbox/')} />
          {canCopy ? <Button label="Copy code" variant="secondary" icon="doc.on.doc" onPress={() => void navigator.clipboard.writeText(code)} /> : null}
        </View>
      ) : null}
    </>
  );
}

/**
 * One way of checking a claim, as a radio card (canvas make-venue-claim):
 * a dot, its icon, its name and how fast it is, what it means, and anything
 * it shows once picked (the code) under it. A way that can't be used is greyed.
 */
export function MethodCard({
  icon,
  label,
  pill,
  detail,
  on,
  available,
  disabled,
  onPress,
  children,
}: {
  icon: IconName;
  label: string;
  pill: string | null;
  detail: string;
  on: boolean;
  available: boolean;
  disabled?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  const ds = useDs();
  return (
    <View style={[styles.card, { borderColor: on ? ds.accentText : ds.c.line, backgroundColor: on ? ds.c.raised : ds.c.surface }, !available && styles.off]}>
      <PressableScale role="radio" aria-checked={on} aria-disabled={!available || disabled} disabled={!available || disabled} accessibilityLabel={`${label}. ${detail}`} onPress={onPress} style={styles.choice}>
        <View style={[styles.dot, { borderColor: on ? ds.accentText : ds.c.lineStrong, borderWidth: on ? 7 : 2 }]} />
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <IconSymbol name={icon} size={16} color={ds.c.muted} />
            <DsText variant="body" style={[styles.shrink, styles.strong]}>
              {label}
              {pill ? <Caption tone="muted" style={styles.medium}>{`  ${pill}`}</Caption> : null}
            </DsText>
          </View>
          <Caption tone="muted">{detail}</Caption>
        </View>
      </PressableScale>
      {children}
    </View>
  );
}

/** "YOUR CODE 615 204" in mono, under the way it goes with, and what to do with it. */
export function ClaimCode({ code, note }: { code: string; note: string }) {
  const ds = useDs();
  return (
    <View style={[styles.code, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.surface }]}>
      <Caption tone="muted" style={styles.eyebrow}>
        YOUR CODE
      </Caption>
      <DsText variant="title" selectable style={styles.digits} accessibilityLabel={`Your code: ${code.split('').join(' ')}`}>
        {spacedCode(code)}
      </DsText>
      <Caption tone="muted">{note}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { gap: space.sm },
  card: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1 },
  off: { opacity: 0.55 },
  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg },
  dot: { width: 22, height: 22, borderRadius: radius.pill, marginTop: 1 },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  shrink: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  medium: { fontFamily: fontFamilies.bodyMedium },
  // The code in mono, left under the way it goes with (canvas make-venue-claim).
  code: { marginLeft: space.lg + 22 + space.md, marginRight: space.lg, marginBottom: space.lg, padding: space.md, gap: space.sm, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.control },
  eyebrow: { letterSpacing: 1.2, fontFamily: fontFamilies.bodyMedium },
  digits: { fontFamily: fontFamilies.monoMedium, fontVariant: ['tabular-nums'], letterSpacing: 2 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
