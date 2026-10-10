import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, Field, Headline, Segmented, Surface, Tag } from '@/components/ds';
import { JobRequests } from '@/components/screens/profile/JobRequests';
import { space } from '@/constants/tokens';
import { hideTarget, useIsModerator, useReportQueue, useResolveReport, useSetContentHidden, type QueuedReport } from '@/hooks/useModeration';
import { reasonLabel } from '@/lib/safety';

import { SafetyPage } from './SafetyPage';

const LISTS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
] as const;

const KIND: Record<QueuedReport['target_kind'], string> = { profile: 'Profile', item: 'Drink', release: 'Release', comment: 'Comment', ranking: 'Ranking', photo: 'Photo' };
const WHEN = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Settings › Reports, for moderators (catalog admins): open reports oldest
 * first, what they're about, and close them, hiding the content or not.
 * ponytail: a plain list with no search or paging (the queue returns 100)
 * until reports pile up.
 */
export function ModerationScreen() {
  const isModerator = useIsModerator();
  const [list, setList] = useState<'open' | 'closed'>('open');
  const { data: reports, isLoading, error } = useReportQueue(list === 'open');

  if (!isModerator) {
    return (
      <SafetyPage title="Reports">
        <Body tone="muted">Only moderators can see reports.</Body>
      </SafetyPage>
    );
  }
  return (
    <SafetyPage title="Reports" intro="What people have reported. Hide it if it breaks the rules. Nobody is told who reported them.">
      <JobRequests venueId={null} title="Jobs at bars not on Cocktail" />
      <Segmented accessibilityLabel="Which reports" options={LISTS} value={list} onChange={setList} />
      {error ? (
        <Body tone="muted">{`Couldn't load reports: ${error.message}`}</Body>
      ) : isLoading ? (
        <Caption tone="muted">Loading…</Caption>
      ) : reports?.length ? (
        <View role="list" aria-label={list === 'open' ? 'Open reports' : 'Closed reports'} style={styles.list}>
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </View>
      ) : (
        <Body tone="muted">{list === 'open' ? 'Nothing waiting. All reports are closed.' : 'No closed reports yet.'}</Body>
      )}
    </SafetyPage>
  );
}

// ponytail: a bar's drink opens only for its members until public drink
// pages exist, so drinks have no link yet; the queue names them instead.
function targetHref(r: QueuedReport): Href | null {
  if (r.target_kind === 'profile' && r.profile_id) return `/p/${r.profile_id}`;
  if (r.target_kind === 'ranking' && r.item_id) return `/rankings/${r.item_id}`;
  if (r.target_kind === 'photo' && r.item_id) return `/cocktail/${r.item_id}`;
  return null;
}

function ReportCard({ report: r }: { report: QueuedReport }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const resolve = useResolveReport();
  const setHidden = useSetContentHidden();
  const open = r.status === 'open';
  const hideable = !!hideTarget(r);
  const busy = resolve.isPending || setHidden.isPending;
  const href = targetHref(r);
  const what = r.target_name ?? 'Deleted since it was reported';
  const hideWord = r.target_kind === 'ranking' ? "the bar's profile" : 'it';
  const failed = resolve.error ?? setHidden.error;

  return (
    <View role="listitem">
      <Surface style={styles.card}>
        <View style={styles.tags}>
          <Tag label={KIND[r.target_kind]} />
          <Tag label={reasonLabel(r.reason)} />
          {r.target_hidden ? <Tag label="Hidden" tone="warning" /> : <Tag label="Visible" />}
          {open ? null : <Tag label={r.status === 'actioned' ? 'Actioned' : 'Dismissed'} />}
        </View>
        <Headline>{what}</Headline>
        {r.photo_url ? <DrinkImage source={r.photo_url} accessibilityLabel={`The reported photo of ${what}`} aspectRatio={1} radius="control" style={styles.photo} /> : null}
        {r.target_detail ? <Caption tone="muted">{r.target_kind === 'profile' || r.target_kind === 'photo' ? r.target_detail : `${r.target_kind === 'ranking' ? 'At' : 'From'} ${r.target_detail}`}</Caption> : null}
        <Caption tone="muted">{`Reported ${WHEN.format(new Date(r.created_at))}`}</Caption>
        {r.details ? <Body>{`“${r.details}”`}</Body> : <Caption tone="muted">No details given.</Caption>}
        {r.resolution ? <Body tone="muted">{`Note: ${r.resolution}`}</Body> : null}
        {open ? (
          <Field label="Note (optional)" placeholder="What you did, in a sentence" hint="The person who reported it sees this under Your reports." value={note} onChangeText={setNote} maxLength={1000} />
        ) : null}
        {failed ? (
          <Caption tone="accent" role="alert">
            {failed.message || "Couldn't save that. Try again."}
          </Caption>
        ) : null}
        <View style={styles.actions}>
          {open && hideable ? (
            <Button
              label={r.target_hidden ? 'Keep hidden and close' : `Hide ${hideWord} and close`}
              disabled={busy}
              onPress={() => resolve.mutate({ report: r, status: 'actioned', resolution: note, hide: true })}
            />
          ) : null}
          {open ? (
            <Button label="Close, no action" variant="secondary" disabled={busy} onPress={() => resolve.mutate({ report: r, status: 'dismissed', resolution: note, hide: false })} />
          ) : null}
          {hideable && (r.target_hidden || !open) ? (
            <Button
              label={r.target_hidden ? `Restore ${hideWord}` : `Hide ${hideWord}`}
              variant="ghost"
              disabled={busy}
              onPress={() => setHidden.mutate({ report: r, hidden: !r.target_hidden })}
            />
          ) : null}
          {href ? <Button label={r.target_kind === 'ranking' ? 'Open the list' : r.target_kind === 'photo' ? 'Open the drink' : 'Open profile'} variant="ghost" onPress={() => router.push(href)} /> : null}
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  card: { gap: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  photo: { maxWidth: 240 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
