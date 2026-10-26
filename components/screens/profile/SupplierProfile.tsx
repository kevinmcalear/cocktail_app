import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { isUnclaimed, type Profile } from '@/hooks/useProfiles';
import { useSupplierLines } from '@/hooks/useSuppliers';
import { makesLine, servesLine } from '@/lib/makers';
import { suppliesLine } from '@/lib/suppliers';

import { ClaimProfile } from './ClaimProfile';
import { ProfileLinks } from './ProfileLinks';
import { BarHeader } from './ProfileSections';
import { RegionLines } from './RegionLines';

/**
 * A supplier's page (ppl-supplier): who a venue buys from, what it supplies,
 * where it delivers, and the makers whose brands it carries, by region.
 * Owned by a venue team like a maker's page; never on the map or in Discover.
 */
export function SupplierProfile({ profile }: { profile: Profile }) {
  const { data: lines = [], isLoading } = useSupplierLines(profile.id);
  const unclaimed = isUnclaimed(profile);
  const place = [profile.locality, profile.city].filter(Boolean).join(', ');
  const serves = servesLine(profile.serves);
  const signedIn = useSignedIn();

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <View style={styles.head}>
        <BarHeader profile={profile} size={52} neutral detail={[suppliesLine(profile.supplies), place, unclaimed ? 'Not claimed yet' : 'Claimed'].filter(Boolean).join(' · ')} />
        {serves ? <Caption tone="muted">{serves}</Caption> : null}
        {profile.bio ? <Body>{profile.bio}</Body> : null}
        <ProfileLinks profile={profile} align="start" />
      </View>

      {/* Signed in, the claim is in More (Q33); signed out there's no More, so it stays here and asks to sign in. */}
      {unclaimed && !signedIn ? <ClaimProfile profile={profile} label="Your company? Claim this page" /> : null}

      <View style={styles.section}>
        <View style={styles.title}>
          <Headline role="heading">Brands it carries</Headline>
          <Caption tone="muted">{`Makers whose products ${profile.display_name} supplies, by where it delivers.`}</Caption>
        </View>
        {isLoading ? (
          <Caption tone="muted">Loading brands…</Caption>
        ) : lines.length ? (
          <>
            <RegionLines lines={lines} detail={makesLine} />
            <Caption tone="muted">From the supplier’s or the maker’s own pages. A maker’s team can take a line off.</Caption>
          </>
        ) : (
          <Body tone="muted">No brands listed yet.</Body>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
  head: { gap: space.sm },
  section: { gap: space.md },
  title: { gap: space.xs },
});
