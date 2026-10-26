import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Headline, PressableScale, Segmented, useDs } from '@/components/ds';
import { CurrentUserAvatar } from '@/components/ui/UserAvatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyHiddenCity, useMyProfile, useSaveMyProfile, useSaveSharing, type MyProfile } from '@/hooks/useMyProfile';
import { useProfilePositions } from '@/hooks/useProfiles';
import { DEFAULT_IDENTITY, handleFromName, normalizeHandle, profileDraftErrors, profileLine, type ProfileDraft } from '@/lib/profiles';
import { plural } from '@/lib/menus';
import { siteOrigin } from '@/lib/venueLink';

import { SafetyPage } from '../safety/SafetyPage';
import { isShownPosition } from './Positions';
import { modeCount, useSharingCounts } from './useSharingCounts';

export const PUBLIC_MEANS = 'People signed in to Cocktail see your page, with only what you choose to show. You need this to publish a drink or share a menu.';
export const PRIVATE_MEANS = 'Only you see it. Drinks you’ve published and menus you’ve shared stop showing to anyone else while it’s private.';

/** Your profile as the form edits it. */
export const draftFrom = (p: MyProfile): ProfileDraft => ({
  name: p.displayName,
  handle: p.handle,
  bio: p.bio ?? '',
  instagram: p.instagram ?? '',
  isPublic: p.isPublic,
  tagline: p.tagline ?? '',
  headlinePositionId: p.headlinePositionId,
  showsPhoto: p.showsPhoto,
});

/**
 * Settings › Public profile (ppl-settings): a short hub. Your avatar, name and
 * line with Preview, then About you, What people see and Work, each its own
 * page with a summary, then Who can see it and Handle, which save as you
 * change them. Before you have a profile, the few fields that make one.
 */
export function MyProfileScreen() {
  const { data, isPending, error } = useMyProfile();
  return (
    <SafetyPage title="Your public profile" intro="How other people see you on Cocktail and on the web.">
      {isPending ? (
        <Body tone="muted">Loading your profile…</Body>
      ) : error ? (
        <Body tone="muted">Couldn’t load your profile. Check your connection and try again.</Body>
      ) : data ? (
        <Hub profile={data} />
      ) : (
        <MakeProfile />
      )}
    </SafetyPage>
  );
}

const WHO = [
  { value: 'public', label: 'Public' },
  { value: 'me', label: 'Only me' },
] as const;

function Hub({ profile }: { profile: MyProfile }) {
  const ds = useDs();
  const router = useRouter();
  const save = useSaveSharing();
  const saveProfile = useSaveMyProfile();
  const positions = useProfilePositions({ id: profile.id, kind: 'person' }).data ?? [];
  const counts = useSharingCounts(profile);
  const hiddenCity = useMyHiddenCity(!profile.showsCity).data;
  const [handle, setHandle] = useState(profile.handle);
  const [handleError, setHandleError] = useState<string | undefined>();
  const isPublic = save.isPending && save.variables?.isPublic !== undefined ? save.variables.isPublic : profile.isPublic;
  const line = profileLine({ tagline: profile.tagline, headline_position_id: profile.headlinePositionId }, positions);

  const city = profile.showsCity ? profile.city : hiddenCity;
  const about = ['Name', profile.showsPhoto ? 'photo for people on Cocktail' : 'initials for everyone else', line, city ? `${city} ${profile.showsCity ? 'shown' : 'hidden'}` : null].filter(Boolean).join(', ');
  const sees = counts
    ? [`Drinks: ${modeCount(profile.sharing.had, counts.had)}`, `Bars: ${modeCount(profile.sharing.bars, counts.bars)}`, `Originals: ${modeCount(profile.sharing.originals, counts.originals)}`].join(' · ')
    : '';
  const jobsShown = positions.filter((p) => p.person_accepted && isShownPosition(p)).length;
  const asking = positions.filter((p) => !p.person_accepted).length;
  const work = [`${plural(jobsShown, 'job')} shown`, asking ? `${plural(asking, 'bar')} asking` : null].filter(Boolean).join(' · ');

  // Saved when you leave the field, like every other choice here.
  const saveHandle = () => {
    const next = normalizeHandle(handle);
    if (next === profile.handle) return setHandleError(undefined);
    const problem = profileDraftErrors({ ...draftFrom(profile), handle }).handle;
    setHandleError(problem);
    if (!problem) saveProfile.mutate({ id: profile.id, draft: { ...draftFrom(profile), handle } }, { onError: (e) => setHandleError(e.message) });
  };

  return (
    <View style={styles.page}>
      {profile.isModerated ? <Body tone="accent">A moderator has hidden your profile, so nobody else can see it for now, even when it’s set to public.</Body> : null}
      <View style={styles.me}>
        <CurrentUserAvatar size={56} />
        <View style={styles.flex}>
          <Body style={styles.strong}>{profile.displayName}</Body>
          <Caption tone="muted" numberOfLines={2}>
            {[`@${profile.handle}`, line].filter(Boolean).join(' · ')}
          </Caption>
        </View>
        <Button label="Preview" variant="secondary" accessibilityHint="Opens You, your profile as people see it" onPress={() => router.push('/you')} />
      </View>
      {/* The three parts in one grouped card (ppl-settings). */}
      <View role="list" style={[styles.card, { backgroundColor: ds.c.surface }]}>
        <HubRow title="About you" summary={about} onPress={() => router.push('/settings/profile-about' as Href)} />
        <HubRow title="What people see" summary={sees} onPress={() => router.push('/settings/profile-sharing' as Href)} />
        <HubRow title="Work" summary={work} last onPress={() => router.push('/settings/profile-work' as Href)} />
      </View>
      <View style={styles.group}>
        <Headline role="heading">Who can see it</Headline>
        <Segmented
          variant="ink" stretch
          choice
          accessibilityLabel="Who can see your profile"
          options={WHO}
          value={isPublic ? 'public' : 'me'}
          onChange={(v) => save.mutate({ id: profile.id, isPublic: v === 'public' })}
        />
        <Caption tone="muted">{isPublic ? PUBLIC_MEANS : PRIVATE_MEANS}</Caption>
        {save.error ? (
          <Caption tone="accent" role="alert">
            {save.error.message}
          </Caption>
        ) : null}
      </View>
      <Field
        label="Handle"
        value={`@${handle.replace(/^@/, '')}`}
        onChangeText={(v) => setHandle(v.replace(/^@/, ''))}
        onBlur={saveHandle}
        onSubmitEditing={saveHandle}
        error={handleError}
        hint={`${siteOrigin().replace(/^https?:\/\//, '')}/p/${normalizeHandle(handle) || profile.handle}`}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={31}
      />
      <Caption tone="muted">Each choice saves as you change it.</Caption>
    </View>
  );
}

function HubRow({ title, summary, onPress, last }: { title: string; summary: string; onPress: () => void; last?: boolean }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${title}. ${summary}`} onPress={onPress} style={[styles.row, { borderBottomColor: last ? 'transparent' : ds.c.line }]}>
      <View style={styles.flex}>
        <Body style={styles.strong}>{title}</Body>
        <Caption tone="muted">{summary}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** Before you have a profile: your name, a handle, and who sees it. The rest waits on the hub. */
function MakeProfile() {
  const user = useAuth().user;
  const save = useSaveMyProfile();
  const suggested = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const [draft, setDraft] = useState<ProfileDraft>({ name: suggested, handle: handleFromName(suggested), bio: '', instagram: '', isPublic: true, ...DEFAULT_IDENTITY });
  const [tried, setTried] = useState(false);
  const errors = tried ? profileDraftErrors(draft) : {};
  const edit = (patch: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const submit = () => {
    setTried(true);
    if (!Object.keys(profileDraftErrors(draft)).length) save.mutate({ id: null, draft });
  };
  const handle = normalizeHandle(draft.handle);
  return (
    <View style={styles.page}>
      <Field label="Name" value={draft.name} onChangeText={(name) => edit({ name })} error={errors.name} autoComplete="name" autoCapitalize="words" maxLength={80} />
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
      <View style={styles.group}>
        <Headline role="heading">Who can see it</Headline>
        <Segmented variant="ink" stretch choice accessibilityLabel="Who can see your profile" options={WHO} value={draft.isPublic ? 'public' : 'me'} onChange={(v) => edit({ isPublic: v === 'public' })} />
        <Caption tone="muted">{draft.isPublic ? PUBLIC_MEANS : PRIVATE_MEANS}</Caption>
      </View>
      {save.error ? <Body tone="accent">{save.error.message}</Body> : null}
      <Button label="Make my profile" onPress={submit} disabled={save.isPending} style={styles.start} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.lg, marginTop: space.lg },
  me: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  group: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
});
