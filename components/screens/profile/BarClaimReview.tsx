import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Field, Headline, Spec, Surface, Tag, useBreakpoint, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { ClaimForReview, ClaimReview } from '@/hooks/useProfiles';
import { METHOD_COPY, REVIEW_REASON, pageInstagram, siteHost, spacedCode, type BarClaimMethod } from '@/lib/claimVerification';
import { instagramUrl } from '@/lib/profiles';

/** One fact, label over value. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fact}>
      <Caption tone="muted">{label}</Caption>
      {typeof children === 'string' ? <Body>{children}</Body> : children}
    </View>
  );
}

function Link({ label, href }: { label: string; href: string }) {
  return (
    <DsText role="link" style={styles.link} onPress={() => Linking.openURL(href)}>
      {label}
    </DsText>
  );
}

/** A column of evidence: what the page says, or what the claimant gave. */
function Column({ title, wide, children }: { title: string; wide: boolean; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.column, wide && styles.flex, { borderColor: ds.c.line }]}>
      <Caption tone="muted" style={styles.eyebrow}>
        {title}
      </Caption>
      {children}
    </View>
  );
}

/** What the moderator does to check this method, in words. */
function checkText(claim: ClaimForReview, handle: string | null): string {
  const e = claim.evidence;
  if (claim.method === 'instagram') return `Open @${handle} and look for ${spacedCode(claim.code ?? '')} in the bio. Approve once it’s there.`;
  if (claim.method === 'phone') {
    return 'Ring the bar on a number you find yourself (its website or map listing), never one they give you. Ask for whoever they named and have them read out the code.';
  }
  const reason = e?.review_reason ? REVIEW_REASON[e.review_reason] : 'it needs a second look';
  return `Their sign-in email is at ${e?.email_domain}, the website’s domain, but ${reason}. Check the bar itself uses that domain (its contact page, say) before you approve.`;
}

/**
 * A bar claim in the moderators' queue: the page's own contact details on
 * one side, what the claimant gave on the other, then the check for its
 * method. A phone claim can only be approved with the code the bar read out.
 */
export function BarClaimCard({ claim, busy, onOpen, onReview }: { claim: ClaimForReview; busy: boolean; onOpen: () => void; onReview: (review: ClaimReview) => void }) {
  const wide = useBreakpoint() !== 'phone';
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const page = claim.profile;
  const method = claim.method as BarClaimMethod;
  const handle = (page && pageInstagram(page)) ?? claim.evidence?.instagram ?? null;
  const host = siteHost(page?.website);
  const place = [page?.locality, page?.city, page?.country_code].filter(Boolean).join(', ');
  const name = page?.display_name ?? 'this bar';
  const mapSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, page?.city].filter(Boolean).join(' '))}`;
  const codeReady = method !== 'phone' || code.replace(/\D/g, '').length === 6;

  return (
    <Surface style={styles.card}>
      <View role="listitem" style={styles.body}>
        <View style={styles.titleRow}>
          <Headline role="heading">
            <DsText variant="headline" role="link" style={styles.link} onPress={onOpen}>
              {name}
            </DsText>
          </Headline>
          <Tag label={METHOD_COPY[method]?.short ?? 'Note'} tone="accent" />
          {page?.is_closed ? <Tag label="Closed" /> : null}
        </View>
        <Caption tone="muted">
          {`${new Date(claim.created_at).toLocaleDateString()} · ${claim.bar ? `links their venue ${claim.bar.name}` : 'makes a new venue'}`}
        </Caption>

        <View style={[styles.columns, wide && styles.columnsWide]}>
          <Column title="On the page" wide={wide}>
            <Fact label="Website">{host ? <Link label={host} href={page!.website!} /> : 'None'}</Fact>
            <Fact label="Instagram">{handle ? <Link label={`@${handle}`} href={instagramUrl(handle)} /> : 'None'}</Fact>
            {place ? <Fact label="Where">{place}</Fact> : null}
            <Fact label="Phone">
              <Link label="Find its number" href={mapSearch} />
            </Fact>
          </Column>
          <Column title="From them" wide={wide}>
            <Fact label="Who">{claim.claimant ? `${claim.claimant.display_name} (@${claim.claimant.handle})` : 'No profile of their own yet'}</Fact>
            <Fact label="Note">{claim.message ? `“${claim.message}”` : 'No note'}</Fact>
            {method === 'email' ? <Fact label="Sign-in email">{`At ${claim.evidence?.email_domain ?? 'an unknown domain'}`}</Fact> : null}
            {method === 'instagram' && claim.code ? (
              <Fact label="Their code">
                <Spec>{spacedCode(claim.code)}</Spec>
              </Fact>
            ) : null}
            {method === 'phone' ? <Fact label="Their code">They have six digits to read out.</Fact> : null}
          </Column>
        </View>

        <Body>{checkText(claim, handle)}</Body>
        {method === 'instagram' && handle ? (
          <Button label={`Open @${handle}`} variant="secondary" icon="link" onPress={() => Linking.openURL(instagramUrl(handle))} style={styles.hug} />
        ) : null}
        {method === 'phone' ? (
          <Field label="Code they read out" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={7} autoComplete="off" />
        ) : null}
        <Field label="Reason, if you turn it down" hint="They’ll see this." value={reason} onChangeText={setReason} maxLength={300} />
        <View style={styles.actions}>
          <Button
            label="Approve"
            disabled={busy || !codeReady}
            accessibilityHint={`Hands ${name} over, Locked`}
            onPress={() => onReview({ claimId: claim.id, approve: true, code: method === 'phone' ? code : undefined })}
          />
          <Button label="Turn down" variant="secondary" disabled={busy} onPress={() => onReview({ claimId: claim.id, approve: false, reason })} />
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  body: { gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  columns: { gap: space.md },
  columnsWide: { flexDirection: 'row', alignItems: 'stretch' },
  flex: { flex: 1 },
  column: { gap: space.sm, padding: space.md, borderWidth: 1, borderRadius: radius.control, borderCurve: 'continuous' },
  eyebrow: { letterSpacing: 1.2, textTransform: 'uppercase' },
  fact: { gap: space.xs },
  link: { textDecorationLine: 'underline' },
  hug: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
