import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Segmented, Switch } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { fontFamilies, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyHiddenCity, useMyProfile, useSaveMyProfile, useSaveSharing, type MyProfile } from '@/hooks/useMyProfile';
import { useSaveProfilePhoto } from '@/hooks/useProfilePhoto';
import { profileDraftErrors, type ProfileDraft } from '@/lib/profiles';

import { SafetyPage } from '../safety/SafetyPage';
import { draftFrom } from './MyProfileScreen';
import { ProfileIdentity } from './ProfileIdentity';

const PHOTO_CHOICES = [
  { value: 'members', label: 'People on Cocktail' },
  { value: 'me', label: 'Only me' },
] as const;

const PHOTO_HINT = {
  members: 'Signed-in people see your photo. Anyone else sees your initials.',
  me: 'Everyone else sees your initials. Your bar team still sees your photo on the team list.',
};

/** Settings › Public profile › About you (ppl-about): your photo, name, line, bio, Instagram and city, with Save. */
export function AboutYouScreen() {
  const { data, isPending } = useMyProfile();
  return data ? <AboutForm profile={data} /> : (
    <SafetyPage title="About you" backTo="/settings/profile">
      <Body tone="muted">{isPending ? 'Loading…' : 'Make your public profile first.'}</Body>
    </SafetyPage>
  );
}

function AboutForm({ profile }: { profile: MyProfile }) {
  const user = useAuth().user;
  const save = useSaveMyProfile();
  const saveChoice = useSaveSharing();
  const photo = useSaveProfilePhoto();
  const accountPhoto: string | null = typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null;
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(profile));
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);
  const errors = tried ? profileDraftErrors(draft) : {};
  const showsCity = saveChoice.isPending && saveChoice.variables?.showsCity !== undefined ? saveChoice.variables.showsCity : profile.showsCity;
  const hiddenCity = useMyHiddenCity(!profile.showsCity).data;
  const city = profile.city ?? hiddenCity;
  const edit = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };
  const submit = () => {
    setTried(true);
    if (Object.keys(profileDraftErrors(draft)).length) return;
    save.mutate({ id: profile.id, draft }, { onSuccess: () => setSaved(true) });
  };
  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    const asset = result.canceled ? null : result.assets[0];
    if (asset?.base64) photo.mutate({ uri: asset.uri, base64: asset.base64 });
  };

  return (
    <SafetyPage title="About you" backTo="/settings/profile" action={<Button label={saved ? 'Saved' : 'Save'} onPress={submit} disabled={save.isPending} />}>
      <View style={styles.form}>
        <View style={styles.photo}>
          <UserAvatar uri={draft.showsPhoto ? accountPhoto : null} name={draft.name || '?'} size={96} neutral />
          <View style={styles.photoActions}>
            <Button label={accountPhoto ? 'Change photo' : 'Add a photo'} variant="secondary" onPress={() => void pickPhoto()} disabled={photo.isPending} />
            {accountPhoto ? <Button label={draft.showsPhoto ? 'Use my initials instead' : 'Use my photo'} variant="ghost" onPress={() => edit({ showsPhoto: !draft.showsPhoto })} /> : null}
          </View>
        </View>
        {photo.error ? <Caption tone="accent">Your photo didn’t save. Try again.</Caption> : null}
        <View style={styles.group}>
          <Body style={styles.strong}>Who sees your photo</Body>
          <Segmented
            variant="ink" stretch
            choice
            accessibilityLabel="Who sees your photo"
            options={PHOTO_CHOICES}
            value={draft.showsPhoto ? 'members' : 'me'}
            onChange={(v) => edit({ showsPhoto: v === 'members' })}
          />
          <Caption tone="muted">{PHOTO_HINT[draft.showsPhoto ? 'members' : 'me']}</Caption>
        </View>
        <Field label="Name" value={draft.name} onChangeText={(name) => edit({ name })} error={errors.name} autoComplete="name" maxLength={80} />
        <ProfileIdentity draft={draft} edit={edit} error={errors.tagline} />
        <Field label="Bio (optional)" value={draft.bio} onChangeText={(bio) => edit({ bio })} error={errors.bio} hint={`${draft.bio.trim().length}/500`} multiline maxLength={500} />
        <Field
          label="Instagram (optional)"
          value={draft.instagram}
          onChangeText={(instagram) => edit({ instagram })}
          error={errors.instagram}
          hint="Your name there, or the link to your profile."
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
        {city ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Body>Show my city</Body>
              <Caption tone="muted">{showsCity ? city : `${city}, hidden. Saves straight away.`}</Caption>
            </View>
            <Switch
              value={showsCity}
              onValueChange={(on) => saveChoice.mutate({ id: profile.id, showsCity: on })}
              label="Show my city"
            />
          </View>
        ) : null}
        {save.error ? <Body tone="accent">{save.error.message}</Body> : null}
        {saveChoice.error ? <Caption tone="accent">{saveChoice.error.message}</Caption> : null}
      </View>
    </SafetyPage>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg, marginTop: space.md },
  photo: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  photoActions: { flex: 1, gap: space.xs, alignItems: 'flex-start' },
  group: { gap: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});
