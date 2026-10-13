import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, Segmented, Switch, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useMyProfile, useSaveSharing, type MyProfile, type SharingChange } from '@/hooks/useMyProfile';
import { useProfilePositions } from '@/hooks/useProfiles';
import { modeSummary, SHARE_MODES, type ShareMode } from '@/lib/profiles';

import { SafetyPage } from '../safety/SafetyPage';
import { isShownPosition } from './Positions';
import { useSharingCounts, type CountedSection } from './useSharingCounts';

const SECTIONS: { section: CountedSection; title: string }[] = [
  { section: 'had', title: 'Drinks I’ve had' },
  { section: 'bars', title: 'Bars I’ve been to' },
  { section: 'originals', title: 'Drinks I’ve made' },
  { section: 'awards', title: 'Awards' },
];

/** Settings › Public profile › What people see (ppl-what-people-see). */
export function WhatPeopleSeeScreen() {
  const router = useRouter();
  const { data, isPending } = useMyProfile();
  return (
    <SafetyPage
      title="What people see"
      intro="One choice per section, and you can still show or hide any single one. These save as you change them."
      backTo="/settings/profile"
      action={<Button label="Preview" variant="secondary" accessibilityHint="Opens You, your profile as people see it" onPress={() => router.push('/you')} />}
    >
      {data ? <SharingChoices profile={data} /> : <Body tone="muted">{isPending ? 'Loading…' : 'Make your public profile first.'}</Body>}
    </SafetyPage>
  );
}

/**
 * Each section's mode (All, Picked or None) with how many show now, a link to
 * pick single ones ("Hide some" when All, "Choose" when Picked; awards are
 * picked on You), and whether your drinks say when you had them. Then where
 * your photo and jobs are set. Each change saves straight away.
 */
export function SharingChoices({ profile }: { profile: MyProfile }) {
  const ds = useDs();
  const router = useRouter();
  const save = useSaveSharing();
  const counts = useSharingCounts(profile);
  const jobs = (useProfilePositions({ id: profile.id, kind: 'person' }).data ?? []).filter((p) => p.person_accepted);
  // A change shows straight away; a failed save puts it back.
  const pending: Omit<SharingChange, 'id'> | undefined = save.isPending ? save.variables : undefined;
  const modeOf = (section: CountedSection): ShareMode =>
    section === 'awards' ? (pending?.awardsMode ?? profile.awardsMode) : pending?.section === section && pending.mode ? pending.mode : profile.sharing[section];
  const showsDates = pending?.showsDates ?? profile.showsDates;
  const choose = (section: CountedSection, mode: ShareMode) => save.mutate(section === 'awards' ? { id: profile.id, awardsMode: mode } : { id: profile.id, section, mode });

  return (
    <View style={styles.box}>
      {SECTIONS.map(({ section, title }) => {
        const mode = modeOf(section);
        const c = counts?.[section];
        const shown = !c ? null : mode === 'all' ? c.total : mode === 'none' ? 0 : c.shown;
        return (
          <View key={section} style={styles.section}>
            <View style={styles.row}>
              <DsText variant="headline" role="heading" style={styles.flex}>
                {title}
              </DsText>
              {mode !== 'none' ? (
                <TextLink
                  label={mode === 'all' ? 'Hide some' : 'Choose'}
                  onPress={() => router.push((section === 'awards' ? '/you' : `/settings/profile-picks?section=${section}`) as Href)}
                />
              ) : null}
            </View>
            <Segmented variant="ink" stretch choice accessibilityLabel={title} options={SHARE_MODES} value={mode} onChange={(m) => choose(section, m)} />
            {c ? <Caption style={styles.count}>{`${shown} of ${c.total} show`}</Caption> : null}
            <Caption tone="muted">{modeSummary(section, mode)}</Caption>
            {section === 'had' && mode !== 'none' ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Body>Say when I had them</Body>
                  <Caption tone="muted">Dates can show where you are. Off, your drinks show without them.</Caption>
                </View>
                <Switch
                  value={showsDates}
                  onValueChange={(on) => save.mutate({ id: profile.id, showsDates: on })}
                  label="Say when I had them"
                />
              </View>
            ) : null}
          </View>
        );
      })}
      {save.error ? (
        <Caption tone="accent" role="alert">
          {save.error.message}
        </Caption>
      ) : null}
      {/* Where your photo and jobs are set, in one grouped card. */}
      <View role="list" style={[styles.card, { backgroundColor: ds.c.surface }]}>
        <LinkRow title="Photo" value={profile.showsPhoto ? 'People on Cocktail' : 'Only me'} onPress={() => router.push('/settings/profile-about' as Href)} />
        <LinkRow title="Work" value={`${jobs.filter(isShownPosition).length} of ${jobs.length} jobs shown`} last onPress={() => router.push('/settings/profile-work' as Href)} />
      </View>
    </View>
  );
}

function LinkRow({ title, value, onPress, last }: { title: string; value: string; onPress: () => void; last?: boolean }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${title}: ${value}`} onPress={onPress} style={[styles.link, { borderBottomColor: last ? 'transparent' : ds.c.line }]}>
      <Body style={styles.flex}>{title}</Body>
      <Caption tone="muted">{value}</Caption>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.xl, marginTop: space.md },
  section: { gap: space.sm },
  count: { fontFamily: fontFamilies.monoMedium },
  card: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
});
