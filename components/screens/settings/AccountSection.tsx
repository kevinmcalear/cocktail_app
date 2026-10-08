import { useRouter } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { SafetyLinks } from '@/components/screens/safety/SafetyLinks';
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
    <SwitchRow
      label="Share usage analytics"
      detail="Which screens and features get used, never what you type or search for."
      value={!optedOut}
      onValueChange={(on) => void saveAnalyticsChoice(!on)}
    />
  );
}

/** Privacy, terms, safety, the analytics switch, and deleting the account. */
export function AccountSection() {
  const router = useRouter();
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

  const linkRow = (label: string, onPress: () => void) => <SettingsRow label={label} onPress={onPress} />;

  return (
    <SettingsSection title="Account" minWidth={240}>
      <View>
        <AnalyticsSwitch />
        {linkRow('Privacy policy', () => router.push('/legal/privacy'))}
        {linkRow('Terms of use', () => router.push('/legal/terms'))}
        {linkRow('Help and support', () => router.push('/support'))}
        <SafetyLinks row={linkRow} />
        <RowDivider />
        <SettingsRow
          label="Delete account"
          detail="Permanently remove your account and personal data"
          tone="danger"
          role="button"
          busy={deleting}
          trailing={<View />}
          onPress={() => void deleteAccount()}
        />
      </View>
    </SettingsSection>
  );
}
