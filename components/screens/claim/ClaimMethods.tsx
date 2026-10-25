import type { ReactNode } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Field, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { Profile } from '@/hooks/useProfiles';
import {
  BAR_CLAIM_METHODS,
  methodLabel,
  OUR_INSTAGRAM,
  REVIEW_REASON,
  claimPlace,
  emailCheck,
  emailUnavailable,
  pageInstagram,
  spacedCode,
  typedHandle,
  typedPhone,
  typedWebsite,
  type BarClaimMethod,
  type TypedDetails,
} from '@/lib/claimVerification';
import { instagramUrl } from '@/lib/profiles';

export interface MethodDetail {
  /** Ready to send: the page has what this way needs, or a good one was typed. */
  available: boolean;
  detail: string;
  instant: boolean;
  /** What the page is missing for this way, so the card asks for it (canvas make-venue-claim, states 2 to 4). */
  ask: { field: keyof TypedDetails; label: string; placeholder: string; hint: string; keyboard: 'default' | 'url' | 'phone-pad' } | null;
}

/**
 * Each way of checking, with whether it works for this page and this person,
 * in words. Where the page has no Instagram, website or phone, the way asks
 * for it; anything typed is checked by a person, never instant (20261031200000).
 */
export function methodDetails(profile: Profile, email: string | null | undefined, typed: TypedDetails = {}, pagePhone: string | null = null): Record<BarClaimMethod, MethodDetail> {
  const place = claimPlace(profile.kind);
  const name = profile.display_name;
  const pageHandle = pageInstagram(profile);
  const handle = pageHandle ?? typedHandle(typed.instagram);
  const site = profile.website || typedWebsite(typed.website);
  const check = emailCheck(email, site, profile.is_closed);
  const phone = pagePhone || typedPhone(typed.phone);
  const to = OUR_INSTAGRAM ? `@${OUR_INSTAGRAM}` : 'us';
  return {
    email: {
      available: check.ok !== false,
      detail: !site
        ? `Add the ${place}’s website to use this.`
        : check.ok === false
          ? emailUnavailable(check)
          : !profile.website
            ? `Your sign-in email is at ${check.domain}. A person checks the site is the ${place}’s, because you added it.`
            : check.ok === 'instant'
              ? `You signed in with an address at ${check.domain}, the ${place}’s own website.`
              : `You signed in at ${check.domain}. A moderator checks it, because ${REVIEW_REASON[check.reason]}.`,
      instant: check.ok === 'instant' && !!profile.website,
      ask: profile.website ? null : { field: 'website', label: `The ${place}’s website`, placeholder: 'harbourroom.com', hint: 'Only a website already on the page is instant.', keyboard: 'url' },
    },
    instagram: {
      available: !!handle,
      detail: !handle
        ? `Add the ${place}’s Instagram to use this.`
        : pageHandle
          ? `Send this code to ${to} in a message from @${handle}. A person checks, usually within a day.`
          : `Send this code to ${to} in a message from @${handle}. A person checks it’s ${name}’s own account, usually within a day.`,
      instant: false,
      ask: pageHandle ? null : { field: 'instagram', label: `The ${place}’s Instagram`, placeholder: '@harbourroom', hint: 'Its own account, not a personal one.', keyboard: 'default' },
    },
    phone: {
      available: !!phone,
      detail: pagePhone
        ? `We ring the number on ${name}’s page, not one you give us, and ask for a six-digit code.`
        : phone
          ? `A person checks this is the ${place}’s listed number, then rings it and asks for a six-digit code.`
          : `Add the ${place}’s phone number to use this.`,
      instant: false,
      ask: pagePhone ? null : { field: 'phone', label: `The ${place}’s phone number`, placeholder: '(555) 010-8823', hint: `The ${place}’s own line, not your mobile.`, keyboard: 'phone-pad' },
    },
  };
}

const ICONS: Record<BarClaimMethod, IconName> = { email: 'envelope', instagram: 'paperplane.fill', phone: 'phone' };

/** How fast each way is, as the pill on its card. */
function speed(method: BarClaimMethod, d: MethodDetail): string | null {
  if (method === 'email') return d.instant ? 'Instant' : 'About a day';
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
  typed,
  disabled,
  onPick,
  onType,
}: {
  profile: Profile;
  details: Record<BarClaimMethod, MethodDetail>;
  method: BarClaimMethod;
  code: string;
  /** What they typed where the page has nothing. */
  typed: TypedDetails;
  disabled?: boolean;
  onPick: (m: BarClaimMethod) => void;
  onType: (typed: TypedDetails) => void;
}) {
  const pageHandle = pageInstagram(profile);
  const handle = pageHandle ?? typedHandle(typed.instagram);
  // ponytail: copying needs expo-clipboard on phones (a store build); the web copies, phones select the digits.
  const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;
  return (
    <>
      <View role="radiogroup" accessibilityLabel={`How we check it’s your ${claimPlace(profile.kind)}`} style={styles.cards}>
        {BAR_CLAIM_METHODS.map((m) => {
          const d = details[m];
          const on = method === m;
          const pill = speed(m, d);
          const label = methodLabel(m, profile.kind);
          return (
            <MethodCard key={m} icon={ICONS[m]} label={label} pill={pill} detail={d.detail} on={on} available={d.available || !!d.ask} disabled={disabled} onPress={() => onPick(m)}>
              {on && d.ask ? (
                <View style={styles.ask}>
                  <Field
                    label={d.ask.label}
                    value={typed[d.ask.field] ?? ''}
                    onChangeText={(t) => onType({ ...typed, [d.ask!.field]: t })}
                    placeholder={d.ask.placeholder}
                    hint={d.ask.hint}
                    keyboardType={d.ask.keyboard}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    maxLength={300}
                    editable={!disabled}
                  />
                </View>
              ) : null}
              {on && m !== 'email' && d.available ? (
                <ClaimCode
                  code={code}
                  note={
                    m === 'phone'
                      ? 'Whoever answers reads us this code, so leave it with the team.'
                      : pageHandle
                        ? `Send it from the ${claimPlace(profile.kind)}’s own account, not a personal one. Whoever runs @${handle} can send it. Nothing to edit or take down after.`
                        : `Send it from @${handle}. Nothing to edit or take down after.`
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
  // What the page is missing, typed under the way that needs it, lined up with the code.
  ask: { marginLeft: space.lg + 22 + space.md, marginRight: space.lg, marginBottom: space.lg },
  // The code in mono, left under the way it goes with (canvas make-venue-claim).
  code: { marginLeft: space.lg + 22 + space.md, marginRight: space.lg, marginBottom: space.lg, padding: space.md, gap: space.sm, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.control },
  eyebrow: { letterSpacing: 1.2, fontFamily: fontFamilies.bodyMedium },
  digits: { fontFamily: fontFamilies.monoMedium, fontVariant: ['tabular-nums'], letterSpacing: 2 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
