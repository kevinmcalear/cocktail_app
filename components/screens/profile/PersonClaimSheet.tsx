import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Sheet, SheetScrollView, Title, sheetIsDialog, useBreakpoint, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useClaimProfile, type Profile } from '@/hooks/useProfiles';
import { newClaimCode, OUR_INSTAGRAM, pageInstagram, type PersonClaimMethod } from '@/lib/claimVerification';
import { plural } from '@/lib/menus';
import { needsOnboarding } from '@/lib/onboarding';

import { ClaimCode, MethodCard } from '../claim/ClaimMethods';
import { ClaimOnYourPhone } from './ClaimOnYourPhone';

/** Postgres errors from a person's claim, in words. */
export function personClaimError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') return 'You already have a claim waiting on this profile.';
  // start_person_claim's own refusals (and 42501 for signed out, 22023 for a bad code) are written for people.
  if ((code === 'P0001' || code === '42501' || code === '22023') && (error as { message?: string }).message) return (error as { message: string }).message;
  return "Couldn't send your claim. Check your connection and try again.";
}

/**
 * "Claim Ash Okafor" (find-yourself step 4): one sheet, pick how we check,
 * send (start_person_claim). A code messaged from the page's Instagram comes
 * first when the page has one; "Something else" is a note a person checks;
 * "<bar> confirms you" waits for the bar to be claimed. Someone who already
 * has a page gets this one merged into theirs when it's approved.
 * From Setup, a sent claim goes back to Setup's "Claim sent".
 * On a computer, "Not your computer?" sits beside it with a QR code for their
 * own phone; on a phone, "Not your phone? Claim it on yours" shows that below.
 */
export function PersonClaimSheet({ profile, bar, stats, visible, onClose }: { profile: Profile; bar: string | null; stats: { drinks: number; menus: number }; visible: boolean; onClose: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const { user } = useAuth();
  const breakpoint = useBreakpoint();
  const wide = sheetIsDialog && breakpoint !== 'phone';
  const [elsewhere, setElsewhere] = useState(false);
  const claim = useClaimProfile();
  const [note, setNote] = useState('');
  const handle = pageInstagram(profile);
  const [method, setMethod] = useState<PersonClaimMethod>(handle ? 'instagram' : 'note');
  // Made before sending, so the sheet can show it first (as a bar's claim does).
  const [code] = useState(newClaimCode);
  const moves = [stats.drinks ? plural(stats.drinks, 'drink') : null, stats.menus ? plural(stats.menus, 'menu') : null, 'where you have worked'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const send = () =>
    claim.mutate(
      { profile_id: profile.id, message: note, method, code: method === 'instagram' ? code : null },
      {
        onSuccess: () => {
          onClose();
          if (needsOnboarding(user?.user_metadata)) router.dismissTo('/onboarding');
        },
      }
    );
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={`Claim ${profile.display_name}`} keyboard style={wide ? styles.wide : null}>
      <SheetScrollView contentContainerStyle={[styles.body, wide ? styles.row : null]} keyboardShouldPersistTaps="handled">
        <View style={[styles.claim, wide ? styles.flex : null]}>
          <View style={styles.head}>
            <Title>{`Claim ${profile.display_name}`}</Title>
            <Body tone="muted">{`${stats.drinks || stats.menus ? `Your ${moves} move` : 'Where you have worked moves'} to your account. Nothing new goes public.`}</Body>
          </View>
          <View role="radiogroup" accessibilityLabel="How we check it’s you" style={styles.cards}>
            <MethodCard
              icon="paperplane.fill"
              label="A message from your Instagram"
              pill="About a day"
              detail={handle ? `Send a code to ${OUR_INSTAGRAM ? `@${OUR_INSTAGRAM}` : 'us'} from @${handle}, the handle on this page.` : 'This page has no Instagram to check.'}
              on={method === 'instagram'}
              available={!!handle}
              disabled={claim.isPending}
              onPress={() => setMethod('instagram')}
            >
              {method === 'instagram' ? <ClaimCode code={code} note={`Send it in a message from @${handle} once you've sent the claim. A person checks it.`} /> : null}
            </MethodCard>
            <MethodCard icon="checkmark" label={`${bar ?? 'The bar'} confirms you`} pill="Same day" detail={`Once ${bar ?? 'the bar'} is claimed, its Admin confirms you with one tap.`} on={false} available={false} onPress={() => {}} />
            <MethodCard icon="link" label="Something else" pill="A day or two" detail="A link that shows it is you, like a staff page or a press piece. A person checks." on={method === 'note'} available disabled={claim.isPending} onPress={() => setMethod('note')}>
              {method === 'note' ? (
                <View style={styles.note}>
                  <Field label="The link, or how we can check" value={note} onChangeText={setNote} multiline maxLength={1000} autoCorrect={false} />
                </View>
              ) : null}
            </MethodCard>
          </View>
          {claim.error ? (
            <Caption tone="accent" role="alert">
              {personClaimError(claim.error)}
            </Caption>
          ) : null}
          {wide ? (
            <View style={styles.actions}>
              <Button label={claim.isPending ? 'Sending…' : 'Send claim'} size="lg" disabled={claim.isPending} onPress={send} />
              <Button label="Cancel" variant="ghost" onPress={onClose} />
            </View>
          ) : (
            <View style={styles.stacked}>
              <Button label={claim.isPending ? 'Sending…' : 'Send claim'} size="lg" disabled={claim.isPending} onPress={send} />
              <Button label="Not your phone? Claim it on yours" variant="ghost" icon="phone" onPress={() => setElsewhere((on) => !on)} />
              {elsewhere ? <ClaimOnYourPhone handle={profile.handle} name={profile.display_name} /> : null}
            </View>
          )}
        </View>
        {wide ? (
          <View style={[styles.side, { borderLeftColor: ds.c.line }]}>
            <ClaimOnYourPhone handle={profile.handle} name={profile.display_name} title="Not your computer?" />
          </View>
        ) : null}
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  // Beside the claim on a computer (find-yourself step 4, desktop): the dialog widens to hold both.
  wide: { maxWidth: 860 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xl },
  claim: { gap: space.lg },
  flex: { flex: 1, minWidth: 0 },
  side: { width: 240, gap: space.md, paddingLeft: space.xl, borderLeftWidth: StyleSheet.hairlineWidth },
  stacked: { gap: space.xs },
  head: { gap: space.sm },
  cards: { gap: space.sm },
  note: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
