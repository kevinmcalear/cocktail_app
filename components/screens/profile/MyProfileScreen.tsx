import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyProfile, useSaveMyProfile, type MyProfile } from '@/hooks/useMyProfile';
import { DEFAULT_IDENTITY, DEFAULT_SHARING, handleFromName, normalizeHandle, profileDraftErrors, sharingSummary, type ProfileDraft } from '@/lib/profiles';
import { siteOrigin } from '@/lib/venueLink';

import { PlaceStep } from '../onboarding/CareerSteps';
import { SafetyPage } from '../safety/SafetyPage';
import { MyJobRequests } from './JobRequests';
import { PastJobs } from './PastJobs';
import { ProfileIdentity } from './ProfileIdentity';

const PUBLIC_MEANS =
  'Anyone can see your name, handle, bio and Instagram, the drinks you publish and the menus you share. You need this to publish a drink or share a menu.';

/** The three things a public profile can show, each its own switch. */
const SHARE_CHOICES = [
  { key: 'sharesRankings', label: 'Drinks I’ve had' },
  { key: 'sharesBars', label: 'Bars I’ve been to' },
  { key: 'sharesMade', label: 'Drinks I’ve made' },
] as const;
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
      ? {
          name: profile.displayName,
          handle: profile.handle,
          bio: profile.bio ?? '',
          instagram: profile.instagram ?? '',
          isPublic: profile.isPublic,
          sharesRankings: profile.sharesRankings,
          sharesBars: profile.sharesBars,
          sharesMade: profile.sharesMade,
          tagline: profile.tagline ?? '',
          headlinePositionId: profile.headlinePositionId,
          showsPhoto: profile.showsPhoto,
        }
      : { name: suggestedName, handle: handleFromName(suggestedName), bio: '', instagram: '', isPublic: true, ...DEFAULT_SHARING, ...DEFAULT_IDENTITY }
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
      <ProfileIdentity draft={draft} edit={edit} error={errors.tagline} personId={profile?.id ?? null} />
      <Field
        label="Bio (optional)"
        value={draft.bio}
        onChangeText={(bio) => edit({ bio })}
        error={errors.bio}
        hint={`${draft.bio.trim().length}/500`}
        multiline
        maxLength={500}
      />
      <Field
        label="Instagram (optional)"
        value={draft.instagram}
        onChangeText={(instagram) => edit({ instagram })}
        error={errors.instagram}
        hint="Your name there, like @little.rye, or the link to your profile."
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
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
          <Headline role="heading">What your profile shows</Headline>
          <View role="group" accessibilityLabel="What your profile shows" style={styles.wrap}>
            {SHARE_CHOICES.map((c) => (
              <Chip key={c.key} multi label={c.label} selected={draft[c.key]} onPress={() => edit({ [c.key]: !draft[c.key] })} />
            ))}
          </View>
          <Caption tone="muted">{sharingSummary(draft)}</Caption>
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
      {profile ? (
        <View style={styles.visibility}>
          <Headline role="heading">Where you’ve worked</Headline>
          <Caption tone="muted">
            Where you work now always shows. Switch on a past job to show it too. A job you add shows marked not confirmed until the bar says yes. Each switch saves
            straight away.
          </Caption>
          <MyJobRequests personId={profile.id} />
          <PastJobs personId={profile.id} />
          <AddJob personId={profile.id} />
        </View>
      ) : null}
    </View>
  );
}

/** Add a job you have now or had before: the same search and save as onboarding. */
function AddJob({ personId }: { personId: string }) {
  const [when, setWhen] = useState<'now' | 'before' | null>(null);
  if (!when) return <Button label="Add a job" variant="secondary" onPress={() => setWhen('now')} style={styles.start} />;
  return (
    <View style={styles.visibility}>
      <View role="radiogroup" accessibilityLabel="When" style={styles.chips}>
        <Chip label="I work there now" selected={when === 'now'} onPress={() => setWhen('now')} />
        <Chip label="I used to" selected={when === 'before'} onPress={() => setWhen('before')} />
      </View>
      <PlaceStep key={when} personId={personId} isCurrent={when === 'now'} listJobs={false} onDone={() => setWhen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  form: { gap: space.lg, marginTop: space.lg },
  visibility: { gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
