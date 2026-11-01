import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, DsText, GlassButton, PressableScale, Sheet, SheetScrollView, Title, useDs, useSheetClose } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { TonightLabel } from '@/components/screens/tonight/TonightParts';
import { SearchField } from '@/components/search/SearchField';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useLovedBars } from '@/hooks/useKept';
import { useMenu } from '@/hooks/useMenus';
import { useRankFindNear } from '@/hooks/useRankFind';
import { findDrinks } from '@/lib/discover';
import { plural } from '@/lib/menus';
import { anywhereRows } from '@/lib/rankIt';

import { RankBarList } from './RankBarList';
import { RankRow } from './RankFindParts';

/** A drink picked to rank, and the bar it was had at (null: at home, or a bar the app doesn't list). */
export interface RankPick {
  itemId: string;
  name: string;
  barId: string | null;
}

interface RankFindSheetProps {
  visible: boolean;
  onPick: (pick: RankPick) => void;
  /** Snap the menu, with the search typed; null where there's no camera. */
  onSnap: ((query: string) => void) | null;
  /** The search to open with (coming back from the camera or Bring in). */
  initialQuery?: string;
  /** The menu just brought in, whose drinks lead the list. */
  broughtMenuId?: string | null;
  onClose: () => void;
  /** iOS: once the sheet has gone, so the rank sheet or the camera can open. */
  onDismiss: () => void;
}

interface OpenBar {
  id: string;
  name: string;
}

/**
 * The Rank it sheet (Loop-rank, Find the drink and A bar's menu): what did
 * you have? Near you, the drink on bars' lists on now; Anywhere, the classic
 * (at home, or a bar the app doesn't list); Can't find it? snaps the menu.
 * A bar opens its list on now. Picking a drink hands it to the rank sheet.
 */
export function RankFindSheet({ visible, onPick, onSnap, initialQuery = '', broughtMenuId = null, onClose, onDismiss }: RankFindSheetProps) {
  const [bar, setBar] = useState<OpenBar | null>(null);
  return (
    <BackbarTheme>
      <Sheet visible={visible} onClose={onClose} onDismiss={onDismiss} accessibilityLabel={bar ? `Rank a drink from ${bar.name}` : 'Rank it'} style={styles.sheet} keyboard header={<Head title={bar?.name ?? 'Rank it'} onBack={bar ? () => setBar(null) : null} />}>
        {bar ? <RankBarList bar={bar} onPick={onPick} /> : <Find onPick={onPick} onSnap={onSnap} onBar={setBar} initialQuery={initialQuery} broughtMenuId={broughtMenuId} />}
      </Sheet>
    </BackbarTheme>
  );
}

function Head({ title, onBack }: { title: string; onBack: (() => void) | null }) {
  const close = useSheetClose();
  return (
    <View style={styles.head}>
      {onBack ? <GlassButton accessibilityLabel="Back to Rank it" icon="chevron.left" onPress={onBack} /> : null}
      <Title role="heading" numberOfLines={1} style={styles.flex}>
        {title}
      </Title>
      <GlassButton accessibilityLabel="Close" icon="xmark" onPress={close} />
    </View>
  );
}

function Find({ onPick, onSnap, onBar, initialQuery, broughtMenuId }: { onPick: (p: RankPick) => void; onSnap: ((query: string) => void) | null; onBar: (bar: OpenBar) => void; initialQuery: string; broughtMenuId: string | null }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(initialQuery);
  const asked = query.trim().length >= 2;
  const near = useRankFindNear(query);
  const lists = useDrinkLists(asked);
  const classics = asked ? anywhereRows(findDrinks(lists.data ?? [], query)) : [];
  const loved = useLovedBars().data ?? [];
  const found = near.drinks.length + near.bars.length + classics.length > 0;
  const loading = asked && !found && (near.isLoading || lists.isPending);
  // One side can fail while the other answers: say so even with rows showing.
  const failed = asked && !loading && !!(near.error || lists.error);
  const barLeads = near.barsFirst || !near.drinks.length;
  const drinkRows = near.drinks.map((d, i) => <RankRow key={`${d.id}-${d.barId}`} itemId={d.id} imageUrl={d.imageUrl} name={d.name} sub={`${d.bar.name} · ${d.menuName ? `on ${d.menuName}` : 'on now'}`} first={i === 0 && !barLeads} onPress={() => onPick({ itemId: d.id, name: d.name, barId: d.barId })} />);
  const barRows = near.bars.map((b, i) => (
    <RankRow
      key={b.id}
      lead={<BarMark name={b.name} logoUrl={b.logo} brand={b.brand} profileId={b.id} size={40} filled />}
      name={b.name}
      sub={[b.onNow ? `${plural(b.onNow, 'drink')} on now` : null, b.locality ?? b.city].filter(Boolean).join(' · ')}
      first={i === 0 && barLeads}
      onPress={() => onBar({ id: b.id, name: b.name })}
    />
  ));
  return (
    <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
      <SearchField query={query} onQuery={setQuery} placeholder="What did you have?" autoFocus />
      {broughtMenuId ? <BroughtMenu menuId={broughtMenuId} query={query} onPick={onPick} /> : null}
      {!asked && loved.length ? (
        <Section title="Bars you love">
          {loved.map((b, i) => (
            <RankRow key={b.id} lead={<BarMark name={b.name} logoUrl={b.avatarUrl} profileId={b.id} size={40} filled />} name={b.name} sub={b.currentMenu ? `On now · ${b.currentMenu.name}` : b.place} first={i === 0} onPress={() => onBar({ id: b.id, name: b.name })} />
          ))}
        </Section>
      ) : null}
      {near.drinks.length || near.bars.length ? (
        <Section title={near.near ? 'Near you' : 'On now'}>
          {near.barsFirst ? barRows : drinkRows}
          {near.barsFirst ? drinkRows : barRows}
        </Section>
      ) : null}
      {classics.length ? (
        <Section title="Anywhere">
          {classics.map((c, i) => (
            <RankRow key={c.id} itemId={c.id} imageUrl={c.imageUrl} name={c.name} sub={c.sub} first={i === 0} onPress={() => onPick({ itemId: c.id, name: c.name, barId: null })} />
          ))}
        </Section>
      ) : null}
      {loading ? <Caption tone="muted">Looking…</Caption> : null}
      {failed ? <Caption tone="muted">Couldn’t search just now. Check your connection and try again.</Caption> : null}
      {asked && !found && !loading && !failed ? <Caption tone="muted">{`Nothing called “${query.trim()}” on a list we know.`}</Caption> : null}
      {onSnap ? (
        <Section title="Can’t find it?">
          <SnapRow onPress={() => onSnap(query)} />
        </Section>
      ) : null}
    </SheetScrollView>
  );
}

/** The menu just brought in: its drinks (those matching the search, else all), to pick the one you had. */
function BroughtMenu({ menuId, query, onPick }: { menuId: string; query: string; onPick: (p: RankPick) => void }) {
  const menu = useMenu(menuId);
  const all = (menu.data?.sections ?? []).flatMap((s) => s.drinks);
  if (!menu.data) return menu.isError ? <Caption tone="muted">Couldn’t load the menu you brought in. Search for the drink instead.</Caption> : <Caption tone="muted">Loading the menu…</Caption>;
  const hits = findDrinks(all, query);
  const shown = hits.length ? hits : all;
  if (!shown.length) return null;
  return (
    <Section title={`Just brought in · ${menu.data.name}`}>
      {shown.map((d, i) => (
        <RankRow key={d.id} itemId={d.id} name={d.name} sub={d.line || null} first={i === 0} onPress={() => onPick({ itemId: d.id, name: d.name, barId: null })} />
      ))}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View role="region" aria-label={title} style={styles.section}>
      <TonightLabel title={title} />
      <View role="list">{children}</View>
    </View>
  );
}

/** "Snap the menu" in a grouped row with the camera. */
function SnapRow({ onPress }: { onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="Snap the menu" onPress={onPress} style={[styles.group, { backgroundColor: ds.c.surface }]}>
      <IconSymbol name="camera" size={20} color={ds.c.ink} />
      <DsText variant="body" style={styles.flex}>
        Snap the menu
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  sheet: { height: '85%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md },
  flex: { flex: 1, minWidth: 0 },
  body: { padding: space.lg, gap: space.lg },
  section: { gap: space.xs },
  group: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
});
