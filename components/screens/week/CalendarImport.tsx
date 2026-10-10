import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Field, useDs } from '@/components/ds';
import { Choice } from '@/components/screens/menus/MenuSheet';
import { radius, space } from '@/constants/tokens';
import { useAddCalendar, useCalendarSources, usePreviewCalendar, useRemoveCalendar, type FoundEvent } from '@/hooks/useWeek';
import { EVENT_KINDS } from '@/lib/week';

const kindName = (k: FoundEvent['kind']) => EVENT_KINDS.find((e) => e.kind === k)?.label ?? 'Event';
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * The "From a calendar link" side of the new-event sheet: paste the calendar
 * the venue already keeps, see what's in the next month, untick what isn't
 * for This week, and choose how its events start. The calendars already
 * coming in are listed with Remove.
 */
export function CalendarImport({ barId, onDone }: { barId: string; onDone: () => void }) {
  const ds = useDs();
  const [url, setUrl] = useState('');
  const [found, setFound] = useState<FoundEvent[] | null>(null);
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [startsPublic, setStartsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = usePreviewCalendar();
  const add = useAddCalendar();
  const remove = useRemoveCalendar();
  const { data: sources = [] } = useCalendarSources(barId);

  const look = async () => {
    setError(null);
    try {
      const events = await preview.mutateAsync({ barId, url });
      setFound(events);
      setLeft(new Set(events.filter((e) => e.internal).map((e) => e.uid)));
    } catch (e) {
      setFound(null);
      setError(e instanceof Error ? e.message : "Couldn't read that link.");
    }
  };
  const bring = async () => {
    setError(null);
    try {
      await add.mutateAsync({ barId, url, startsPublic, skipped: [...left] });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't bring that calendar in.");
    }
  };
  const toggle = (uid: string) => setLeft((s) => (s.has(uid) ? new Set([...s].filter((x) => x !== uid)) : new Set([...s, uid])));
  const count = (found?.length ?? 0) - left.size;

  return (
    <View style={styles.wrap}>
      <Field
        label="Calendar link (.ics or webcal)"
        value={url}
        onChangeText={(t) => {
          setUrl(t);
          setFound(null);
        }}
        placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
        autoCapitalize="none"
        keyboardType="url"
        hint="Google Calendar: Settings, then Public address in iCal format. Luma: Add iCal subscription. iCloud and Outlook: publish the calendar and copy its link."
      />
      {found === null ? <Button label={preview.isPending ? 'Reading…' : 'See what it holds'} variant="secondary" onPress={look} disabled={!url.trim() || preview.isPending} /> : null}
      {found ? (
        <View style={[styles.found, { backgroundColor: ds.c.raised }]}>
          <DsText variant="headline">{found.length ? `Found ${found.length} in the next month` : 'Nothing in the next month'}</DsText>
          {found.map((e) => (
            <Choice
              key={e.uid}
              kind="checkbox"
              label={e.name}
              detail={[when(e.starts_at), kindName(e.kind), e.internal ? 'looks like a team thing' : null, e.ticket_url ? 'booking link found' : null].filter(Boolean).join(' · ')}
              selected={!left.has(e.uid)}
              onPress={() => toggle(e.uid)}
            />
          ))}
        </View>
      ) : null}
      {found?.length ? (
        <View role="radiogroup" accessibilityLabel="Events from this calendar start as" style={styles.who}>
          <Caption tone="muted">Events from this calendar start as</Caption>
          <Choice label="Team only" detail="Open each one up when you're ready" selected={!startsPublic} onPress={() => setStartsPublic(false)} />
          <Choice label="Everyone" detail="Staff and private ones still stay with the team" selected={startsPublic} onPress={() => setStartsPublic(true)} />
          <Caption tone="muted">We check the link every three hours. Changes in your calendar come through; your changes here stay.</Caption>
        </View>
      ) : null}
      {error ? <Caption tone="accent">{error}</Caption> : null}
      {found?.length ? <Button label={add.isPending ? 'Bringing in…' : `Bring in ${count} ${count === 1 ? 'event' : 'events'}`} onPress={bring} disabled={add.isPending || count === 0} /> : null}
      {sources.length ? (
        <View style={styles.sources}>
          <Caption tone="muted">Calendars coming in</Caption>
          {sources.map((s) => (
            <View key={s.id} style={[styles.source, { borderBottomColor: ds.c.line }]}>
              <View style={styles.flex}>
                <Body numberOfLines={1}>{host(s.url)}</Body>
                <Caption tone="muted">
                  {s.last_error ?? (s.last_synced_at ? `Checked ${when(s.last_synced_at)}` : 'Not checked yet')}
                  {s.starts_public ? ' · new ones start as Everyone' : ' · new ones start as Team only'}
                </Caption>
              </View>
              <Button label="Remove" variant="ghost" accessibilityLabel={`Stop bringing in ${host(s.url)}`} onPress={() => remove.mutate(s.id)} disabled={remove.isPending} />
            </View>
          ))}
          <Caption tone="muted">Removing a calendar takes its events out of This week.</Caption>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  found: { gap: space.sm, padding: space.md, borderRadius: radius.control },
  who: { gap: space.sm },
  sources: { gap: space.xs, marginTop: space.md },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
});
