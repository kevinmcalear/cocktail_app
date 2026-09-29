import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, Field, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useBarPublishing } from '@/hooks/usePublishing';
import { useDeleteRelease, useSaveRelease, useVenueReleases, type VenueRelease } from '@/hooks/useReleases';
import { confirmAsync } from '@/lib/dialogs';
import type { PublishMode } from '@/lib/publishing';
import { dayStart, RELEASE_STATUS_LABEL, releaseProblems, releaseStatus, ymd } from '@/lib/releases';

import { ReleaseDrinks } from './ReleaseDrinks';
import { releaseHref } from './ReleaseList';

/** Make or change one of a venue's releases: its name, date and drinks, and when it goes public. */
export function ReleaseEditorScreen({ barId, releaseId }: { barId: string; releaseId: string }) {
  return (
    <BackbarTheme>
      <ReleaseEditor barId={barId} releaseId={releaseId} />
    </BackbarTheme>
  );
}

function ReleaseEditor({ barId, releaseId }: { barId: string; releaseId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const caps = useCapabilities(barId);
  const bar = useBarPublishing(barId);
  const releases = useVenueRelease(barId, releaseId);

  let body;
  if (caps.data && !caps.data.includes('publish')) body = <Body tone="muted">Only people with the publish permission at this venue can make releases.</Body>;
  else if (!bar.data || releases.isLoading) body = <Caption tone="muted">Loading…</Caption>;
  else if (releaseId !== 'new' && !releases.release) body = <Body tone="muted">This release isn’t here any more. Someone may have deleted it.</Body>;
  else body = <ReleaseForm key={releaseId} barId={barId} existing={releases.release} drinks={bar.data.drinks} hasProfile={!!bar.data.profile} />;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{releases.release?.name ?? 'New release'}</title>
      </WebHead>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}
      >
        <View style={styles.readable}>{body}</View>
      </ScrollView>
      <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel="Back"
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}/publishing` as Href))}
        />
      </View>
    </View>
  );
}

function useVenueRelease(barId: string, releaseId: string) {
  const { data, isLoading } = useVenueReleases(barId);
  return { release: data?.find((r) => r.id === releaseId), isLoading };
}

interface ReleaseFormProps {
  barId: string;
  existing: VenueRelease | undefined;
  drinks: { id: string; name: string; mode: PublishMode }[];
  hasProfile: boolean;
}

function ReleaseForm({ barId, existing, drinks, hasProfile }: ReleaseFormProps) {
  const router = useRouter();
  const save = useSaveRelease(barId);
  const remove = useDeleteRelease(barId);
  const [id, setId] = useState(existing?.id);
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [date, setDate] = useState(() => existing?.releaseDate ?? ymd(new Date()));
  const [itemIds, setItemIds] = useState(existing?.itemIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const status = existing ? releaseStatus(existing, now) : 'draft';
  const start = dayStart(date);
  const byId = new Map(drinks.map((d) => [d.id, d]));
  const inRelease = itemIds.flatMap((i) => (byId.has(i) ? [{ name: byId.get(i)!.name, isPublic: byId.get(i)!.mode !== 'private' }] : []));
  const problems = [...(hasProfile ? [] : ['The venue needs a public page first.']), ...releaseProblems({ name, releaseDate: date, drinks: inRelease })];
  const busy = save.isPending || remove.isPending || asking;
  // A live release can't hold a private drink, so the database refuses to save one that does.
  const canSave = !!name.trim() && !!start && !busy && !(status === 'live' && problems.length);
  const canPublish = !problems.length && !busy;
  const dateLabel = start?.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  /** Save, and optionally set when it goes public (null: back to a draft). */
  const run = async (publishedAt?: string | null) => {
    setError(null);
    try {
      const saved = await save.mutateAsync({ draft: { id, name, description, releaseDate: date, itemIds }, publishedAt, onCreated: setId });
      setNow(Date.now());
      if (!existing) router.replace(releaseHref(barId, saved));
    } catch (e) {
      setError((e as { message?: string } | null)?.message ?? 'That didn’t save. Try again.');
    }
  };

  const destroy = async () => {
    setAsking(true);
    const ok = await confirmAsync({
      title: `Delete ${name || 'this release'}?`,
      message: 'It goes for good. Anyone who collected it keeps it as a memory.',
      confirmText: 'Delete',
      destructive: true,
    });
    setAsking(false);
    if (!ok || !id) return;
    try {
      await remove.mutateAsync(id);
      router.replace(`/settings/bar/${barId}/publishing` as Href);
    } catch (e) {
      setError((e as { message?: string } | null)?.message ?? 'That didn’t delete. Try again.');
    }
  };

  return (
    <View style={styles.form}>
      <Title>{existing?.name ?? 'New release'}</Title>
      <Caption tone="muted">
        {status === 'scheduled' && existing?.publishedAt
          ? `Scheduled: goes public ${new Date(existing.publishedAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
          : status === 'hidden'
            ? 'A moderator hid this release. It stays down until they restore it.'
            : RELEASE_STATUS_LABEL[status]}
      </Caption>

      <Field label="Name" value={name} onChangeText={setName} maxLength={80} placeholder="Autumn release" />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} maxLength={1000} multiline />
      <Field
        label="Release date"
        value={date}
        onChangeText={setDate}
        placeholder="2026-12-01"
        autoCapitalize="none"
        error={start ? undefined : 'Use a date like 2026-12-01.'}
        hint="The date it’s known by. Scheduling makes it public at the start of this day."
      />

      <ReleaseDrinks drinks={drinks} selected={itemIds} onChange={setItemIds} />

      {problems.length ? (
        <View style={styles.problems}>
          {problems.map((p) => (
            <Caption key={p} tone="muted">{status === 'draft' || status === 'scheduled' ? `Before it can go out: ${p}` : p}</Caption>
          ))}
        </View>
      ) : null}
      {error ? (
        <Caption tone="accent" role="alert">
          {error}
        </Caption>
      ) : null}

      <View style={styles.actions}>
        {status === 'draft' || status === 'scheduled' ? (
          <Button label="Publish now" icon="globe" disabled={!canPublish} onPress={() => run(new Date().toISOString())} />
        ) : null}
        {status === 'draft' && start && start.getTime() > now ? (
          <Button label={`Schedule for ${dateLabel}`} variant="secondary" disabled={!canPublish} onPress={() => run(start.toISOString())} />
        ) : null}
        <Button label={status === 'draft' ? 'Save draft' : 'Save'} variant="secondary" disabled={!canSave} onPress={() => run()} />
        {status === 'live' && id ? <Button label="See it" variant="ghost" onPress={() => router.push(`/r/${id}` as Href)} /> : null}
        {status === 'live' || status === 'scheduled' ? (
          <Button label={status === 'live' ? 'Take it down' : 'Back to draft'} variant="ghost" disabled={busy} onPress={() => run(null)} />
        ) : null}
        {id ? <Button label="Delete release" icon="trash" variant="ghost" disabled={busy} onPress={destroy} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  controls: { position: 'absolute' },
  form: { gap: space.lg },
  problems: { gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
