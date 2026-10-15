import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { useDs, useGutter } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { AccountSection, AppVersion, SignOutSection } from '@/components/screens/settings/AccountSection';
import { PreferencesSection, TryItSection } from '@/components/screens/settings/PreferencesSection';
import { ProfileSection } from '@/components/screens/settings/ProfileSection';
import { VenuesSection } from '@/components/screens/settings/VenuesSection';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { confirmAsync } from '@/lib/dialogs';

/**
 * Settings: profile, venues, preferences, privacy, and the account. One
 * readable column of grouped rows at every width, like the phone's own
 * Settings, sitting left beside the sidebar on wide web (680, as drawn);
 * each venue's settings open on a page of their own.
 */
export function SettingsScreen() {
  // In venue mode the page takes the venue's accent and ground (tools-settings-phone).
  return (
    <VenueBrandProvider>
      <Settings />
    </VenueBrandProvider>
  );
}

function Settings() {
  const ds = useDs();
  const gutter = useGutter();
  const frame = usePageFrame(680);
  const router = useRouter();
  const tabBarInset = useTabBarInset();
  const { signOut } = useAuth();
  const wide = useIsWideWeb();

  const logOut = async () => {
    const ok = await confirmAsync({
      title: 'Log out?',
      message: 'Saved offline data on this device, and any edits not yet sent, will be cleared.',
      confirmText: 'Log out',
      destructive: true,
    });
    if (ok) signOut();
  };

  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        style={styles.fill}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: frame.top,
          paddingHorizontal: gutter,
          // Room for the floating tab bar on phones and narrow web.
          paddingBottom: Math.max(space.xxxl * 2, tabBarInset),
        }}
      >
        <View style={[frame.column, styles.page]}>
          <SubPageHead title="Settings" close onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <ProfileSection />
          <VenuesSection />
          <PreferencesSection />
          {wide ? null : <TryItSection />}
          <AccountSection />
          <SignOutSection onLogOut={() => void logOut()} />
          <AppVersion />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { gap: space.xl },
});
