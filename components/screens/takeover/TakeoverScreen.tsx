import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, GlassButton, Head, Segmented, Title, useDs, useGutter, useToast } from '@/components/ds';
import { BackButton } from '@/components/nav/PageFrame';
import { space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { shareOrCopy } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';

import { AddGuestSheet } from './AddGuestSheet';
import { Marks } from './parts';
import { TakeoverLists, TakeoverPeople, TakeoverRunSheet } from './TakeoverTabs';
import { useTakeoverModel } from './useTakeoverModel';

type Tab = 'lists' | 'people' | 'run';
const TABS = [
  { value: 'lists', label: 'Lists' },
  { value: 'people', label: 'People' },
  { value: 'run', label: 'Run sheet' },
] as const;

/**
 * The takeover page both bars share (boards Kept-takeover, Kept-takeover-desk):
 * the two bars' marks, the night, then Lists, People and Run sheet. Tabs on a
 * phone; on wide web the three side by side, with Share and Add a guest
 * bartender in the bar along the top.
 */
export function TakeoverScreen({ id }: { id: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useIsWideWeb();
  const toast = useToast();
  const m = useTakeoverModel(id);
  const [tab, setTab] = useState<Tab>('lists');
  const [adding, setAdding] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));
  const share = () => void shareOrCopy(`${siteOrigin()}/takeover/${id}`, m.title, 'menu');
  const eyebrow = ['Takeover', m.when].filter(Boolean).join(' · ');

  // A takeover list, or a list a takeover night runs.
  if (!m.data || !m.head || (!m.head.isTakeoverList && !m.head.eventId)) {
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.md, paddingHorizontal: gutter }]}>
        {wide ? null : <BackButton onPress={back} />}
        <Body tone="muted" style={styles.gap}>
          {m.loading ? 'Opening the takeover…' : 'This isn’t a takeover, it’s over, or it isn’t shared with you.'}
        </Body>
      </View>
    );
  }

  const lists = <TakeoverLists m={m} />;
  const people = <TakeoverPeople m={m} onAdd={() => setAdding(true)} />;
  const run = <TakeoverRunSheet m={m} menuId={id} />;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <ScrollView contentContainerStyle={styles.deskBody}>
          <View style={[styles.deskBar, { borderBottomColor: ds.c.line }]}>
            <Caption tone="muted" style={styles.flex} numberOfLines={1}>
              {[m.hostName, 'Events', m.title].filter(Boolean).join('  ›  ')}
            </Caption>
            <Button label="Share" icon="square.and.arrow.up" variant="secondary" size="sm" onPress={share} />
            {m.canStaff ? <Button label="Add a guest bartender" icon="person.badge.plus" size="sm" onPress={() => setAdding(true)} /> : null}
          </View>
          <View style={styles.deskHead}>
            <Marks marks={m.marks} size={52} />
            <View style={styles.headWords}>
              <Caption tone="muted" style={styles.caps}>
                {eyebrow}
              </Caption>
              <Head aria-level={1}>{m.title}</Head>
            </View>
          </View>
          <View style={styles.columns}>
            {[lists, people, run].map((col, i) => (
              <View key={i} style={[styles.column, i < 2 ? { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: ds.c.line } : null]}>
                {col}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.phoneBody, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
          <View style={styles.topBar}>
            <BackButton onPress={back} />
            <GlassButton icon="square.and.arrow.up" accessibilityLabel="Share" onPress={share} />
          </View>
          <Marks marks={m.marks} />
          <View style={styles.headWords}>
            <Caption tone="muted" style={styles.caps}>
              {eyebrow}
            </Caption>
            <Title aria-level={1}>{m.title}</Title>
            <Body tone="muted">One page: both bars see it and work on it.</Body>
          </View>
          <Segmented accessibilityLabel="Takeover" variant="pill" stretch value={tab} onChange={setTab} options={TABS} />
          {tab === 'lists' ? lists : tab === 'people' ? people : run}
        </ScrollView>
      )}
      {adding ? <AddGuestSheet m={m} visible onClose={() => setAdding(false)} onSent={(text) => toast.show({ title: text })} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gap: { marginTop: space.lg },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  phoneBody: { gap: space.md + 2 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headWords: { gap: space.xs + 2 },
  deskBody: { paddingBottom: space.xxxl },
  deskBar: { height: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingHorizontal: space.xxl, borderBottomWidth: StyleSheet.hairlineWidth },
  deskHead: { flexDirection: 'row', alignItems: 'center', gap: space.lg + 2, paddingTop: space.xl + 2, paddingHorizontal: space.xxl },
  columns: { flexDirection: 'row', marginTop: space.sm },
  column: { flex: 1, minWidth: 0, paddingHorizontal: space.xl, paddingTop: space.lg },
});
