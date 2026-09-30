import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyProfile, useSaveMyProfile, type MyProfile } from '@/hooks/useMyProfile';
import { handleFromName, normalizeHandle, profileDraftErrors, type ProfileDraft } from '@/lib/profiles';
import { siteOrigin } from '@/lib/venueLink';

import { SafetyPage } from '../safety/SafetyPage';

const PUBLIC_MEANS =
  'Anyone can see your name, handle and bio, the drinks you publish and the menus you share. You need this to publish a drink or share a menu.';
const SHARED_MEANS = 'People signed in to the app see every drink you’ve ranked on your profile: your score, where you had it and when. Drinks a bar hasn’t published stay out.';
const UNSHARED_MEANS = 'Only you see the drinks you’ve had and your scores. They still count, without your name, towards each bar’s score.';
const PRIVATE_MEANS = 'Only you see it. Drinks you’ve published and menus you’ve shared stop showing to anyone else while it’s private.';

/** Settings › Public profile: make your profile, choose your handle, and say whether it's public. */
export function MyProfileScreen() {
  const { data, isPending, error } = useMyProfile();
  return (
    <SafetyPage title="Your public profile" intro="How other people see you on the app and on the web.">
      {isPending ? (
        <Body tone="muted">Loading your profile…</Body>
      ) : error ? (
        <Body tone="muted">Couldn’t load your profile. Check your connection and try again.</Body>
      ) : (
        // Mounted once loaded and never re-keyed: making the profile refetches it, and the form keeps its state.
        <ProfileForm profile={data ?? null} />
      )}
    </SafetyPage>
  );
}

function ProfileForm({ profile }: { profile: MyProfile | null }) {
  const router = useRouter();
  const user = useAuth().user;
  const save = useSaveMyProfile();
  const suggestedName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    profile
      ? { name: profile.displayName, handle: profile.handle, bio: profile.bio ?? '', isPublic: profile.isPublic, sharesRankings: profile.sharesRankings }
      : { name: suggestedName, handle: handleFromName(suggestedName), bio: '', isPublic: true, sharesRankings: false }
  );
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);
  const errors = tried ? profileDraftErrors(draft) : {};
  const handle = normalizeHandle(draft.handle);
  const edit = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  const submit = () => {
    setTried(true);
    if (Object.keys(profileDraftErrors(draft)).length) return;
    save.mutate({ id: profile?.id ?? null, draft }, { onSuccess: () => setSaved(true) });
  };

  return (
    <View style={styles.form}>
      {profile?.isModerated ? (
        <Body tone="accent">A moderator has hidden your profile, so nobody else can see it for now, even when it’s set to public.</Body>
      ) : null}
      <Field label="Name" value={draft.name} onChangeText={(name) => edit({ name })} error={errors.name} autoComplete="name" maxLength={80} />
      <Field
        label="Handle"
        value={draft.handle}
        onChangeText={(value) => edit({ handle: value })}
        error={errors.handle}
        hint={handle ? `${siteOrigin()}/p/${handle}` : 'Letters, numbers, dots and underscores.'}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={31}
      />
      <Field
        label="Bio (optional)"
        value={draft.bio}
        onChangeText={(bio) => edit({ bio })}
        error={errors.bio}
        hint={`${draft.bio.trim().length}/500`}
        multiline
        maxLength={500}
      />
      <View style={styles.visibility}>
        <Headline role="heading">Who can see it</Headline>
        <View role="radiogroup" accessibilityLabel="Who can see your profile" style={styles.chips}>
          <Chip label="Public" selected={draft.isPublic} onPress={() => edit({ isPublic: true })} />
          <Chip label="Only me" selected={!draft.isPublic} onPress={() => edit({ isPublic: false })} />
        </View>
        <Caption tone="muted">{draft.isPublic ? PUBLIC_MEANS : PRIVATE_MEANS}</Caption>
      </View>
      {draft.isPublic ? (
        <View style={styles.visibility}>
          <Headline role="heading">The drinks you’ve had</Headline>
          <View role="radiogroup" accessibilityLabel="Who can see the drinks you’ve had" style={styles.chips}>
            <Chip label="Keep private" selected={!draft.sharesRankings} onPress={() => edit({ sharesRankings: false })} />
            <Chip label="Show on my profile" selected={draft.sharesRankings} onPress={() => edit({ sharesRankings: true })} />
          </View>
          <Caption tone="muted">{draft.sharesRankings ? SHARED_MEANS : UNSHARED_MEANS}</Caption>
        </View>
      ) : null}
      {save.error ? <Body tone="accent">{save.error.message}</Body> : null}
      <View style={styles.actions}>
        <Button label={profile ? 'Save' : 'Make my profile'} onPress={submit} disabled={save.isPending} />
        {saved && draft.isPublic && !profile?.isModerated ? (
          <Button label="See your profile" variant="secondary" onPress={() => router.push(`/p/${handle}`)} />
        ) : null}
      </View>
      {saved ? <Caption tone="muted">Saved.</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg, marginTop: space.lg },
  visibility: { gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
