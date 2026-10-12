import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, PressableScale, Tag, useDs, type IconName } from '@/components/ds';
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

const ICONS: Record<BarClaimMethod, IconName> = { email: 'envelope', instagram: 'paperplane.fill', phone: 'building.2' };

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
  const ds = useDs();
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
            <View key={m} style={[styles.card, { borderColor: on ? ds.accentText : ds.c.line, borderWidth: on ? 2 : 1, backgroundColor: ds.c.raised }, !d.available && styles.off]}>
              <PressableScale role="radio" aria-checked={on} aria-disabled={!d.available || disabled} disabled={!d.available || disabled} accessibilityLabel={`${label}. ${d.detail}`} onPress={() => onPick(m)} style={styles.choice}>
                <View style={[styles.dot, { borderColor: on ? ds.accentText : ds.c.lineStrong, borderWidth: on ? 7 : 2 }]} />
                <View style={styles.flex}>
                  <View style={styles.titleRow}>
                    <IconSymbol name={ICONS[m]} size={16} color={ds.c.ink} />
                    <DsText variant="headline" style={styles.shrink}>{label}</DsText>
                  </View>
                  {pill ? <Tag label={pill} tone={m === 'email' ? 'success' : 'default'} style={styles.pill} /> : null}
                  <Caption tone="muted">{d.detail}</Caption>
                </View>
              </PressableScale>
              {on && m !== 'email' ? (
                <View style={[styles.code, { borderColor: ds.c.lineStrong }]}>
                  <Caption tone="muted" style={styles.eyebrow}>
                    YOUR CODE
                  </Caption>
                  <DsText variant="display" selectable style={styles.digits} accessibilityLabel={`Your code: ${code.split('').join(' ')}`}>
                    {spacedCode(code)}
                  </DsText>
                  <Caption tone="muted">
                    {m === 'instagram'
                      ? `Send it from the bar’s own account, not a personal one. Whoever runs @${handle} can send it. Nothing to edit or take down after.`
                      : 'Whoever answers reads us this code, so leave it with the team.'}
                  </Caption>
                </View>
              ) : null}
            </View>
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

const styles = StyleSheet.create({
  cards: { gap: space.sm },
  card: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  off: { opacity: 0.55 },
  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg },
  dot: { width: 22, height: 22, borderRadius: radius.pill, marginTop: 1 },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  shrink: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: { alignSelf: 'flex-start' },
  code: { marginHorizontal: space.lg, marginBottom: space.lg, padding: space.lg, gap: space.xs, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.control, alignItems: 'center' },
  eyebrow: { letterSpacing: 1.2, fontFamily: fontFamilies.bodySemiBold },
  digits: { fontVariant: ['tabular-nums'], letterSpacing: 2 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
