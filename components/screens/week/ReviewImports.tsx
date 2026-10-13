import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, Segmented, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDropImport, useKeepImport, useNewFromCalendars, useReviewImports, useTeamWords, type ImportedEvent } from '@/hooks/useCalendars';
import { EVENT_KINDS } from '@/lib/week';

const WHO = [
  { value: 'team', label: 'Team only' },
  { value: 'everyone', label: 'Everyone' },
] as const;
type Who = (typeof WHO)[number]['value'];

const host = (url: string | undefined) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '').replace(/^calendar\.google\.com$/, 'Google Calendar') : 'your calendar';
  } catch {
    return 'your calendar';
  }
};
/** "Wed 14, 3 PM": weekday first in every locale, like the week page. */
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(':00', '')}`;
};
const looksLike = (k: ImportedEvent['kind']) => (k === 'other' ? null : `Looks like a ${EVENT_KINDS.find((e) => e.kind === k)?.label.toLowerCase() ?? 'event'}`);

/** The team-only word in a name, as the sync matched it. */
function teamWord(name: string, words: string[]): string | null {
  const t = name.toLowerCase();
  return words.find((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t)) ?? null;
}

/**
 * "N new from your calendars": what the venue's calendars brought in since
 * someone last looked. Each one is Team only until shared; staff and private
 * ones stay with the team; ones the team already added by hand wait as
 * duplicates with Undo. Done shares the picked ones and marks everything
 * else seen, duplicates staying merged.
 */
export function ReviewImports() {
  const ds = useDs();
  const router = useRouter();
  const frame = usePageFrame('text');
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const { active } = useActiveVenue();
  const barId = active?.id ?? null;
  const { data: found = [], isLoading } = useNewFromCalendars(barId);
  const { data: words = [] } = useTeamWords(barId);
  const review = useReviewImports();
  const keep = useKeepImport();
  const drop = useDropImport();
  const [picked, setPicked] = useState<Record<string, Who>>({});
  const [error, setError] = useState<string | null>(null);

  const dupes = found.filter((e) => e.duplicate_of);
  const fresh = found.filter((e) => !e.duplicate_of);
  const teamOnly = (e: ImportedEvent) => e.kind === 'private' || !!teamWord(e.name, words);
  const choice = (e: ImportedEvent): Who => picked[e.id] ?? (e.source?.starts_public && !teamOnly(e) ? 'everyone' : 'team');
  const share = fresh.filter((e) => !teamOnly(e) && choice(e) === 'everyone').map((e) => e.id);
  const sources = [...new Set(found.map((e) => host(e.source?.url)))];
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/week'));

  const done = async () => {
    setError(null);
    try {
      // Duplicates count as seen too: they stay merged, out of the week.
      await review.mutateAsync({ share, seen: found.map((e) => e.id) });
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save that. Try again.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: frame.top, paddingBottom: bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={[frame.column, styles.page]}>
          <SubPageHead
            stacked
            title={found.length ? `${found.length} new from your calendars` : 'Nothing new from your calendars'}
            subtitle={found.length ? `From ${sources.join(' and ')}. Team only until you share them.` : undefined}
            crumbs={[{ label: 'This week', href: '/week' }]}
            onBack={back}
          />
          {!found.length && !isLoading ? <Body tone="muted">When a calendar link brings in something new, it waits here for you to check.</Body> : null}
          {fresh.map((e) =>
            teamOnly(e) ? (
              <View key={e.id} style={[styles.quiet, { borderColor: ds.c.lineStrong }]}>
                <View style={styles.flex}>
                  <DsText>{e.name}</DsText>
                  <Caption tone="muted">
                    {`${when(e.starts_at)} · ${e.kind === 'private' ? 'Private' : `Has “${teamWord(e.name, words)}” in the name`}. Team only.`}
                  </Caption>
                </View>
              </View>
            ) : (
              <View key={e.id} style={[styles.card, { backgroundColor: ds.c.surface }]}>
                <View style={styles.meta}>
                  <Caption tone="muted">{`${when(e.starts_at)} · ${host(e.source?.url)}`}</Caption>
                  {looksLike(e.kind) ? <Caption tone="muted">{looksLike(e.kind)}</Caption> : null}
                </View>
                <DsText variant="headline">{e.name}</DsText>
                <Segmented accessibilityLabel={`Who sees ${e.name}`} options={WHO} value={choice(e)} onChange={(v) => setPicked((p) => ({ ...p, [e.id]: v }))} />
              </View>
            )
          )}
          {dupes.map((e) => (
            <View key={e.id} style={[styles.quiet, { borderColor: ds.c.lineStrong }]}>
              <View style={styles.dupeText}>
                <DsText>{e.name}</DsText>
                <Caption tone="muted">{`Same as “${e.original?.name ?? 'an event'}” you added, so it’s left out.`}</Caption>
              </View>
              <View style={styles.dupeActions}>
                <Button label="Undo" variant="ghost" accessibilityLabel={`Keep ${e.name} as its own event`} onPress={() => keep.mutate(e.id)} disabled={keep.isPending} />
                <Button label="Remove" variant="ghost" accessibilityLabel={`Remove ${e.name} for good`} onPress={() => drop.mutate(e)} disabled={drop.isPending} />
              </View>
            </View>
          ))}
          {error ? <Caption tone="accent">{error}</Caption> : null}
          {found.length ? (
            <Button
              label={review.isPending ? 'Saving…' : share.length ? `Done, share ${share.length} with guests` : 'Done, keep them with the team'}
              size="lg"
              onPress={done}
              disabled={review.isPending}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** On the week page, for people who add events: what the calendars brought in that nobody has checked. */
export function ReviewBanner({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data: found = [] } = useNewFromCalendars(barId);
  if (!found.length) return null;
  const label = `${found.length} new from your calendars`;
  return (
    <PressableScale role="link" accessibilityLabel={`${label}. Review`} onPress={() => router.push('/week/review')} style={[styles.banner, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
      <DsText style={styles.flex}>{label}</DsText>
      <DsText color={ds.accentText}>Review</DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  page: { gap: space.md },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm },
  quiet: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.card, borderWidth: 1, borderStyle: 'dashed' },
  dupeText: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0 },
  dupeActions: { flexDirection: 'row', gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
});
