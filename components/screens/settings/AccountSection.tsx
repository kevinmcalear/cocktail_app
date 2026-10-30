import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { SafetyLinks, type LinkRowProps } from '@/components/screens/safety/SafetyLinks';
import { ReportProblemSheet } from '@/components/screens/settings/ReportProblemSheet';
import { useFirstRound } from '@/hooks/useFirstRound';
import { RowDivider, SettingsRow, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { analyticsAvailable, analyticsOptedOut, subscribeAnalytics } from '@/lib/analytics';
import { space } from '@/constants/tokens';
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
      // Eddie, build 51 (tf-067): say plainly what goes, what stays with each
      // bar, and that they can come back. prepare_account_deletion and the
      // delete-account function are what this describes.
      message: [
        'We remove your sign-in, email, profile, rankings, drafts and saved drinks. They’re deleted, not hidden.',
        'Drinks and menus you made for a bar belong to that bar, so they stay there, without your name. A bar where you’re the only one on the team goes back to an unclaimed public page that whoever runs it can claim again.',
        'You’re welcome back any time: sign up with the same email and start fresh.',
      ].join('\n\n'),
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
        detail="Removes your sign-in and personal data. Bars keep their pages."
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

/**
 * Which build and over-the-air update this phone runs, so "is the new version
 * on my phone?" has an answer. Quiet, at the foot of Settings. Native only:
 * the web always loads the latest.
 */
export function AppVersion() {
  if (Platform.OS === 'web') return null;
  const build = Application.nativeBuildVersion ? ` (${Application.nativeBuildVersion})` : '';
  const runtime = Updates.runtimeVersion ? ` · runtime ${Updates.runtimeVersion}` : '';
  const created = Updates.createdAt?.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const update = Updates.isEmbeddedLaunch || !Updates.updateId ? 'built in' : [Updates.updateId.slice(0, 8), created].filter(Boolean).join(', ');
  return (
    <Caption tone="muted" selectable style={styles.version}>
      {`Version ${Application.nativeApplicationVersion ?? '?'}${build}${runtime}\nUpdate ${update}`}
    </Caption>
  );
}

const styles = StyleSheet.create({
  version: { paddingHorizontal: space.lg },
});
