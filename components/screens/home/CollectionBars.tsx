import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Caption, DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useLoveBar, useLovedBars, type LovedBar } from '@/hooks/useKept';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { averageScore, barNews } from '@/lib/collectionMenus';
import type { HadDrink } from '@/lib/hadDrinks';
import { formatScore } from '@/lib/ranking';

import { BarMark } from './BarMark';
import { GoogleImportEntry, GoogleImportSheet } from './GoogleImport';

const barHref = (bar: LovedBar) => `/p/${bar.handle || bar.id}` as Href;

/** A bar you've been to: its mark, your average there, a heart to unlove it, and its latest news. */
function LovedRow({ bar, had }: { bar: LovedBar; had: HadDrink[] }) {
  const ds = useDs();
  const router = useRouter();
  const love = useLoveBar();
  const avg = averageScore(had.map((h) => h.score));
  const news = barNews(bar.currentMenu, bar.latestRelease ? { name: bar.latestRelease.name, date: bar.latestRelease.date } : null);
  const count = `${had.length} ${had.length === 1 ? 'drink' : 'drinks'}`;
  const newsHref = news?.text.startsWith('New release') && bar.latestRelease ? (`/r/${bar.latestRelease.id}` as Href) : bar.currentMenu ? (`/p/${bar.id}/menus/${bar.currentMenu.id}` as Href) : barHref(bar);
  return (
    <View style={[styles.loved, { borderBottomColor: ds.c.line }]}>
      <View style={styles.row}>
        <BarMark name={bar.name} logoUrl={bar.avatarUrl} profileId={bar.id} size={52} />
        <PressableScale role="link" accessibilityLabel={[bar.name, bar.place, avg !== null ? `you average ${formatScore(avg)} over ${count}` : null].filter(Boolean).join('. ')} onPress={() => router.push(barHref(bar))} style={styles.flex}>
          <Headline numberOfLines={1}>{bar.name}</Headline>
          <Caption tone="muted">
            {[bar.place, avg !== null ? 'you average ' : null].filter(Boolean).join(' · ')}
            {avg !== null ? (
              <Text style={{ fontFamily: fontFamilies.monoMedium, color: ds.c.ink }}>{formatScore(avg)}</Text>
            ) : null}
            {avg !== null ? ` over ${count}` : null}
          </Caption>
        </PressableScale>
        <PressableScale
          role="button"
          aria-pressed
          accessibilityLabel={`Unlove ${bar.name}`}
          onPress={() => love.mutate({ profileId: bar.id, love: false })}
          disabled={love.isPending}
          style={styles.heart}
        >
          <IconSymbol name="heart.fill" size={22} color={ds.accentText} />
        </PressableScale>
      </View>
      {news ? (
        <PressableScale role="link" accessibilityLabel={`${news.text}, ${news.when}`} onPress={() => router.push(newsHref)} style={[styles.news, { backgroundColor: ds.c.surface }]}>
          <View style={[styles.dot, { backgroundColor: ds.accentText }]} />
          <DsText variant="body" style={styles.flex} numberOfLines={2}>
            {news.text}
          </DsText>
          <Caption tone="muted">{news.when}</Caption>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** A bar you want to go to: its mark, where it is and what it's pouring now. */
function WishRow({ bar }: { bar: LovedBar }) {
  const ds = useDs();
  const router = useRouter();
  const detail = [bar.place, bar.currentMenu ? `${bar.currentMenu.name} on now` : null].filter(Boolean).join(' · ');
  return (
    <PressableScale role="link" accessibilityLabel={`${bar.name}${detail ? `. ${detail}` : ''}`} onPress={() => router.push(barHref(bar))} style={[styles.row, styles.wish, { borderBottomColor: ds.c.line }]}>
      <BarMark name={bar.name} logoUrl={bar.avatarUrl} profileId={bar.id} size={44} />
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{bar.name}</Headline>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
    </PressableScale>
  );
}

/**
 * Collection's Bars: the bars you love (the heart on a bar's page). The ones
 * you've had drinks at, with your average there and their latest news, and a
 * heart to let go; then the ones you want to go to. From Google Maps brings
 * the bars someone saved there.
 */
export function CollectionBars() {
  const { data: bars = [], isLoading, error } = useLovedBars();
  const had = useMyHadDrinks().data ?? [];
  const [importing, setImporting] = useState(false);
  if (error) return <Body tone="muted">Couldn’t load your bars. Try again in a moment.</Body>;
  if (isLoading) return null;
  const hadAt = (id: string) => had.filter((h) => h.venue?.id === id);
  const been = bars.filter((b) => hadAt(b.id).length > 0);
  const want = bars.filter((b) => hadAt(b.id).length === 0);
  // One tree whether or not there are bars yet: loving the first ones mustn't remount the open import.
  return (
    <View style={styles.wrap}>
      {!bars.length ? <Body tone="muted">Tap the heart on a bar’s page to keep it here, with what it’s pouring now.</Body> : null}
      {been.length ? (
        <View style={styles.section}>
          <Headline role="heading">Bars you love</Headline>
          <Caption tone="muted">Hearted bars. You hear when they put out a new menu or a release.</Caption>
          <View role="list">
            {been.map((b) => (
              <View role="listitem" key={b.id}>
                <LovedRow bar={b} had={hadAt(b.id)} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {want.length ? (
        <View style={styles.section}>
          <Headline role="heading">Want to go</Headline>
          <Caption tone="muted">Not been yet.</Caption>
          <View role="list">
            {want.map((b) => (
              <View role="listitem" key={b.id}>
                <WishRow bar={b} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <GoogleImportEntry onPress={() => setImporting(true)} />
      <GoogleImportSheet visible={importing} onClose={() => setImporting(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
  section: { gap: space.xs },
  loved: { gap: space.sm + 2, paddingVertical: space.md + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wish: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  heart: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  news: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.control },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
});
