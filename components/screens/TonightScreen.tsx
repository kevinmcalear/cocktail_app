import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, GlassButton, Headline, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { MenuOnRow } from '@/components/screens/menus/MenuRows';
import { MenuSections } from '@/components/screens/menus/MenuSections';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { displayFaces, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useServiceDate } from '@/hooks/useServiceDay';
import { useTonight } from '@/hooks/useTonight';
import { dotLine, plural, tonightLine } from '@/lib/menus';

/**
 * Tonight: what's pouring at this venue. A card for each menu that's on, then
 * each menu as its own block, in running order under its own section headers
 * with counts. Rows show the drink's line, NEW and its price; no scores (it's
 * the venue's own menu). One job: am I ready for tonight?
 */
export function TonightScreen() {
  const ds = useDs();
  const column = usePageColumn();
  const bottom = useTabBarInset();
  const { active, isLoading: venuesLoading } = useActiveVenue();
  const router = useRouter();
  const { menus, blocks, drinks, isLoading } = useTonight(active?.id ?? null);
  const [now] = useState(() => Date.now());
  // The service day, as on the tab: until 6am it's still last night. On web it waits for
  // hydration (the build's date isn't the device's); a blank line keeps the header's height.
  const date = useServiceDate();
  const openMenus = () => router.push('/menus/all');

  const empty = !venuesLoading && !isLoading && drinks.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={blocks.filter((b) => b.sections.length)}
        keyExtractor={(b) => b.menu.id}
        renderItem={({ item: block }) => {
          const count = block.sections.reduce((n, sec) => n + sec.drinks.length, 0);
          return (
            <View style={styles.block}>
              <View>
                <DsText variant="title" role="heading" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
                  {block.menu.name}
                </DsText>
                <Caption tone="muted">{`${plural(count, 'drink')}, in running order`}</Caption>
              </View>
              <MenuSections
                variant="page"
                sections={block.sections.map((sec) => ({ ...sec, drinks: sec.drinks.map((d) => ({ ...d, line: dotLine(d.line) })) }))}
                newIds={new Set(block.sections.flatMap((sec) => sec.drinks.filter((d) => d.isNew).map((d) => d.id)))}
              />
            </View>
          );
        }}
        contentContainerStyle={[column, { paddingBottom: bottom }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <PageHeader
              title="Tonight"
              wordmark
              subtitle={date ? tonightLine(date, menus, drinks.length) : '\u00a0'}
              action={active ? <GlassButton icon="list.bullet" label="Menus" accessibilityLabel="All menus" onPress={openMenus} /> : null}
            />
            {/* The This week strip goes here (PR #491), above the menus that are on. */}
            {menus.map((m) => (
              <MenuOnRow key={m.id} menu={m} now={now} />
            ))}
          </View>
        }
        ListEmptyComponent={
          empty ? (
            <View style={styles.empty}>
              <Headline>{active ? `No current menu at ${active.name}` : 'No venue yet'}</Headline>
              <Body tone="muted">
                {active
                  ? 'When a menu is set as current, its drinks show here in running order.'
                  : 'Once a venue adds you to its team, tonight’s menu shows here.'}
              </Body>
              {active ? <Button label="See all menus" variant="secondary" onPress={openMenus} style={styles.emptyButton} /> : null}
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.sm, paddingBottom: space.lg },
  block: { gap: space.lg, paddingBottom: space.xxl },
  emptyButton: { alignSelf: 'flex-start', marginTop: space.sm },
  empty: { gap: space.sm, paddingVertical: space.xl },
});
