import { useRouter } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { SafetyLinks, type LinkRowProps } from '@/components/screens/safety/SafetyLinks';
import { ReportProblemSheet } from '@/components/screens/settings/ReportProblemSheet';
import { useFirstRound } from '@/hooks/useFirstRound';
import { RowDivider, SettingsRow, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { analyticsAvailable, analyticsOptedOut, subscribeAnalytics } from '@/lib/analytics';
import { saveAnalyticsChoice } from '@/lib/analyticsChoice';
import { confirmAsync, showMessage } from '@/lib/dialogs';
import { invokeFunction } from '@/lib/invokeFunction';
import { supabase } from '@/lib/supabase';

/**
 * Turns usage analytics off or on for this device. Hidden in builds without
 * analytics. Crash reports aren't covered: they're how we find what broke.
 */
function AnalyticsSwitch() {
  const optedOut = useSyncExternalStore(subscribeAnalytics, analyticsOptedOut, analyticsOptedOut);
  if (!analyticsAvailable() || optedOut === null) return null;
  return (
    <>
      <RowDivider />
      <SwitchRow
        label="Share usage analytics"
        detail="Which screens and features get used, never what you type or search for."
        value={!optedOut}
        onValueChange={(on) => void saveAnalyticsChoice(!on)}
      />
    </>
  );
}

/** Help, safety, privacy and terms, in the canvas's order, and the analytics switch. */
export function AccountSection() {
  const router = useRouter();
  const [reporting, setReporting] = useState(false);
  const { replay: restart, venue } = useFirstRound();
  const replay = () => {
    restart();
    if (venue) router.navigate('/library');
    else showMessage('First round', 'It starts the next time you open a venue.');
  };
  const linkRow = ({ label, detail, icon, onPress }: LinkRowProps) => (
    <View key={label}>
      <RowDivider />
      <SettingsRow label={label} detail={detail} icon={icon} onPress={onPress} />
    </View>
  );
  return (
    <SettingsSection title="Privacy and support">
      <SettingsRow label="Help and support" detail="Questions people ask, and how to reach a person" icon="questionmark" onPress={() => router.push('/support')} />
      {linkRow({ label: 'Replay the first round', detail: 'The short intro at a venue that opens the app a bit at a time', icon: 'arrow.clockwise', onPress: replay })}
      {linkRow({ label: 'Report a problem', detail: 'Something broken or wrong in the app', icon: 'exclamationmark.triangle', onPress: () => setReporting(true) })}
      <SafetyLinks row={linkRow} />
      {linkRow({ label: 'Privacy policy', icon: 'lock.fill', onPress: () => router.push('/legal/privacy') })}
      {linkRow({ label: 'Terms of use', icon: 'doc.text', onPress: () => router.push('/legal/terms') })}
      <AnalyticsSwitch />
      <ReportProblemSheet visible={reporting} onClose={() => setReporting(false)} />
    </SettingsSection>
  );
}

/** Log out, and below it, deleting the account for good. */
export function SignOutSection({ onLogOut }: { onLogOut: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    const confirmed = await confirmAsync({
      title: 'Delete your account?',
      message:
        'This permanently deletes your account, profile, drafts and venue memberships. Drinks and menus you made in a venue stay with that venue. This cannot be undone.',
      confirmText: 'Delete account',
      destructive: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await invokeFunction('delete-account', {});
      // The account is gone; drop the local session. The root layout then
      // clears this device's cached data and returns to sign-in.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      showMessage('Could not delete your account', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsSection>
      <SettingsRow label="Log out" icon="rectangle.portrait.and.arrow.right" role="button" trailing={<View />} onPress={onLogOut} />
      <RowDivider />
      <SettingsRow
        label="Delete account"
        detail="Permanently remove your account and personal data"
        icon="trash"
        tone="danger"
        role="button"
        busy={deleting}
        trailing={<View />}
        onPress={() => void deleteAccount()}
      />
    </SettingsSection>
  );
}
