import { useRouter, type Href } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, DsText, GlassButton, Surface, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { usePendingClaims, useReviewClaim, type ClaimForReview, type ClaimReview } from '@/hooks/useProfiles';

import { BarClaimCard } from './BarClaimReview';

/** Review errors in words. The database's own messages (P0001) are already written for people. */
function reviewError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === '23505') return 'They already have a profile of their own, so this one can\'t be handed over. Turn it down, or merge the two profiles first.';
  if (e?.code === 'P0001' || e instanceof Error) return e?.message ?? '';
  return "Couldn't save that. Check your connection and try again.";
}

/**
 * Moderators' list of pending profile claims, oldest first: approve hands the
 * profile over (and turns down other claims on it), or turn it down with a
 * reason. A bar claim shows the page's contact details beside what the
 * claimant gave, and the check for how they chose to prove it. Work-email
 * claims that match the bar's own site never land here: they're approved on
 * the spot.
 * ponytail: a plain list; no search, history or undo until claims pile up.
 */
export function ClaimsReview() {
  return (
    <BackbarTheme>
      <ClaimsPage />
    </BackbarTheme>
  );
}

function ClaimsPage() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { data: claims, isLoading, error } = usePendingClaims();
  const review = useReviewClaim();

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Profile claims</title>
      </WebHead>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.readable}>
          <Title>Profile claims</Title>
          <Body tone="muted">People asking to take over a profile. Check what they gave against the page before you approve. A bar’s page starts Locked.</Body>
          {review.error ? (
            <Caption tone="accent" role="alert">
              {reviewError(review.error)}
            </Caption>
          ) : null}
          {isLoading ? <Caption tone="muted">Loading claims…</Caption> : null}
          {error ? <Body tone="muted">Couldn’t load claims. Check your connection and try again.</Body> : null}
          {claims && !claims.length ? <Body tone="muted">No claims waiting. Only moderators see other people’s claims here.</Body> : null}
          <View role="list" style={styles.list}>
            {claims?.map((c) => {
              const Card = c.method === 'note' ? ClaimCard : BarClaimCard;
              return (
                <Card
                  key={c.id}
                  claim={c}
                  busy={review.isPending}
                  onOpen={() => c.profile && router.push(`/p/${c.profile.id}` as Href)}
                  onReview={(r) => review.mutate(r)}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel="Back"
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

function ClaimCard({ claim, busy, onOpen, onReview }: { claim: ClaimForReview; busy: boolean; onOpen: () => void; onReview: (review: ClaimReview) => void }) {
  const who = claim.claimant ? `${claim.claimant.display_name} (@${claim.claimant.handle})` : 'Someone without a profile yet';
  const target = claim.profile ? `${claim.profile.display_name} (@${claim.profile.handle})` : 'a profile';
  const onBehalf = claim.bar_id ? ` for ${claim.bar?.name ?? 'their venue'}` : '';
  return (
    <Surface style={styles.card}>
      <View role="listitem" style={styles.cardBody}>
        <Caption tone="muted">{new Date(claim.created_at).toLocaleDateString()}</Caption>
        <Body>
          {`${who} wants to claim `}
          <DsText role="link" style={styles.link} onPress={onOpen}>
            {target}
          </DsText>
          {`${onBehalf}.`}
        </Body>
        <Body tone="muted">{claim.message ? `"${claim.message}"` : 'No note.'}</Body>
        <View style={styles.actions}>
          <Button label="Approve" disabled={busy} accessibilityHint={`Hands ${target} over`} onPress={() => onReview({ claimId: claim.id, approve: true })} />
          <Button label="Turn down" variant="secondary" disabled={busy} onPress={() => onReview({ claimId: claim.id, approve: false })} />
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 960, alignSelf: 'center', gap: space.md },
  controls: { position: 'absolute' },
  list: { gap: space.md, marginTop: space.md },
  card: { gap: space.sm },
  cardBody: { gap: space.sm },
  link: { textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
