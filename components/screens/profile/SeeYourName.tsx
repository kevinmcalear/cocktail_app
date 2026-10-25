import { StyleSheet } from 'react-native';

import { Body } from '@/components/ds';
import { fontFamilies } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyPersonClaim } from '@/hooks/useProfiles';

/**
 * "Worked here? See your name? Tap it." under a bar's menus (owner-setup
 * step 3; find-yourself step 2), for anyone signed in who hasn't claimed a
 * person's page: the credits are links to it. Claiming the bar itself is
 * BarClaimCard's, under its name.
 */
export function SeeYourName() {
  const { user } = useAuth();
  const { data: claim, isPending } = useMyPersonClaim();
  if (!user || isPending || claim) return null;
  return (
    <Body tone="muted">
      {'Worked here? '}
      <Body style={styles.strong}>See your name? Tap it.</Body>
      {' Every drink credited to you is on your page, from every bar.'}
    </Body>
  );
}

const styles = StyleSheet.create({
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
