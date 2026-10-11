import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Button, Caption, Field, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { CalendarImport } from '@/components/screens/week/CalendarImport';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { parseTeamWords, useSaveTeamWords, useTeamWords } from '@/hooks/useCalendars';
import { useBarProfile } from '@/hooks/useRankings';
import { useCalendarSources, useRemoveCalendar } from '@/hooks/useWeek';
import { shareLink } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/^calendar\.google\.com$/, 'Google Calendar');
  } catch {
    return url;
  }
};
const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return minutes < 60 ? `${Math.max(minutes, 1)} min ago` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h ago` : new Date(iso).toLocaleDateString();
};

/**
 * Venue settings › Calendars: the calendars that bring events in, the
 * venue's own calendar feed for its website, and the words that keep an
 * imported event with the team. Part D of This week; Google Calendar,
 * Eventbrite and Google Business Profile sign-ins join "Bring events in" once
 * their apps are set up.
 */
export function CalendarsScreen({ barId }: { barId: string }) {
  return (
    <BackbarTheme>
      <CalendarsPage barId={barId} />
    </BackbarTheme>
  );
}

function CalendarsPage({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const frame = usePageFrame('text');
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const caps = useCapabilities(barId);
  const canEdit = Array.isArray(caps.data) && caps.data.includes('menus');
  const { data: sources = [] } = useCalendarSources(barId);
  const remove = useRemoveCalendar();
  const [adding, setAdding] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}` as Href));

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Calendars</title>
      </WebHead>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: frame.top, paddingBottom: bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={[frame.column, styles.page]}>
          <SubPageHead
            title="Calendars"
            subtitle="Keep events where you already plan them. They show up in This week, and you choose which ones guests see."
            crumbs={[{ label: 'Venue settings', href: `/settings/bar/${barId}` as Href }]}
            onBack={back}
          />
          {caps.data && !canEdit ? <Body tone="muted">Calendars open to people who build menus here.</Body> : null}
          <SettingsSection
            title="Bring events in"
            note="Resy, OpenTable, SevenRooms, Tock and DICE don’t let other apps read events. Paste the booking link on the event instead."
          >
            {sources.map((s) => (
              <View key={s.id}>
                <SettingsRow
                  icon="link"
                  label={host(s.url)}
                  detail={s.last_error ?? (s.last_synced_at ? `Checked ${ago(s.last_synced_at)}` : 'Not checked yet')}
                  onPress={() => remove.mutate(s.id)}
                  role="button"
                  disabled={!canEdit || remove.isPending}
                  trailing={<Caption tone="accent">Remove</Caption>}
                />
                <RowDivider />
              </View>
            ))}
            <SettingsRow icon="plus" label="Add a calendar link" detail="Google Calendar, Luma, iCloud, Outlook or any .ics" onPress={() => setAdding(true)} role="button" disabled={!canEdit} />
          </SettingsSection>
          <FeedSection barId={barId} />
          {canEdit ? <TeamWordsSection barId={barId} /> : null}
        </View>
      </ScrollView>
      {adding ? (
        <MenuSheet visible title="Add a calendar link" onClose={() => setAdding(false)}>
          <CalendarImport barId={barId} onDone={() => setAdding(false)} showSources={false} />
        </MenuSheet>
      ) : null}
    </View>
  );
}

/** The venue's public week as a calendar feed, for its website or a guest's calendar app. */
function FeedSection({ barId }: { barId: string }) {
  const page = useBarProfile(barId).data;
  const [copied, setCopied] = useState(false);
  const feed = page?.id ? `${siteOrigin().replace(/^https?:/, 'webcal:')}/api/week-ics?bar=${page.id}` : null;
  return (
    <SettingsSection
      title="Send events out"
      note={feed ? feed : 'Your bar page isn’t public yet, so there’s no public calendar to share. Turn it on in Publishing.'}
    >
      <SettingsRow
        icon="calendar"
        label="Your public calendar"
        detail="Public events only, for your website or a guest’s calendar app"
        role="button"
        disabled={!feed}
        onPress={async () => {
          if (!feed) return;
          setCopied((await shareLink(feed, 'Our calendar', { copy: true }).catch(() => null)) === 'copied');
        }}
        trailing={<Caption tone="accent">{copied ? 'Copied' : 'Copy'}</Caption>}
      />
    </SettingsSection>
  );
}

/** Imported events whose names hold one of these stay with the team: a staff training isn't for guests. */
function TeamWordsSection({ barId }: { barId: string }) {
  const { data: words } = useTeamWords(barId);
  const save = useSaveTeamWords();
  const [text, setText] = useState<string | null>(null);
  const value = text ?? words?.join(', ') ?? '';
  const changed = text !== null && parseTeamWords(text).join(',') !== (words ?? []).join(',');
  return (
    <SettingsSection title="Team-only words" note="Events from your calendars whose names hold one of these stay with your team, even when you share the rest.">
      <View style={styles.words}>
        <Field label="Words, separated by commas" hideLabel value={value} onChangeText={setText} autoCapitalize="none" />
        {changed ? (
          <Button
            label={save.isPending ? 'Saving…' : 'Save words'}
            variant="secondary"
            onPress={() => save.mutate({ barId, words: parseTeamWords(value) }, { onSuccess: () => setText(null) })}
            disabled={save.isPending}
            style={styles.save}
          />
        ) : null}
      </View>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
  words: { gap: space.sm, padding: space.md },
  save: { alignSelf: 'flex-start' },
});
