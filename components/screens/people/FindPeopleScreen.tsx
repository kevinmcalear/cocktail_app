import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Button, Caption, Field, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WebHead } from '@/components/WebHead';
import { radius, space } from '@/constants/tokens';
import { useBarmates, useFindPeople, useFollowers, usePeopleByUser, type FollowPerson } from '@/hooks/useFollows';

import { FollowText } from './Follow';
import { usePersonSub } from './PeopleList';
import { PersonRow } from './PersonRow';

/**
 * Find people (Kept-people): search people's public pages by name, and the
 * people on your bars' teams. Each row follows in place. Pages made from
 * menus can't be followed until their person claims them.
 */
export function FindPeopleScreen() {
  return (
    <BackbarTheme>
      <FindPeople />
    </BackbarTheme>
  );
}

function FindPeople() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const frame = usePageFrame('text');
  const bottom = useTabBarInset();
  const [term, setTerm] = useState('');
  const found = useFindPeople(term);
  const typed = term.trim().length >= 2;
  const mates = useBarmates();
  const mateIds = (mates.data ?? []).map((m) => m.userId);
  const matePages = usePeopleByUser(mateIds).data ?? [];
  const open = (handle: string) => router.push(`/p/${handle}` as Href);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Find people</title>
      </WebHead>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: frame.top, paddingBottom: bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={[frame.column, styles.page]}>
          <SubPageHead title="Find people" crumbs={[{ label: 'You', href: '/you' }, { label: 'People', href: '/people' }]} onBack={() => (router.canGoBack() ? router.back() : router.replace('/people' as Href))} />
          <Field label="Search people" hideLabel icon="magnifyingglass" placeholder="A name or @handle" value={term} onChangeText={setTerm} autoCapitalize="none" autoCorrect={false} autoFocus returnKeyType="search" />
          {typed ? (
            found.error ? (
              <View style={styles.note}>
                <Body tone="muted">Couldn’t search. Check your connection and try again.</Body>
                <Button label="Try again" variant="secondary" onPress={() => void found.refetch()} style={styles.start} />
              </View>
            ) : found.isLoading ? (
              <Caption tone="muted">Searching…</Caption>
            ) : found.data?.length ? (
              <View role="list">
                {found.data.map((p, i) => (
                  <FoundRow key={p.profileId} person={p} first={i === 0} onPress={() => open(p.handle)} />
                ))}
              </View>
            ) : (
              <Body tone="muted">{`Nobody with a public page matches “${term.trim()}”.`}</Body>
            )
          ) : null}
          {mates.data?.length ? (
            <View style={styles.section}>
              <Caption tone="muted" role="heading" style={styles.caps}>
                From your bars
              </Caption>
              <View role="list">
                {mates.data.map((m, i) => {
                  const page = matePages.find((p) => p.userId === m.userId);
                  return <PersonRow key={m.userId} name={page?.name ?? m.name} avatarUrl={page?.avatarUrl ?? m.avatarUrl} sub={m.line} first={i === 0} onPress={page ? () => open(page.handle) : undefined} end={<FollowText userId={m.userId} name={page?.name ?? m.name} />} />;
                })}
              </View>
            </View>
          ) : null}
          <View style={[styles.claim, { backgroundColor: ds.c.raised }]}>
            <IconSymbol name="person.2.fill" size={18} color={ds.c.muted} />
            <Body style={styles.flex}>Pages made from menus can be followed once the person claims theirs.</Body>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** A match: where they are, how many they've ranked, whether they follow you; Follow at the end once the page is claimed. */
function FoundRow({ person: p, first, onPress }: { person: FollowPerson; first: boolean; onPress: () => void }) {
  const followsYou = (useFollowers().data ?? []).includes(p.userId ?? '');
  const sub = usePersonSub(p, p.userId ? (followsYou ? 'follows you' : null) : 'not claimed yet');
  return <PersonRow name={p.name} avatarUrl={p.avatarUrl} sub={sub} first={first} onPress={onPress} end={p.userId ? <FollowText userId={p.userId} name={p.name} /> : undefined} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.lg },
  section: { gap: space.sm },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  note: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
  flex: { flex: 1 },
  claim: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
});
