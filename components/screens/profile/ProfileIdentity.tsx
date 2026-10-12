import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, DsText, Field, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { TAGLINES, type ProfileDraft } from '@/lib/profiles';

const OWN = 'own';
const NONE = 'none';
/** Picking one of these asks whether to add where you work. */
const PRO = new Set<string>(['Bartender', 'Bar manager', 'Bar owner']);

/**
 * About you › "What do you do with drinks?" (ppl-about): Nothing, a
 * ready-made line or your own words, shown under your name. Picking a bar job
 * asks whether to add where you work, since a job your bar confirms gets a
 * mark. A job itself stands under your name from Work, not here.
 */
export function ProfileIdentity({ draft, edit, error }: { draft: ProfileDraft; edit: (patch: Partial<ProfileDraft>) => void; error?: string }) {
  const ds = useDs();
  const router = useRouter();
  const tagline = draft.tagline.trim();
  const preset = TAGLINES.find((t) => t === tagline);
  const [ownWords, setOwnWords] = useState(() => !!tagline && !preset);
  const picked = ownWords ? OWN : (preset ?? (tagline ? OWN : NONE));

  const pick = (value: string) => {
    setOwnWords(value === OWN);
    if (value === OWN) edit({ tagline: preset ? '' : draft.tagline });
    else edit({ tagline: value === NONE ? '' : value });
  };
  const options = [{ value: NONE, label: 'Nothing' }, ...TAGLINES.map((t) => ({ value: t as string, label: t as string })), { value: OWN, label: 'In my own words' }];

  return (
    <View style={styles.group}>
      <DsText variant="headline">What do you do with drinks?</DsText>
      <Caption tone="muted">Shown under your name. Pick Nothing and nothing shows. We never make one up.</Caption>
      <View role="radiogroup" accessibilityLabel="What do you do with drinks?" style={styles.wrap}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={picked === o.value} onPress={() => pick(o.value)} />
        ))}
      </View>
      {picked === OWN ? (
        <Field label="In your own words" value={draft.tagline} onChangeText={(t) => edit({ tagline: t })} error={error} hint={`${tagline.length}/40`} maxLength={40} />
      ) : error ? (
        <Caption tone="accent">{error}</Caption>
      ) : null}
      {PRO.has(picked) ? (
        <View style={[styles.note, { backgroundColor: ds.c.raised }]}>
          <DsText variant="headline">Add where you work?</DsText>
          <Body tone="muted">A job your bar confirms gets a mark, and can stand under your name instead. Without one, this line is just what you say about yourself, which is fine.</Body>
          <TextLink label="Go to Work" onPress={() => router.push('/settings/profile-work' as Href)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: { borderRadius: radius.card, padding: space.lg, gap: space.xs, alignItems: 'flex-start' },
});
