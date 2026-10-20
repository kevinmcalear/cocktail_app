import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Sheet, SheetScrollView, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useClaimProfile, type Profile } from '@/hooks/useProfiles';
import { OUR_INSTAGRAM, pageInstagram } from '@/lib/claimVerification';
import { plural } from '@/lib/menus';
import { needsOnboarding } from '@/lib/onboarding';

import { MethodCard } from '../claim/ClaimMethods';

/** Postgres errors from a person's claim, in words. */
export function personClaimError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') return 'You already have a claim waiting on this profile.';
  // The claims table takes a person's claim only from someone with no page of their own yet (Setup).
  if (code === '42501') return 'For now a page can be claimed only during Setup, before you have a page of your own.';
  if (code === 'P0001') return (error as { message: string }).message;
  return "Couldn't send your claim. Check your connection and try again.";
}

/**
 * "Claim Ash Okafor" (find-yourself step 4): one sheet, pick how we check,
 * send. An Instagram code is drawn but waits for its own piece (claims
 * tables and moderation), "<bar> confirms you" waits for the bar to be
 * claimed, so "Something else", a note a person checks, is the way for now.
 * From Setup, a sent claim goes back to Setup's "Claim sent".
 */
export function PersonClaimSheet({ profile, bar, stats, visible, onClose }: { profile: Profile; bar: string | null; stats: { drinks: number; menus: number }; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const claim = useClaimProfile();
  const [note, setNote] = useState('');
  const handle = pageInstagram(profile);
  const moves = [stats.drinks ? plural(stats.drinks, 'drink') : null, stats.menus ? plural(stats.menus, 'menu') : null, 'where you have worked'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const send = () =>
    claim.mutate(
      { profile_id: profile.id, message: note, bar_id: null },
      {
        onSuccess: () => {
          onClose();
          if (needsOnboarding(user?.user_metadata)) router.dismissTo('/onboarding');
        },
      }
    );
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={`Claim ${profile.display_name}`} keyboard>
      <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Title>{`Claim ${profile.display_name}`}</Title>
          <Body tone="muted">{`Your ${moves} move to your account. Nothing new goes public.`}</Body>
        </View>
        <View role="radiogroup" accessibilityLabel="How we check it’s you" style={styles.cards}>
          <MethodCard
            icon="paperplane.fill"
            label="A message from your Instagram"
            pill="About a day"
            detail={handle ? `Send a code to ${OUR_INSTAGRAM ? `@${OUR_INSTAGRAM}` : 'us'} from @${handle}, the handle on this page. Coming soon.` : 'This page has no Instagram to check.'}
            on={false}
            available={false}
            onPress={() => {}}
          />
          <MethodCard icon="checkmark" label={`${bar ?? 'The bar'} confirms you`} pill="Same day" detail={`Once ${bar ?? 'the bar'} is claimed, its Admin confirms you with one tap.`} on={false} available={false} onPress={() => {}} />
          <MethodCard icon="link" label="Something else" pill="A day or two" detail="A link that shows it is you, like a staff page or a press piece. A person checks." on available disabled={claim.isPending} onPress={() => {}}>
            <View style={styles.note}>
              <Field label="The link, or how we can check" value={note} onChangeText={setNote} multiline maxLength={1000} autoCorrect={false} />
            </View>
          </MethodCard>
        </View>
        {claim.error ? (
          <Caption tone="accent" role="alert">
            {personClaimError(claim.error)}
          </Caption>
        ) : null}
        <View style={styles.actions}>
          <Button label={claim.isPending ? 'Sending…' : 'Send claim'} size="lg" disabled={claim.isPending} onPress={send} />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  head: { gap: space.sm },
  cards: { gap: space.sm },
  note: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
