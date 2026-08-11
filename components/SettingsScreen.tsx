import { PasswordField } from '@/components/auth/PasswordField';
import { BarInlineEditor } from '@/components/bar/BarInlineEditor';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/ctx/AuthContext';
import { useBars } from '@/hooks/useBars';
import { useMaxRealRole, useViewAs } from '@/hooks/useViewAs';
import {
  DEFAULT_SEARCH_ALL,
  PERSONAL_CONTEXT,
  resolveDefaultContextIds,
} from '@/lib/barContextFilter';
import { roleLabel, viewAsOptions } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { DEFAULT_UNIT_OPTIONS, THEME_MODES, useSettingsStore } from '@/store/useSettingsStore';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Switch,
  View,
} from 'react-native';
import { Button, Input, ScrollView, Separator, Text, XStack, YStack, useTheme } from 'tamagui';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80';

function alertMsg(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(title, message);
}

function Section({
  title,
  children,
  minWidth = 320,
}: {
  title: string;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    // ponytail: content-sized height — flex:1 + overflow:hidden was clipping the forms
    <YStack gap="$3" flexGrow={1} flexBasis={minWidth} minWidth={minWidth} maxWidth="100%">
      <Text
        fontSize={12}
        fontWeight="700"
        color="$color11"
        textTransform="uppercase"
        letterSpacing={0.8}
      >
        {title}
      </Text>
      <YStack
        backgroundColor="$backgroundStrong"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius={12}
        padding="$4"
        gap="$4"
      >
        {children}
      </YStack>
    </YStack>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user, updateProfile, signOut } = useAuth();
  const { data: userBars, isLoading: barsLoading } = useBars();
  const {
    isTestingEnabled,
    setTesting,
    themeMode,
    setThemeMode,
    defaultSearchContext,
    setDefaultSearchContext,
    defaultUnit,
    setDefaultUnit,
  } = useSettingsStore();
  const setSelectedContextIds = useAppStore((s) => s.setSelectedContextIds);
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving: viewAsSaving } = useViewAs();
  const maxRealRole = useMaxRealRole();
  const viewAsChoices = viewAsOptions(maxRealRole);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);
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
    setAvatarUrl(user.user_metadata.avatar_url || DEFAULT_AVATAR);
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
        alertMsg('Error', 'Passwords do not match');
        return;
      }
      if (password.length < 6) {
        alertMsg('Error', 'Password must be at least 6 characters');
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
        alertMsg('Error', e.message || 'Failed to upload image');
        setSavingProfile(false);
        return;
      }
    }

    const { error } = await updateProfile({
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      password: password || undefined,
      avatarUrl: newAvatarUrl !== DEFAULT_AVATAR ? newAvatarUrl : undefined,
    });
    setSavingProfile(false);
    setPassword('');
    setConfirmPassword('');

    if (error) alertMsg('Error', error.message);
    else alertMsg('Saved', 'Profile updated');
  };

  const createBar = async () => {
    if (!newBarName.trim()) {
      alertMsg('Required', 'Enter a venue name');
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
      alertMsg('Created', `${newBarName.trim()} is ready`);
    } catch (e: any) {
      alertMsg('Error', e.message || 'Failed to create venue');
    } finally {
      setCreatingBar(false);
    }
  };

  const color = theme.color?.get() as string;

  const profilePanel = (
    <Section title="Profile">
      <XStack alignItems="center" gap="$4">
        <Pressable onPress={pickImage}>
          <View>
            <Image
              source={{ uri: localImageUri || avatarUrl }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                borderWidth: 1,
                borderColor: theme.borderColor?.get() as string,
              }}
            />
          </View>
        </Pressable>
        <YStack flex={1} gap="$1">
          <Text fontSize={16} fontWeight="600" color="$color">
            {[firstName, lastName].filter(Boolean).join(' ') || user?.email || 'Account'}
          </Text>
          {!!user?.email && (
            <Text fontSize={13} color="$color11">
              {user.email}
            </Text>
          )}
          <Pressable onPress={pickImage}>
            <Text fontSize={13} color="$color8" fontWeight="600" marginTop="$1">
              Change photo
            </Text>
          </Pressable>
        </YStack>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={140} gap="$1.5">
          <Text fontSize={12} color="$color11">
            First name
          </Text>
          <Input
            value={firstName}
            onChangeText={setFirstName}
            backgroundColor="$background"
            borderColor="$borderColor"
            color="$color"
          />
        </YStack>
        <YStack flex={1} minWidth={140} gap="$1.5">
          <Text fontSize={12} color="$color11">
            Last name
          </Text>
          <Input
            value={lastName}
            onChangeText={setLastName}
            backgroundColor="$background"
            borderColor="$borderColor"
            color="$color"
          />
        </YStack>
      </XStack>

      <YStack gap="$3">
        <Text fontSize={13} fontWeight="600" color="$color">
          Change password
        </Text>
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
      </YStack>

      <Button
        backgroundColor="$color8"
        onPress={saveProfile}
        disabled={savingProfile}
        borderRadius={8}
        height={44}
        alignSelf="flex-start"
        paddingHorizontal="$5"
      >
        {savingProfile ? (
          <ActivityIndicator color={theme.backgroundStrong?.get() as string} />
        ) : (
          <Text color="$backgroundStrong" fontWeight="700">
            Save profile
          </Text>
        )}
      </Button>
    </Section>
  );

  const venuesPanel = (
    <Section title="Venues">
      {barsLoading ? (
        <Text color="$color11">Loading venues…</Text>
      ) : userBars?.length === 0 && !showCreateBar ? (
        <Text color="$color11">You are not a member of any venues yet.</Text>
      ) : (
        <YStack gap="$2">
          {userBars?.map((ub: any) => {
            const bar = Array.isArray(ub.bars) ? ub.bars[0] : ub.bars;
            const name = bar?.name || 'Venue';
            const logo = bar?.logo_url;
            const open = expandedBarId === ub.bar_id;
            return (
              <YStack key={ub.bar_id} gap="$2">
                <Pressable
                  onPress={() => setExpandedBarId(open ? null : ub.bar_id)}
                >
                  <XStack
                    alignItems="center"
                    gap="$3"
                    paddingVertical="$2"
                    paddingHorizontal="$2"
                    borderRadius={8}
                    backgroundColor={open ? '$backgroundHover' : 'transparent'}
                  >
                    {logo ? (
                      <Image
                        source={{ uri: logo }}
                        style={{ width: 32, height: 32, borderRadius: 6 }}
                      />
                    ) : (
                      <IconSymbol name="building.2.fill" size={20} color={color} />
                    )}
                    <YStack flex={1}>
                      <Text fontSize={15} fontWeight="600" color="$color">
                        {name}
                      </Text>
                      <Text fontSize={12} color="$color11">
                        Role level {ub.role_level}
                      </Text>
                    </YStack>
                    <IconSymbol
                      name={open ? 'chevron.down' : 'chevron.right'}
                      size={18}
                      color={theme.color11?.get() as string}
                    />
                  </XStack>
                </Pressable>
                {open ? (
                  <YStack
                    borderWidth={1}
                    borderColor="$borderColor"
                    borderRadius={10}
                    padding="$2"
                    backgroundColor="$background"
                  >
                    <BarInlineEditor
                      barId={ub.bar_id}
                      embedded
                      onClose={() => setExpandedBarId(null)}
                    />
                  </YStack>
                ) : null}
              </YStack>
            );
          })}
        </YStack>
      )}

      <Separator borderColor="$borderColor" />

      {showCreateBar ? (
        <YStack gap="$3">
          <Input
            value={newBarName}
            onChangeText={setNewBarName}
            placeholder="New venue name"
            backgroundColor="$background"
            borderColor="$borderColor"
            color="$color"
          />
          <XStack gap="$2">
            <Button
              flex={1}
              backgroundColor="$color8"
              onPress={createBar}
              disabled={creatingBar}
              borderRadius={8}
            >
              {creatingBar ? (
                <ActivityIndicator color={theme.backgroundStrong?.get() as string} />
              ) : (
                <Text color="$backgroundStrong" fontWeight="700">
                  Create
                </Text>
              )}
            </Button>
            <Button
              flex={1}
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$borderColor"
              onPress={() => {
                setShowCreateBar(false);
                setNewBarName('');
              }}
              borderRadius={8}
            >
              <Text color="$color">Cancel</Text>
            </Button>
          </XStack>
        </YStack>
      ) : (
        <Button
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius={8}
          icon={<IconSymbol name="plus" size={16} color={color} />}
          onPress={() => setShowCreateBar(true)}
          alignSelf="flex-start"
          paddingHorizontal="$4"
        >
          <Text color="$color" fontWeight="600">
            Create venue
          </Text>
        </Button>
      )}
    </Section>
  );

  const appearancePanel = (
    <Section title="Appearance" minWidth={240}>
      <XStack gap="$2">
        {THEME_MODES.map(({ id, label }) => {
          const selected = themeMode === id;
          return (
            <Pressable key={id} onPress={() => setThemeMode(id)} style={{ flex: 1 }}>
              <YStack
                alignItems="center"
                justifyContent="center"
                paddingVertical="$3"
                borderRadius={8}
                backgroundColor={selected ? '$color8' : '$background'}
                borderWidth={1}
                borderColor={selected ? '$color8' : '$borderColor'}
              >
                <Text
                  fontSize={13}
                  fontWeight={selected ? '700' : '500'}
                  color={selected ? '$backgroundStrong' : '$color'}
                >
                  {label}
                </Text>
              </YStack>
            </Pressable>
          );
        })}
      </XStack>
    </Section>
  );

  const unitsPanel = (
    <Section title="Default unit" minWidth={240}>
      <Text fontSize={12} color="$color11">
        Used for new recipe ingredients
      </Text>
      <XStack gap="$2">
        {DEFAULT_UNIT_OPTIONS.map(({ id, label }) => {
          const selected = defaultUnit === id;
          return (
            <Pressable key={id} onPress={() => setDefaultUnit(id)} style={{ flex: 1 }}>
              <YStack
                alignItems="center"
                justifyContent="center"
                paddingVertical="$3"
                borderRadius={8}
                backgroundColor={selected ? '$color8' : '$background'}
                borderWidth={1}
                borderColor={selected ? '$color8' : '$borderColor'}
              >
                <Text
                  fontSize={13}
                  fontWeight={selected ? '700' : '500'}
                  color={selected ? '$backgroundStrong' : '$color'}
                >
                  {label}
                </Text>
              </YStack>
            </Pressable>
          );
        })}
      </XStack>
    </Section>
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
    <Section title="Default search filter" minWidth={240}>
      <Text fontSize={12} color="$color11">
        Applied when the app opens
      </Text>
      <YStack gap="$2">
        {searchDefaultOptions.map(({ id, label }) => {
          const selected = defaultSearchContext === id;
          return (
            <Pressable key={id} onPress={() => pickDefaultSearch(id)}>
              <XStack
                alignItems="center"
                justifyContent="space-between"
                paddingVertical="$2.5"
                paddingHorizontal="$3"
                borderRadius={8}
                backgroundColor={selected ? '$color8' : '$background'}
                borderWidth={1}
                borderColor={selected ? '$color8' : '$borderColor'}
              >
                <Text
                  fontSize={14}
                  fontWeight={selected ? '700' : '500'}
                  color={selected ? '$backgroundStrong' : '$color'}
                >
                  {label}
                </Text>
                {selected && (
                  <IconSymbol
                    name="checkmark"
                    size={16}
                    color={theme.backgroundStrong?.get() as string}
                  />
                )}
              </XStack>
            </Pressable>
          );
        })}
      </YStack>
    </Section>
  );

  const testingPanel = (
    <Section title="Testing" minWidth={240}>
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <XStack alignItems="center" gap="$2.5" flex={1}>
          <CustomIcon name="TabTest" size={20} color={color} />
          <YStack flex={1}>
            <Text fontSize={15} fontWeight="600" color="$color">
              Enable Testing
            </Text>
            <Text fontSize={12} color="$color11">
              Show the Quiz tab in navigation
            </Text>
          </YStack>
        </XStack>
        <Switch
          value={isTestingEnabled}
          onValueChange={setTesting}
          trackColor={{
            false: theme.borderColor?.get() as string,
            true: theme.color8?.get() as string,
          }}
        />
      </XStack>
    </Section>
  );

  const viewAsPanel =
    viewAsChoices.length === 0 ? null : (
      <Section title="View as" minWidth={280}>
        <Text fontSize={12} color="$color11">
          Preview menus and recipes as a lower permission level
        </Text>
        <YStack gap="$2">
          <Pressable
            disabled={viewAsSaving}
            onPress={() => {
              void setViewAsRoleLevel(null);
            }}
          >
            <XStack
              alignItems="center"
              justifyContent="space-between"
              paddingVertical="$2.5"
              paddingHorizontal="$3"
              borderRadius={8}
              backgroundColor={viewAsRoleLevel == null ? '$color8' : '$background'}
              borderWidth={1}
              borderColor={viewAsRoleLevel == null ? '$color8' : '$borderColor'}
            >
              <Text
                fontSize={14}
                fontWeight={viewAsRoleLevel == null ? '700' : '500'}
                color={viewAsRoleLevel == null ? '$backgroundStrong' : '$color'}
              >
                Off ({roleLabel(maxRealRole)})
              </Text>
            </XStack>
          </Pressable>
          {viewAsChoices.map(({ level, label }) => {
            const selected = viewAsRoleLevel === level;
            return (
              <Pressable
                key={level}
                disabled={viewAsSaving}
                onPress={() => {
                  void setViewAsRoleLevel(level);
                }}
              >
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  paddingVertical="$2.5"
                  paddingHorizontal="$3"
                  borderRadius={8}
                  backgroundColor={selected ? '$color8' : '$background'}
                  borderWidth={1}
                  borderColor={selected ? '$color8' : '$borderColor'}
                >
                  <Text
                    fontSize={14}
                    fontWeight={selected ? '700' : '500'}
                    color={selected ? '$backgroundStrong' : '$color'}
                  >
                    {label}
                  </Text>
                </XStack>
              </Pressable>
            );
          })}
        </YStack>
      </Section>
    );

  return (
    <ScrollView flex={1} backgroundColor="$background" showsVerticalScrollIndicator={false}>
      <YStack
        width="100%"
        maxWidth={1100}
        alignSelf="center"
        paddingHorizontal="$6"
        paddingVertical="$6"
        gap="$5"
        paddingBottom={80}
      >
        <YStack gap="$1">
          <Text fontSize={28} fontWeight="700" color="$color">
            Settings
          </Text>
          <Text fontSize={14} color="$color11">
            Profile, venues, and preferences
          </Text>
        </YStack>

        {/* ponytail: side-by-side wrap; height from content so forms aren't clipped */}
        <XStack flexWrap="wrap" gap="$5" alignItems="flex-start">
          {profilePanel}
          {venuesPanel}
        </XStack>

        <XStack flexWrap="wrap" gap="$5" alignItems="flex-start">
          {appearancePanel}
          {unitsPanel}
          {searchFilterPanel}
          {viewAsPanel}
          {testingPanel}
          <YStack flexGrow={1} flexBasis={220} minWidth={220} justifyContent="flex-end" paddingTop={28}>
            <Pressable onPress={() => signOut()}>
              <XStack
                alignItems="center"
                justifyContent="center"
                gap="$2"
                paddingVertical="$4"
                borderRadius={12}
                borderWidth={1}
                borderColor="rgba(255,107,107,0.35)"
                backgroundColor="rgba(255,107,107,0.08)"
              >
                <IconSymbol
                  name="rectangle.portrait.and.arrow.right"
                  size={18}
                  color="#FF6B6B"
                />
                <Text fontSize={15} fontWeight="700" color="#FF6B6B">
                  Log out
                </Text>
              </XStack>
            </Pressable>
          </YStack>
        </XStack>
      </YStack>
    </ScrollView>
  );
}
