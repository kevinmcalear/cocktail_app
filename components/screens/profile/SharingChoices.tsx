import { useRouter, type Href } from 'expo-router';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Body, Caption, Chip, DsText, PressableScale, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, space } from '@/constants/tokens';
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
      action={<TextLink label="Preview" accessibilityHint="Opens You, your profile as people see it" onPress={() => router.push('/you')} />}
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
          <View key={section} style={[styles.section, { borderBottomColor: ds.c.line }]}>
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
            <View role="radiogroup" accessibilityLabel={title} style={styles.chips}>
              {SHARE_MODES.map((m) => (
                <Chip key={m.value} label={m.label} selected={mode === m.value} onPress={() => choose(section, m.value)} />
              ))}
            </View>
            {c ? <Caption>{`${shown} of ${c.total} show`}</Caption> : null}
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
                  aria-label="Say when I had them"
                  trackColor={{ false: ds.c.lineStrong, true: ds.accentFill.fill }}
                  thumbColor={backbar.light.surface}
                  {...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null)}
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
      <View role="list">
        <LinkRow title="Photo" value={profile.showsPhoto ? 'People on Cocktail' : 'Only me'} onPress={() => router.push('/settings/profile-about' as Href)} />
        <LinkRow title="Work" value={`${jobs.filter(isShownPosition).length} of ${jobs.length} jobs shown`} onPress={() => router.push('/settings/profile-work' as Href)} />
      </View>
    </View>
  );
}

function LinkRow({ title, value, onPress }: { title: string; value: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${title}: ${value}`} onPress={onPress} style={[styles.link, { borderBottomColor: ds.c.line }]}>
      <Body style={styles.flex}>{title}</Body>
      <Caption tone="muted">{value}</Caption>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.lg, marginTop: space.md },
  section: { gap: space.sm, paddingBottom: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
});
