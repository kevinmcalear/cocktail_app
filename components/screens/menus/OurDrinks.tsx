import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, DsText, Field, GlassButton, Headline, PressableScale, Segmented, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { displayFaces, font, radius, space, STATUS } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useRepertoire } from '@/hooks/useRepertoire';
import { readableAccent } from '@/lib/color';
import type { RepertoireDrink } from '@/lib/repertoire';
import type { MenuDrink } from '@/types/menus';

import { BringBackSheet, monthYear, runLine } from './BringBackSheet';
import { menuDrinkHref } from './MenuSections';
import { MenuDrawing } from './page/MenuDrawing';

type Show = 'all' | 'past' | 'now';
/** On now drinks shown under All before "5 more on now". */
const ON_NOW_SHOWN = 3;


/**
 * A bar's whole repertoire (2027 canvas, Menu-l-drinks): every drink it has
 * put on a list, the ones off the list first with their runs and Bring back
 * (Menu-l-back-sheet), then what's on now. A drink never on a list isn't
 * here: the library has it.
 */
export function OurDrinks() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const column = usePageColumn();
  const { active } = useActiveVenue();
  const barId = active?.id ?? null;
  // Bring back writes to the live list: the menu team only (a bartender asks from the list itself, Menu-l-ask).
  const canBuild = !!useCapabilities(barId).data?.includes('menus');
  const { past, onNow, isLoading, error } = useRepertoire(barId);
  const [show, setShow] = useState<Show>('all');
  const [finding, setFinding] = useState(false);
  const [q, setQ] = useState('');
  const [back, setBack] = useState<RepertoireDrink<MenuDrink> | null>(null);
  const match = (r: RepertoireDrink<MenuDrink>) => !q.trim() || r.drink.name.toLowerCase().includes(q.trim().toLowerCase());
  const total = past.length + onNow.length;
  const firstOn = [...past, ...onNow].flatMap((r) => r.dates.map((d) => d.startsOn)).filter((s): s is string => !!s).sort()[0];
  const eyebrow = [active?.name, `${total} ${total === 1 ? 'drink' : 'drinks'}${firstOn ? ` since ${monthYear(firstOn)}` : ''}`].filter(Boolean).join(' · ');
  const pastShown = show === 'now' ? [] : past.filter(match);
  const nowAll = show === 'past' ? [] : onNow.filter(match);
  const nowShown = show === 'all' && !q ? nowAll.slice(0, ON_NOW_SHOWN) : nowAll;
  const rest = nowAll.length - nowShown.length;
  const open = (d: MenuDrink) => router.push(menuDrinkHref(d) as Href);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <PageHeader
          title="Our drinks"
          display
          above={
            <Caption tone="muted" style={styles.caps}>
              {eyebrow.toUpperCase()}
            </Caption>
          }
          onBack={() => (router.canGoBack() ? router.back() : router.navigate('/menus/all'))}
          backLabel="Back to Menus"
          backText="Menus"
          crumbs={[{ label: 'Menus', href: '/menus/all' }]}
          actionOnTop
          action={<GlassButton icon="magnifyingglass" accessibilityLabel="Find a drink" onPress={() => setFinding((f) => !f)} />}
        />
        {finding ? <Field label="Find a drink" hideLabel icon="magnifyingglass" placeholder="Find a drink" value={q} onChangeText={setQ} autoFocus /> : null}
        <Segmented
          variant="ink"
          accessibilityLabel="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: 'all', label: `All ${total}` },
            { value: 'past', label: `Past ${past.length}` },
            { value: 'now', label: `On now ${onNow.length}` },
          ]}
        />
        {error ? <Body tone="muted">Couldn’t load your drinks. Come back in a moment.</Body> : null}
        {!isLoading && !error && !total ? <Body tone="muted">No drinks on a list yet. A drink you put on a menu shows here, with its runs.</Body> : null}

        {pastShown.length ? (
          <View>
            <Head left="Off the list" right="Newest first" />
            {pastShown.map((r) => (
              <Row key={r.drink.id} entry={r} onOpen={() => open(r.drink)} action={canBuild ? <Button label="Bring back" variant="secondary" size="sm" onPress={() => setBack(r)} accessibilityHint={`Puts ${r.drink.name} on a list again`} /> : null} />
            ))}
          </View>
        ) : null}

        {nowShown.length ? (
          <View>
            <Head left="On now" right={String(onNow.length)} dot />
            {nowShown.map((r) => (
              <Row key={r.drink.id} entry={r} onOpen={() => open(r.drink)} />
            ))}
            {rest > 0 ? (
              <PressableScale role="button" accessibilityLabel={`${rest} more on now`} onPress={() => setShow('now')} style={[styles.more, { borderBottomColor: ds.c.line }]}>
                <View style={styles.grow}>
                  <Headline style={{ fontFamily: displayFaces[ds.displayFace].regular }}>{`${rest} more on now`}</Headline>
                  <Caption tone="muted" numberOfLines={1}>
                    {nowAll
                      .slice(ON_NOW_SHOWN)
                      .map((r) => r.drink.name)
                      .join(', ')}
                  </Caption>
                </View>
                <Caption tone="muted">›</Caption>
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      {back && barId && canBuild ? <BringBackSheet entry={back} barId={barId} barName={active?.name ?? null} onClose={() => setBack(null)} /> : null}
    </View>
  );
}

function Head({ left, right, dot }: { left: string; right: string; dot?: boolean }) {
  const ds = useDs();
  const green = readableAccent(STATUS.success, ds.c.ground);
  return (
    <View style={[styles.head, { borderBottomColor: ds.c.line }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: green }]} /> : null}
      <Caption tone="muted" color={dot ? green : undefined} style={[styles.caps, styles.grow]}>
        {left.toUpperCase()}
      </Caption>
      <Caption tone="muted" style={styles.caps}>
        {right.toUpperCase()}
      </Caption>
    </View>
  );
}

/** A drink with its runs: on now in green, then the runs before (two at most). */
function Row({ entry, onOpen, action }: { entry: RepertoireDrink<MenuDrink>; onOpen: () => void; action?: ReactNode }) {
  const ds = useDs();
  const green = readableAccent(STATUS.success, ds.c.ground);
  const { drink, dates } = entry;
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <PressableScale role="link" accessibilityLabel={`Open ${drink.name}`} onPress={onOpen} style={styles.rowMain}>
        <MenuDrawing itemId={drink.id} size="row" ink={entry.dates.some((d) => d.isCurrent) ? 'colour' : 'faded'} fallback={{ imageUrl: drink.imageUrl, glass: drink.glass }} />
        <View style={styles.grow}>
          <DsText variant="headline" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
            {drink.name}
          </DsText>
          {dates.slice(0, 2).map((d) => (
            <Caption key={`${d.listName}-${d.startsOn}`} tone="muted" color={d.isCurrent ? green : undefined} style={styles.run}>
              {runLine(d)}
            </Caption>
          ))}
        </View>
      </PressableScale>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg },
  caps: { letterSpacing: 1.5, ...font.medium },
  grow: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingTop: space.md, paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  run: { fontVariant: ['tabular-nums'] },
  more: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
