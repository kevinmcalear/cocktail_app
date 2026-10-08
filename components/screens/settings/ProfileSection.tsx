import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PasswordField } from '@/components/auth/PasswordField';
import { Button, Caption, Field, Headline, useDs } from '@/components/ds';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { showMessage } from '@/lib/dialogs';
import { useSaveProfilePhoto } from '@/hooks/useProfilePhoto';

const AVATAR = 72;
const BADGE = 26;

/** First and last name from the profile, else split from the name they signed up with. */
function namesFrom(meta: Record<string, unknown> | undefined): [string, string] {
  const first = typeof meta?.first_name === 'string' ? meta.first_name : '';
  const last = typeof meta?.last_name === 'string' ? meta.last_name : '';
  if (first || last) return [first, last];
  const [f = '', ...rest] = (typeof meta?.full_name === 'string' ? meta.full_name : '').trim().split(/\s+/);
  return [f, rest.join(' ')];
}

/**
 * Your photo, name and password. A new photo saves as soon as it's picked; the
 * name saves with its button; the password has its own panel, since changing
 * it is a different job from fixing a name.
 */
export function ProfileSection() {
  const ds = useDs();
  const { user, updateProfile } = useAuth();
  const photo = useSaveProfilePhoto();
  const saved = namesFrom(user?.user_metadata);
  // What's typed; null until they edit, so the fields follow the saved name.
  const [draft, setDraft] = useState<[string, string] | null>(null);
  const [firstName, lastName] = draft ?? saved;
  const setFirstName = (v: string) => setDraft([v, lastName]);
  const setLastName = (v: string) => setDraft([firstName, v]);
  const [savingName, setSavingName] = useState(false);
  const uploading = photo.isPending;
  const [pwOpen, setPwOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null;
  const fullName = [firstName, lastName].map((n) => n.trim()).filter(Boolean).join(' ');
  const shownName = [saved[0], saved[1]].filter(Boolean).join(' ');
  const nameChanged = firstName.trim() !== saved[0].trim() || lastName.trim() !== saved[1].trim();

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    photo.mutate(
      { uri: asset.uri, base64: asset.base64 },
      { onError: (e) => showMessage('Your photo didn’t save', e instanceof Error ? e.message : 'Try again.') },
    );
  };

  const saveName = async () => {
    setSavingName(true);
    // full_name is what teammates and credits show, so it follows the two fields.
    const { error } = await updateProfile({ firstName: firstName.trim() || undefined, lastName: lastName.trim(), fullName: fullName || undefined });
    setSavingName(false);
    if (error) showMessage('Your name didn’t save', error.message);
    else setDraft(null);
  };

  const savePassword = async () => {
    if (password.length < 6) return showMessage('Password too short', 'Use at least 6 characters.');
    if (password !== confirm) return showMessage('Passwords don’t match', 'Type the same new password twice.');
    setSavingPw(true);
    const { error } = await updateProfile({ password });
    setSavingPw(false);
    if (error) return showMessage('Your password didn’t change', error.message);
    setPassword('');
    setConfirm('');
    setPwOpen(false);
    showMessage('Password changed', 'Use it next time you sign in.');
  };

  return (
    <SettingsSection title="Profile">
      <View style={styles.who}>
        <Pressable onPress={() => void pickPhoto()} disabled={uploading} role="button" aria-label="Change profile photo" aria-busy={uploading}>
          <UserAvatar uri={avatarUrl} name={shownName} email={user?.email} size={AVATAR} borderWidth={1} borderColor={ds.c.line} />
          <View style={[styles.badge, { backgroundColor: ds.c.ink, borderColor: ds.c.surface }]}>
            {uploading ? <ActivityIndicator size="small" color={ds.c.ground} /> : <IconSymbol name="camera.fill" size={13} color={ds.c.ground} />}
          </View>
        </Pressable>
        <View style={styles.whoText}>
          <Headline numberOfLines={1}>{shownName || 'Add your name'}</Headline>
          {user?.email ? <Caption tone="muted" numberOfLines={1}>{user.email}</Caption> : null}
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
      {nameChanged ? (
        <View style={styles.actions}>
          <Button label="Cancel" variant="ghost" onPress={() => setDraft(null)} />
          <Button label={savingName ? 'Saving…' : 'Save name'} onPress={() => void saveName()} disabled={savingName || !firstName.trim()} />
        </View>
      ) : null}

      <RowDivider />
      <SettingsRow label="Password" detail={pwOpen ? undefined : 'Change the password you sign in with'} icon="key.fill" role="button" expanded={pwOpen} onPress={() => setPwOpen(!pwOpen)} />
      {pwOpen ? (
        <View style={styles.password}>
          <PasswordField label="New password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" autoComplete="new-password" textContentType="newPassword" />
          <PasswordField label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Type it again" autoComplete="new-password" textContentType="newPassword" />
          <View style={styles.actions}>
            <Button label={savingPw ? 'Changing…' : 'Change password'} onPress={() => void savePassword()} disabled={savingPw || !password} />
          </View>
        </View>
      ) : null}
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.md },
  whoText: { flex: 1, gap: 2, minWidth: 0 },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: BADGE,
    height: BADGE,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingBottom: space.md },
  name: { flex: 1, minWidth: 160 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, paddingBottom: space.md },
  password: { gap: space.md, paddingBottom: space.sm },
});
