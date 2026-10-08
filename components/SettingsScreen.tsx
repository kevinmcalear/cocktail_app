import { useTabBarInset } from '@/components/nav/WebTabBar';
import { PasswordField } from '@/components/auth/PasswordField';
import { useAuth } from '@/ctx/AuthContext';
import { useBars } from '@/hooks/useBars';
import { useMaxRealRole, useViewAs } from '@/hooks/useViewAs';
import { DEFAULT_SEARCH_ALL, PERSONAL_CONTEXT, resolveDefaultContextIds } from '@/lib/barContextFilter';
import { confirmAsync, showMessage } from '@/lib/dialogs';
import { roleLabel, viewAsOptions } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { DEFAULT_UNIT_OPTIONS, THEME_MODES, useSettingsStore } from '@/store/useSettingsStore';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackbarTheme, Body, Button, Caption, Field, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { AccountSection } from '@/components/screens/settings/AccountSection';
import { ChoiceChips, ChoiceRows, RowDivider, SettingsRow, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { layout, radius, space } from '@/constants/tokens';
const BarInlineEditor = lazy(() => import('@/components/bar/BarInlineEditor').then((m) => ({ default: m.BarInlineEditor }))); // loads on first expand

/** Settings: profile, venues, preferences and the account. */
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
  const queryClient = useQueryClient();
  const { user, updateProfile, signOut } = useAuth();
  const router = useRouter();
  const tabBarInset = useTabBarInset();
  const { data: userBars, isLoading: barsLoading } = useBars();
  const {
    themeMode,
    setThemeMode,
    defaultSearchContext,
    setDefaultSearchContext,
    defaultUnit,
    setDefaultUnit,
    serviceMode,
    toggleServiceMode,
  } = useSettingsStore();
  const setSelectedContextIds = useAppStore((s) => s.setSelectedContextIds);
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving: viewAsSaving } = useViewAs();
  const maxRealRole = useMaxRealRole();
  const viewAsChoices = viewAsOptions(maxRealRole);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [localImageBase64, setLocalImageBase64] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [expandedBarId, setExpandedBarId] = useState<string | null>(null);
  const [showCreateBar, setShowCreateBar] = useState(false);
  const [newBarName, setNewBarName] = useState('');
  const [creatingBar, setCreatingBar] = useState(false);

  useEffect(() => {
    if (!user?.user_metadata) return;
    setFirstName(user.user_metadata.first_name || '');
    setLastName(user.user_metadata.last_name || '');
    setAvatarUrl(user.user_metadata.avatar_url || null);
  }, [user]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
      setLocalImageBase64(result.assets[0].base64 || null);
    }
  };

  const saveProfile = async () => {
    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        showMessage('Error', 'Passwords do not match');
        return;
      }
      if (password.length < 6) {
        showMessage('Error', 'Password must be at least 6 characters');
        return;
      }
    }

    setSavingProfile(true);
    let newAvatarUrl = avatarUrl;

    if (localImageUri && localImageBase64) {
      try {
        const ext = localImageUri.split('.').pop()?.toLowerCase() || 'jpeg';
        const fileName = `${user?.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(localImageBase64), {
            contentType: `image/${ext}`,
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(fileName);
        newAvatarUrl = publicUrl;
        setAvatarUrl(publicUrl);
        setLocalImageUri(null);
        setLocalImageBase64(null);
      } catch (e: any) {
        showMessage('Error', e.message || 'Failed to upload image');
        setSavingProfile(false);
        return;
      }
    }

    const { error } = await updateProfile({
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      password: password || undefined,
      avatarUrl: newAvatarUrl ?? undefined,
    });
    setSavingProfile(false);
    setPassword('');
    setConfirmPassword('');

    if (error) showMessage('Error', error.message);
    else showMessage('Saved', 'Profile updated');
  };

  const createBar = async () => {
    if (!newBarName.trim()) {
      showMessage('Required', 'Enter a venue name');
      return;
    }
    setCreatingBar(true);
    try {
      const { error } = await supabase.rpc('create_new_bar', {
        p_name: newBarName.trim(),
        p_visibility: 10,
        p_generic: 20,
        p_specific: 30,
        p_measurement: 30,
        p_prep: 40,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['bars'] });
      setNewBarName('');
      setShowCreateBar(false);
      showMessage('Created', `${newBarName.trim()} is ready`);
    } catch (e: any) {
      showMessage('Error', e.message || 'Failed to create venue');
    } finally {
      setCreatingBar(false);
    }
  };

  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  const profilePanel = (
    <SettingsSection title="Profile">
      <View style={styles.who}>
        <Pressable onPress={pickImage} role="button" aria-label="Change profile photo">
          <UserAvatar
            uri={localImageUri || avatarUrl}
            name={fullName}
            email={user?.email}
            size={72}
            borderWidth={1}
            borderColor={ds.c.line}
          />
        </Pressable>
        <View style={styles.whoText}>
          <Body>{fullName || user?.email || 'Account'}</Body>
          {!!user?.email && <Caption tone="muted">{user.email}</Caption>}
          <Button label="Change photo" variant="ghost" onPress={pickImage} style={styles.inlineButton} />
        </View>
      </View>

      <View style={styles.names}>
        <View style={styles.name}>
          <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
        </View>
        <View style={styles.name}>
          <Field label="Last name" value={lastName} onChangeText={setLastName} autoComplete="family-name" />
        </View>
      </View>

      <Caption tone="muted" role="heading">
        Change password
      </Caption>
      <PasswordField
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PasswordField
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm new password"
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <Button
        label={savingProfile ? 'Saving…' : 'Save profile'}
        onPress={saveProfile}
        disabled={savingProfile}
        style={styles.start}
      />
    </SettingsSection>
  );

  const venuesPanel = (
    <SettingsSection title="Venues">
      {barsLoading ? (
        <ListRowsSkeleton rows={3} />
      ) : userBars?.length === 0 && !showCreateBar ? (
        <Body tone="muted">You are not a member of any venues yet.</Body>
      ) : (
        <View>
          {userBars?.map((ub: any, i: number) => {
            const bar = Array.isArray(ub.bars) ? ub.bars[0] : ub.bars;
            const name = bar?.name || 'Venue';
            const logo = bar?.logo_url;
            const open = expandedBarId === ub.bar_id;
            return (
              <View key={ub.bar_id}>
                {i > 0 ? <RowDivider /> : null}
                <SettingsRow
                  label={name}
                  detail={roleLabel(ub.role_level)}
                  role="button"
                  expanded={open}
                  onPress={() => setExpandedBarId(open ? null : ub.bar_id)}
                  icon="building.2.fill"
                  leading={logo ? <Image source={{ uri: logo }} style={styles.logo} /> : undefined}
                />
                {open ? (
                  <View style={[styles.venueEditor, { borderColor: ds.c.line, backgroundColor: ds.c.ground }]}>
                    <Suspense fallback={null}><BarInlineEditor barId={ub.bar_id} embedded onClose={() => setExpandedBarId(null)} /></Suspense>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <RowDivider />

      {showCreateBar ? (
        <View style={styles.createBar}>
          <Field label="Venue name" value={newBarName} onChangeText={setNewBarName} placeholder="New venue name" />
          <View style={styles.pair}>
            <Button label={creatingBar ? 'Creating…' : 'Create'} onPress={createBar} disabled={creatingBar} style={styles.fill} />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => {
                setShowCreateBar(false);
                setNewBarName('');
              }}
              style={styles.fill}
            />
          </View>
        </View>
      ) : (
        <Button label="Create venue" variant="secondary" icon="plus" onPress={() => setShowCreateBar(true)} style={styles.start} />
      )}
    </SettingsSection>
  );

  const appearancePanel = (
    <SettingsSection title="Appearance" minWidth={240}>
      <ChoiceChips label="Appearance" options={THEME_MODES} value={themeMode} onChange={setThemeMode} />
    </SettingsSection>
  );

  const unitsPanel = (
    <SettingsSection title="Default unit" note="Used for new recipe ingredients" minWidth={240}>
      <ChoiceChips label="Default unit" options={DEFAULT_UNIT_OPTIONS} value={defaultUnit} onChange={setDefaultUnit} />
    </SettingsSection>
  );

  const servicePanel = (
    <SettingsSection title="Behind the bar" minWidth={240}>
      <SwitchRow
        label="Service mode"
        detail="Keeps the screen awake on specs and uses larger spec type."
        value={serviceMode}
        onValueChange={toggleServiceMode}
      />
    </SettingsSection>
  );

  const pickDefaultSearch = (value: string) => {
    setDefaultSearchContext(value);
    const barIds = (userBars || []).map((ub: any) => ub.bar_id as string);
    setSelectedContextIds(resolveDefaultContextIds(value, barIds));
  };

  const searchDefaultOptions: { id: string; label: string }[] = [
    { id: DEFAULT_SEARCH_ALL, label: 'All' },
    { id: PERSONAL_CONTEXT, label: 'Personal' },
    ...(userBars || []).map((ub: any) => {
      const bar = Array.isArray(ub.bars) ? ub.bars[0] : ub.bars;
      return { id: ub.bar_id as string, label: (bar?.name as string) || 'Venue' };
    }),
  ];

  const searchFilterPanel = (
    <SettingsSection title="Default search filter" note="Applied when the app opens" minWidth={240}>
      <ChoiceRows
        label="Default search filter"
        options={searchDefaultOptions}
        value={defaultSearchContext}
        onChange={pickDefaultSearch}
      />
    </SettingsSection>
  );

  const viewAsPanel =
    viewAsChoices.length === 0 ? null : (
      <SettingsSection title="View as" note="Preview menus and recipes as a lower permission level" minWidth={280}>
        <ChoiceRows
          label="View as"
          disabled={viewAsSaving}
          options={[
            { id: 'off', label: `Off (${roleLabel(maxRealRole)})` },
            ...viewAsChoices.map(({ level, label }) => ({ id: String(level), label })),
          ]}
          value={viewAsRoleLevel == null ? 'off' : String(viewAsRoleLevel)}
          onChange={(id) => void setViewAsRoleLevel(id === 'off' ? null : Number(id))}
        />
      </SettingsSection>
    );

  const logOut = async () => {
    const ok = await confirmAsync({
      title: 'Log out?',
      message: 'Saved offline data on this device will be cleared.',
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
          paddingTop: insets.top + layout.minTapTarget + space.xl,
          paddingHorizontal: gutter,
          // Room for the floating tab bar on phones and narrow web.
          paddingBottom: Math.max(space.xxxl * 2, tabBarInset),
        }}
      >
        <View style={styles.page}>
          <View style={styles.head}>
            <Title>Settings</Title>
            <Body tone="muted">Profile, venues, and preferences</Body>
          </View>

          {/* ponytail: side-by-side wrap; height from content so forms aren't clipped */}
          <View style={styles.wrap}>
            {profilePanel}
            {venuesPanel}
          </View>

          <View style={styles.wrap}>
            {appearancePanel}
            {unitsPanel}
            {servicePanel}
            {searchFilterPanel}
            {viewAsPanel}
            <AccountSection />
          </View>

          <Button label="Log out" variant="secondary" size="lg" icon="rectangle.portrait.and.arrow.right" onPress={() => void logOut()} style={styles.logOut} />
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { width: '100%', maxWidth: 1100, alignSelf: 'center', gap: space.xl },
  head: { gap: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl, alignItems: 'flex-start' },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  whoText: { flex: 1, gap: 2, alignItems: 'flex-start' },
  inlineButton: { paddingHorizontal: 0, height: layout.minTapTarget },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  name: { flex: 1, minWidth: 140 },
  start: { alignSelf: 'flex-start' },
  logo: { width: 32, height: 32, borderRadius: radius.mark },
  venueEditor: { borderWidth: 1, borderRadius: radius.control, padding: space.sm, marginBottom: space.sm },
  createBar: { gap: space.md },
  pair: { flexDirection: 'row', gap: space.sm },
  logOut: { alignSelf: 'center', minWidth: 240 },
  back: { position: 'absolute' },
});
