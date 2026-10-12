import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Headline, PressableScale, Tag, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useProfileAwards, useSetAwardPick } from '@/hooks/useProfiles';
import { awardInitials, sortAwards, type Award } from '@/lib/awards';
import { pickedShown, type ShareMode } from '@/lib/profiles';

import { AddAwardSheet } from './AddAwardSheet';
import { AWARD_LOGOS } from './awardLogos';
import { ModeLine } from './ModeLine';

/** How many show on someone's page before "All 7 awards". */
const FIRST = 4;

/** "Bartender of the Year" over "Australian Bar Awards · 2026", or the list place. */
const headline = (a: Award) => a.title ?? `No. ${a.position}`;

/**
 * A person's awards, one row each, newest first (ppl-person): the award's
 * mark, its title, Finalist or the list place, the body and year, the bar
 * they were at, and its source. Each one is checked against the published
 * results; the others never reach this page (profile_awards RLS).
 */
export function PersonAwards({ profileId }: { profileId: string }) {
  const [all, setAll] = useState(false);
  const awards = sortAwards(useProfileAwards(profileId).data ?? []);
  if (!awards.length) return null;
  const shown = all ? awards : awards.slice(0, FIRST);
  return (
    <View nativeID="awards" style={styles.section}>
      <Headline role="heading">Awards</Headline>
      <View role="list">
        {shown.map((a) => (
          <AwardRow key={a.id} award={a} />
        ))}
      </View>
      <Caption tone="muted">Newest first. Each one is checked against the award’s published results.</Caption>
      {awards.length > FIRST && !all ? <Button label={`All ${awards.length} awards`} variant="secondary" onPress={() => setAll(true)} style={styles.start} /> : null}
    </View>
  );
}

/**
 * Your awards on You (ppl-you): the same rows with an eye on each, Not
 * confirmed yet on one you sent until we check it, Only you on a hidden one,
 * and Add an award.
 */
export function MyAwards({ profileId, mode }: { profileId: string; mode: ShareMode }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const awards = sortAwards((useProfileAwards(profileId).data ?? []).filter((a) => a.status !== 'declined'));
  const pick = useSetAwardPick();
  const shownOf = (a: Award) => (pick.isPending && pick.variables?.id === a.id ? pick.variables.shown : a.on_profile);
  const count = awards.filter((a) => a.status === 'confirmed' && pickedShown(mode, shownOf(a))).length;
  return (
    <View style={styles.section}>
      <Headline role="heading">Awards</Headline>
      {awards.length ? <ModeLine mode={mode} shown={count} total={awards.length} onChange={() => router.push('/settings/profile-sharing' as Href)} /> : null}
      <View role="list">
        {awards.map((a) => {
          const hidden = !pickedShown(mode, shownOf(a));
          return <AwardRow key={a.id} award={a} hidden={hidden} onToggle={() => pick.mutate({ id: a.id, shown: hidden })} />;
        })}
        <AddRow onPress={() => setAdding(true)} />
      </View>
      {pick.error ? (
        <Caption tone="accent" role="alert">
          {pick.error.message}
        </Caption>
      ) : null}
      <Caption tone="muted">Newest first. Tap the eye to show or hide one. Awards you add say Not confirmed yet until we have checked the source.</Caption>
      <AddAwardSheet visible={adding} profileId={profileId} onClose={() => setAdding(false)} />
    </View>
  );
}

function AwardRow({ award: a, hidden = false, onToggle }: { award: Award; hidden?: boolean; onToggle?: () => void }) {
  const ds = useDs();
  const place = a.title && a.position ? `No. ${a.position}` : null;
  const body = `${a.award} · ${a.year}`;
  const pending = a.status === 'pending';
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.main, hidden && styles.hidden]}>
        <View style={[styles.logo, { backgroundColor: ds.c.paper, borderColor: ds.c.line }]} aria-hidden>
          {AWARD_LOGOS[a.award] ? (
            <Image source={AWARD_LOGOS[a.award]} style={styles.logoImg} contentFit="contain" accessible={false} />
          ) : (
            <DsText variant="caption" style={{ color: ds.c.sketchInk }}>
              {awardInitials(a.award)}
            </DsText>
          )}
        </View>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <DsText variant="headline" style={styles.shrink}>
              {headline(a)}
            </DsText>
            {a.is_finalist ? <Tag label="Finalist" /> : place ? <Tag label={place} /> : null}
            {hidden ? <Tag label="Only you" /> : null}
          </View>
          <Caption tone="muted">{body}</Caption>
          {pending ? (
            <View style={styles.titleRow}>
              <IconSymbol name="clock" size={14} color={ds.c.muted} />
              <Caption tone="muted">Not confirmed yet</Caption>
            </View>
          ) : null}
          <View style={styles.titleRow}>
            {a.bar ? <Caption>{`at ${a.bar.display_name}`}</Caption> : null}
            {a.source_url ? <SourceLink url={a.source_url} label={`Source: ${headline(a)}, ${body}${a.is_finalist ? ', finalist' : ''}, opens in a new tab`} /> : null}
          </View>
        </View>
      </View>
      {onToggle ? (
        <PressableScale role="button" accessibilityLabel={`${hidden ? 'Show' : 'Hide'} ${headline(a)} ${a.year} ${hidden ? 'on' : 'from'} your profile`} aria-pressed={!hidden} onPress={onToggle} style={styles.eye}>
          <IconSymbol name={hidden ? 'eye.slash' : 'eye'} size={20} color={hidden ? ds.c.muted : ds.c.ink} />
        </PressableScale>
      ) : null}
    </View>
  );
}

function SourceLink({ url, label }: { url: string; label: string }) {
  return (
    <View accessible={false}>
      <TextLink label="Source ↗" accessibilityHint={label} onPress={() => void Linking.openURL(url)} />
    </View>
  );
}

function AddRow({ onPress }: { onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="Add an award, with a link to where it was announced" onPress={onPress} style={[styles.row, styles.main, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.logo, styles.add, { borderColor: ds.c.lineStrong }]} aria-hidden>
        <IconSymbol name="plus" size={18} color={ds.c.ink} />
      </View>
      <View style={styles.text}>
        <DsText variant="headline">Add an award</DsText>
        <Caption tone="muted">With a link to where it was announced</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const LOGO = 40;

const styles = StyleSheet.create({
  section: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  hidden: { opacity: 0.5 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  shrink: { flexShrink: 1 },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: LOGO - 8, height: LOGO - 8 },
  add: { borderStyle: 'dashed', borderWidth: 1 },
  eye: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
});
