import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, DsText, GlassButton, Title, useBreakpoint } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { space, type } from '@/constants/tokens';
import { useVenueScore } from '@/hooks/useDiscover';
import type { Profile } from '@/hooks/useProfiles';
import { rankedCount } from '@/lib/nearMe';
import { formatScore, MIN_RANKERS } from '@/lib/ranking';
import { shareLink } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';

import { LoveBarButton } from '../kept/LoveBarButton';
import { ProfileSafety } from '../safety/ProfileSafety';

/**
 * A bar's name on its public page (ppl-pub-bar-desktop, -phone): the logo, or
 * its initials in its venue's display face and accent on a ring (BarMark); the name large; what and where
 * it is, then claimed and how many have ranked; its score at the right (under
 * the name on a phone). The score shows once MIN_RANKERS people have ranked.
 */
export function PublicBarHeader({ profile, place, claimed }: { profile: Profile; place: string; claimed: string }) {
  const wide = useBreakpoint() !== 'phone';
  const { data } = useVenueScore(profile.id);
  const score = data?.score ?? null;
  const ranked = data?.rankers ? rankedCount(data.rankers) : null;
  const size = wide ? 88 : 64;
  const scoreLabel = score !== null ? `Bar score ${formatScore(score)} out of 10` : ranked ? `No bar score until ${MIN_RANKERS} people have ranked here` : null;
  const scoreBlock =
    score !== null ? (
      <View style={wide ? styles.scoreWide : styles.scorePhone} aria-hidden>
        <DsText variant="spec" tone="accent" style={wide ? type.title : type.headline}>
          {formatScore(score)}
        </DsText>
        <Caption tone="muted">bar score</Caption>
      </View>
    ) : null;
  return (
    <View style={styles.block}>
      <View accessible accessibilityLabel={[profile.display_name, place, claimed, ranked, scoreLabel].filter(Boolean).join('. ')} style={styles.header}>
        {/* Its logo, else its venue's public Brand logo, else its initials in the venue's accent and face. */}
        <BarMark name={profile.display_name} logoUrl={profile.avatar_url} profileId={profile.id} size={size} />
        <View style={styles.name}>
          {wide ? <Display>{profile.display_name}</Display> : <Title>{profile.display_name}</Title>}
          {place ? <Body tone="muted" style={styles.place}>{place}</Body> : null}
          <Caption tone="muted">{[claimed, ranked].filter(Boolean).join(' · ')}</Caption>
        </View>
        {wide ? scoreBlock : null}
      </View>
      {wide ? null : scoreBlock}
    </View>
  );
}

/**
 * Love and Share under the bar's name, then a quiet More (...) that reports it.
 * Signed out, Love and More ask you to sign in first; signed in (the desktop
 * page in the app) they love the bar and open the report sheet. Its Instagram
 * is in the hours and location card (PublicBarFacts). On a phone, Love and
 * Share split the row.
 */
export function PublicBarActions({ profile, signedIn = false }: { profile: Profile; signedIn?: boolean }) {
  const router = useRouter();
  const wide = useBreakpoint() !== 'phone';
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      setCopied((await shareLink(`${siteOrigin()}/p/${profile.handle}`, profile.display_name)) === 'copied');
    } catch {
      setCopied(false);
    }
  };
  const signIn = () => router.push('/auth/login');
  const grow = wide ? undefined : styles.grow;
  return (
    <View style={[styles.actions, wide ? styles.wrap : null]}>
      {signedIn ? (
        <LoveBarButton profileId={profile.id} name={profile.display_name} labelled />
      ) : (
        <Button label="Love" icon="heart" variant="secondary" accessibilityHint={`Sign in to love ${profile.display_name}`} onPress={signIn} style={grow} />
      )}
      <Button label={copied ? 'Link copied' : 'Share'} icon="square.and.arrow.up" variant="secondary" onPress={() => void share()} style={grow} />
      {signedIn ? (
        <ProfileSafety profile={profile} />
      ) : (
        <GlassButton icon="ellipsis" accessibilityLabel={`More for @${profile.handle}: report. Sign in first`} onPress={signIn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.lg + space.xs, rowGap: space.lg },
  name: { flex: 1, minWidth: 200, gap: space.xs },
  // 15, as drawn.
  place: { fontSize: type.label.fontSize, lineHeight: 22 },
  scoreWide: { alignItems: 'flex-end' },
  scorePhone: { alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.sm },
  wrap: { flexWrap: 'wrap' },
  grow: { flex: 1, paddingHorizontal: space.sm },
});
