import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Chip, Field, GlassButton, Headline, PressableScale, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, radius, space, STATUS } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useRepertoire } from '@/hooks/useRepertoire';
import { useViewAs } from '@/hooks/useViewAs';
import { readableAccent } from '@/lib/color';
import { isMenuTeam, isStaffLens, menuLens } from '@/lib/menuLens';
import type { RepertoireDrink } from '@/lib/repertoire';
import type { MenuDrink } from '@/types/menus';

import { menuDrinkHref } from './MenuSections';
import { ON_NOW_SHOWN, ourDrinksEyebrow, runLine, shownGroups, type OurDrinksFilter } from './ourDrinks';
import { BringBackSheet } from './page/BringBackSheet';
import { MenuDrawing } from './page/MenuDrawing';

/**
 * Our drinks (2027 canvas, Menu-l-drinks, -dark, -and): every drink the bar
 * has had on a list, each with its dated runs. Off the list first, newest
 * first, each with Bring back; then what's on now. The team reads it; the
 * menu team brings a drink back, a bartender asks to.
 */
export function OurDrinksScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const column = usePageColumn();
  const { active, venues } = useActiveVenue();
  const barId = active?.id ?? null;
  const caps = useCapabilities(barId).data;
  const { viewAsRoleLevel } = useViewAs();
  const roleLevel = venues.find((v) => v.id === barId)?.roleLevel ?? null;
  const lens = menuLens({ barId, caps: Array.isArray(caps) ? caps : null, roleLevel, mine: false, viewAs: viewAsRoleLevel });
  const staff = isStaffLens(lens);
  const canBring = isMenuTeam(lens) || lens === 'bartender';
  const rep = useRepertoire(staff ? barId : null);
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<OurDrinksFilter>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [back, setBack] = useState<RepertoireDrink<MenuDrink> | null>(null);
  const green = readableAccent(STATUS.success, ds.c.ground);
  const shown = shownGroups(rep, filter, query);
  const total = rep.past.length + rep.onNow.length;
  const folded = filter === 'all' && !query.trim() && shown.onNow.length > ON_NOW_SHOWN + 1;
  const onNow = folded ? shown.onNow.slice(0, ON_NOW_SHOWN) : shown.onNow;
  const more = folded ? shown.onNow.slice(ON_NOW_SHOWN) : [];
  const loaded = staff && !rep.isLoading && !rep.error;
  const filters: { value: OurDrinksFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: total },
    { value: 'past', label: 'Past', count: rep.past.length },
    { value: 'on', label: 'On now', count: rep.onNow.length },
  ];

  // The row opens the drink; Bring back sits beside it, not inside the link.
  const row = (d: RepertoireDrink<MenuDrink>, past: boolean) => (
    <View key={d.drink.id} style={[styles.row, { borderTopColor: ds.c.lineStrong }]}>
      <PressableScale
        role="link"
        accessibilityLabel={[d.drink.name, ...d.dates.map((r) => runLine(r, now))].join(', ')}
        onPress={() => router.push(menuDrinkHref(d.drink) as never)}
        style={styles.link}
      >
        <MenuDrawing itemId={d.drink.id} size="menuRow" ink={past ? 'faded' : 'colour'} bare fallback={{ imageUrl: d.drink.imageUrl, glass: d.drink.glass }} />
        <View style={styles.grow}>
          <Headline numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
            {d.drink.name}
          </Headline>
          {d.dates.map((r, i) => (
            <Caption key={i} color={r.isCurrent ? green : ds.c.muted} style={font.figures}>
              {runLine(r, now)}
            </Caption>
          ))}
        </View>
      </PressableScale>
      {past && canBring ? <Button label="Bring back" variant="secondary" size="sm" accessibilityLabel={`Bring back ${d.drink.name}`} onPress={() => setBack(d)} /> : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled">
        <PageHeader
          title="Our drinks"
          display
          above={
            <Caption tone="muted" style={styles.caps}>
              {(loaded ? ourDrinksEyebrow(active?.name ?? '', rep) : (active?.name ?? '')).toUpperCase()}
            </Caption>
          }
          onBack={() => (router.canGoBack() ? router.back() : router.navigate('/menus/all'))}
          backLabel="Back to Menus"
          crumbs={[{ label: 'Menus', href: '/menus/all' }]}
          actionOnTop
          action={staff ? <GlassButton icon="magnifyingglass" accessibilityLabel="Search our drinks" onPress={() => setSearching((s) => !s)} /> : null}
        />
        {searching ? <Field label="Search our drinks" hideLabel icon="magnifyingglass" placeholder="Search our drinks" value={query} onChangeText={setQuery} autoFocus returnKeyType="search" /> : null}
        {loaded && total ? (
          <View role="radiogroup" aria-label="Show" style={styles.filters}>
            {filters.map((f) => (
              <Chip key={f.value} label={`${f.label} ${f.count}`} accessibilityLabel={`${f.label}, ${f.count}`} selected={filter === f.value} quiet onPress={() => setFilter(f.value)} />
            ))}
          </View>
        ) : null}

        {!staff ? <Body tone="muted">{`Our drinks is for the team${active?.name ? ` at ${active.name}` : ''}.`}</Body> : null}
        {staff && rep.error ? <Body tone="muted">Couldn’t load our drinks. Try again in a moment.</Body> : null}
        {loaded && !total ? <Body tone="muted">No drink has been on a list yet. Each one shows here with its dates once it goes on one.</Body> : null}
        {loaded && total > 0 && query.trim() && !shown.past.length && !shown.onNow.length ? <Body tone="muted">{`No drink called “${query.trim()}”.`}</Body> : null}

        {shown.past.length ? (
          <View>
            <GroupHead title="Off the list" aside="Newest first" />
            {shown.past.map((d) => row(d, true))}
            <View style={[styles.close, { borderTopColor: ds.c.lineStrong }]} />
          </View>
        ) : null}
        {shown.onNow.length ? (
          <View>
            <GroupHead title="On now" aside={String(shown.onNow.length)} dot={green} />
            {onNow.map((d) => row(d, false))}
            {more.length ? (
              <PressableScale role="button" accessibilityLabel={`${more.length} more on now`} onPress={() => setFilter('on')} style={[styles.more, { borderTopColor: ds.c.lineStrong }]}>
                <View style={styles.grow}>
                  <Headline style={{ fontFamily: displayFaces[ds.displayFace].regular }}>{`${more.length} more on now`}</Headline>
                  <Caption tone="muted" numberOfLines={1}>
                    {`${more
                      .slice(0, 3)
                      .map((d) => d.drink.name)
                      .join(', ')}${more.length > 3 ? '…' : ''}`}
                  </Caption>
                </View>
                <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
              </PressableScale>
            ) : null}
            <View style={[styles.close, { borderTopColor: ds.c.lineStrong }]} />
          </View>
        ) : null}
      </ScrollView>
      {back && barId ? <BringBackSheet drink={back} barId={barId} barName={active?.name ?? ''} asking={lens === 'bartender'} onClose={() => setBack(null)} /> : null}
    </View>
  );
}

function GroupHead({ title, aside, dot }: { title: string; aside: string; dot?: string }) {
  return (
    <View style={styles.head}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Caption tone="muted" role="heading" style={[styles.caps, styles.grow]}>
        {title.toUpperCase()}
      </Caption>
      <Caption tone="muted" style={styles.caps}>
        {aside.toUpperCase()}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg },
  caps: { letterSpacing: 1.5, ...font.medium },
  grow: { flex: 1, minWidth: 0, gap: 3 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.lg, paddingBottom: space.md },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  link: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
  more: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  close: { borderTopWidth: StyleSheet.hairlineWidth },
});
