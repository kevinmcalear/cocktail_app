import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/components/nav/WebTabBar';
import { BackbarTheme, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { AccountSection, SignOutSection } from '@/components/screens/settings/AccountSection';
import { PreferencesSection } from '@/components/screens/settings/PreferencesSection';
import { ProfileSection } from '@/components/screens/settings/ProfileSection';
import { VenuesSection } from '@/components/screens/settings/VenuesSection';
import { layout, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { confirmAsync } from '@/lib/dialogs';

/**
 * Settings: profile, venues, preferences, privacy, and the account. One
 * readable column of grouped rows at every width, like the phone's own
 * Settings; each venue's settings open on a page of their own.
 */
export function SettingsScreen() {
  return (
    <BackbarTheme>
      <Settings />
    </BackbarTheme>
  );
}

function Settings() {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tabBarInset = useTabBarInset();
  const { signOut } = useAuth();

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
          paddingTop: insets.top + space.sm,
          paddingHorizontal: gutter,
          // Room for the floating tab bar on phones and narrow web.
          paddingBottom: Math.max(space.xxxl * 2, tabBarInset),
        }}
      >
        <View style={styles.page}>
          <View style={styles.head}>
            <GlassButton
              accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
              icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
            <Title>Settings</Title>
          </View>
          <ProfileSection />
          <VenuesSection />
          <PreferencesSection />
          <AccountSection />
          <SignOutSection onLogOut={() => void logOut()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
});
