import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Body, Caption, Chip, Field, Headline, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { backbar, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useProfilePositions } from '@/hooks/useProfiles';
import { TAGLINES, type ProfileDraft } from '@/lib/profiles';

import { isShownPosition } from './Positions';

const OWN = 'own';
const NONE = 'none';

/**
 * Settings › Public profile: the line under your name (nothing, a ready-made
 * one, your own words, or one of your confirmed jobs) and whether people see
 * your photo. Edits the form's draft; the form saves.
 */
export function ProfileIdentity({ draft, edit, error, personId }: { draft: ProfileDraft; edit: (patch: Partial<ProfileDraft>) => void; error?: string; personId: string | null }) {
  const ds = useDs();
  const user = useAuth().user;
  const photo: string | null = typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null;
  // Only a job the bar has confirmed can stand under your name.
  const jobs = (useProfilePositions(personId ? { id: personId, kind: 'person' } : null).data ?? []).filter((p) => p.person_accepted && p.bar_accepted && isShownPosition(p));
  const tagline = draft.tagline.trim();
  const preset = TAGLINES.find((t) => t === tagline);
  const [ownWords, setOwnWords] = useState(() => !!tagline && !preset);
  const job = jobs.find((j) => j.id === draft.headlinePositionId);
  const picked = job ? job.id : ownWords ? OWN : (preset ?? (tagline ? OWN : NONE));

  const pick = (value: string) => {
    const isJob = jobs.some((j) => j.id === value);
    if (isJob) return edit({ headlinePositionId: value });
    setOwnWords(value === OWN);
    if (value === OWN) edit({ headlinePositionId: null, tagline: preset ? '' : draft.tagline });
    else edit({ headlinePositionId: null, tagline: value === NONE ? '' : value });
  };
  const options = [
    { value: NONE, label: 'Nothing' },
    ...TAGLINES.map((t) => ({ value: t as string, label: t as string })),
    { value: OWN, label: 'In my own words' },
    ...jobs.map((j) => ({ value: j.id, label: `${j.title}, ${j.bar.display_name}` })),
  ];

  return (
    <>
      <View style={styles.group}>
        <Headline role="heading">Under your name</Headline>
        <Caption tone="muted">What you do with drinks, if you want to say. A job shows only once the bar has confirmed it.</Caption>
        <View role="radiogroup" accessibilityLabel="Under your name" style={styles.wrap}>
          {options.map((o) => (
            <Chip key={o.value} label={o.label} selected={picked === o.value} onPress={() => pick(o.value)} />
          ))}
        </View>
        {picked === OWN ? (
          <Field label="In your own words" value={draft.tagline} onChangeText={(t) => edit({ tagline: t })} error={error} hint={`${tagline.length}/40`} maxLength={40} />
        ) : error ? (
          <Caption tone="accent">{error}</Caption>
        ) : null}
      </View>
      <View style={styles.group}>
        <Headline role="heading">Your photo</Headline>
        <View style={styles.row}>
          <UserAvatar uri={draft.showsPhoto ? photo : null} name={draft.name || '?'} size={56} />
          <Body style={styles.flex}>Show my photo</Body>
          <Switch
            value={draft.showsPhoto}
            onValueChange={(on) => edit({ showsPhoto: on })}
            aria-label="Show my photo on my profile"
            trackColor={{ false: ds.c.lineStrong, true: ds.accentFill.fill }}
            thumbColor={backbar.light.surface}
            {...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null)}
          />
        </View>
        <Caption tone="muted">
          {!photo
            ? 'You haven’t added a photo. Add one in Settings, under your account.'
            : draft.showsPhoto
              ? 'People on Cocktail see your photo on your profile.'
              : 'People see your initials. Your bar team still sees your photo on the team list.'}
        </Caption>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});
