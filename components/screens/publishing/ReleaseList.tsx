import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useVenueReleases } from '@/hooks/useReleases';
import { dayStart, RELEASE_STATUS_LABEL, releaseStatus } from '@/lib/releases';

export const releaseHref = (barId: string, id: string) => `/settings/bar/${barId}/releases/${id}` as Href;

/** The venue's releases on its Publishing screen, for people who can publish there. */
export function ReleaseList({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data: releases = [], isLoading } = useVenueReleases(barId);
  const [now] = useState(() => Date.now());

  return (
    <View style={styles.group}>
      <Headline role="heading">Releases</Headline>
      <Caption tone="muted">A named, dated set of drinks people can collect, like “Autumn release”. Every drink in it has to be public.</Caption>
      {isLoading ? <Caption tone="muted">Loading releases…</Caption> : null}
      <View role="list">
        {releases.map((r) => {
          const date = dayStart(r.releaseDate)?.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) ?? r.releaseDate;
          const summary = `${date} · ${RELEASE_STATUS_LABEL[releaseStatus(r, now)]} · ${r.itemIds.length} ${r.itemIds.length === 1 ? 'drink' : 'drinks'}`;
          return (
            <PressableScale
              key={r.id}
              role="link"
              accessibilityLabel={`${r.name}. ${summary}`}
              onPress={() => router.push(releaseHref(barId, r.id))}
              style={[styles.row, { borderBottomColor: ds.c.line }]}
            >
              <Body>{r.name}</Body>
              <Caption tone="muted">{summary}</Caption>
            </PressableScale>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Button label="New release" icon="plus" variant="secondary" onPress={() => router.push(releaseHref(barId, 'new'))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  row: { paddingVertical: space.md, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row' },
});
