import { useNetInfo } from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import { use, useDeferredValue, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { AddBarSheet } from '@/components/screens/home/AddBar';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDrafts } from '@/hooks/useDrafts';
import { useMineFacts } from '@/hooks/useMineFacts';
import { recentMatchesContext } from '@/hooks/useTrackRecent';
import type { SearchMine } from '@/hooks/useSearchMine';
import { belongsHere, inSelectedContext } from '@/lib/barContextFilter';
import { fallbackGlass } from '@/lib/itemRoutes';
import type { City } from '@/lib/discover';
import type { Area } from '@/lib/nearMe';
import { friendlyWhen, menuFacts } from '@/lib/searchCaptions';
import { scopeOptions, type SearchScope, type SearchShow, type ShowCounts } from '@/lib/searchScope';
import { useRecentActivityStore, type RecentActivity } from '@/store/useRecentActivityStore';
import { useRecentSearches } from '@/store/useRecentSearches';
import type { SearchItem } from '@/types/search';

import { MineResults } from './MineResults';
import { PublicResults } from './PublicResults';
import { DrawnSearch, ResultGroup, ResultRow } from './ResultRows';
import { ScopeSwitch } from './ScopeSwitch';
import { SearchField } from './SearchField';
import { SearchOffline } from './SearchOffline';
import { StyleTiles } from './SearchParts';
import { RecentSearches } from './RecentSearches';

const NO_ITEMS: SearchItem[] = [];

/** Discover's part in the search: its area and filters. */
export interface SearchArea {
  /** "This area" on the map, else the area chip's words. Null when the area is everywhere, so there's no area scope. */
  label: string | null;
  area: Area;
  kinds: readonly string[];
  onKind: (kind: string) => void;
  /** A city the search names: Discover moves there. */
  onPlace: (city: City) => void;
}

interface HeadProps {
  query: string;
  onQuery: (query: string) => void;
  scope: SearchScope;
  onScope: (scope: SearchScope) => void;
  mine: SearchMine;
  area?: SearchArea | null;
  autoFocus?: boolean;
  onDone?: () => void;
  /** Return in the field; Done (onDone) when not given. */
  onSubmit?: () => void;
  /** The ⌘K palette: "Search or add" with the esc key cap at the field's end (Prod-desk-cmdk). */
  keys?: boolean;
}

/** What the field says it searches: the venue, the area or everywhere. */
function searchPlaceholder(scope: SearchScope, mine: SearchMine, area?: SearchArea | null): string {
  if (scope === 'everywhere') return 'Search bars, drinks and people';
  if (scope === 'area') return `Search ${area?.label === 'This area' ? 'this area' : (area?.label ?? 'here')}`;
  return `Search ${mine.venueId ? mine.label : 'your drinks'}`;
}

/** The search field and where it looks: ⌘K's field with its place menu, or wide Discover's field over its scope switch. */
export function SearchHead({ query, onQuery, scope, onScope, mine, area, autoFocus, onDone, onSubmit, keys }: HeadProps) {
  const ds = useDs();
  const gutter = useGutter();
  const options = scopeOptions(mine.label, area?.label ?? null);
  const placeholder = searchPlaceholder(scope, mine, area);
  if (keys) {
    // The palette searches where you are and adds there; "Search everywhere" at the results' end widens it.
    return (
      <View style={styles.head}>
        <SearchField query={query} onQuery={onQuery} placeholder="Search or add" autoFocus={autoFocus} onSubmit={onSubmit ?? onDone} onDone={onDone} keys />
        <View style={[styles.rule, { marginHorizontal: -gutter, backgroundColor: ds.c.line }]} />
      </View>
    );
  }
  return (
    <View style={styles.head}>
      <SearchField query={query} onQuery={onQuery} placeholder={placeholder} autoFocus={autoFocus} onSubmit={onSubmit ?? onDone} onDone={onDone} />
      <ScopeSwitch options={options} scope={scope} onScope={onScope} />
    </View>
  );
}

interface BodyProps {
  query: string;
  scope: SearchScope;
  onScope: (scope: SearchScope) => void;
  mine: SearchMine;
  area?: SearchArea | null;
  /** The palette closes itself when a jump stays on the same page (Library to a Library filter). */
  onJump?: () => void;
  /** Rows of the door's own (⌘K's Pick for me): with Techniques and History while nothing is typed, after the results once something is. */
  commands?: ReactNode;
  /** The ⌘K palette: "Search everywhere for …" is a slim row there, not a button (nav-search-desk-palette). */
  palette?: boolean;
  /** The type chips' pick, and where the results say how many of each they found. */
  show?: SearchShow;
  /** Sets the type chips' pick: Can make's Show all, at a venue's Everywhere. */
  onShow?: (show: SearchShow) => void;
  onCounts?: (counts: ShowCounts) => void;
  /** The search tab: suggestions finish the typed word, a Top hit leads, and Browse by style waits before typing. */
  typeAhead?: (query: string) => void;
}

/** What the search finds in its scope, or what was opened lately while nothing is typed. */
export function SearchBody({ query: typed, scope, onScope, mine, area, onJump, commands, palette, show, onShow, onCounts, typeAhead }: BodyProps) {
  const router = useRouter();
  const signedIn = !!useAuth().user;
  const [adding, setAdding] = useState(false);
  const openBar = (ref: string) => {
    setAdding(false);
    router.push(`/p/${ref}`);
  };
  // The field never waits on the results: they catch up with the typing when there's time (a letter typed meanwhile starts them again).
  const query = useDeferredValue(typed);
  // Android's search has no suggestions or Top hit (Miss-search-and): its Recent still fills the field.
  const ahead = use(DrawnSearch) ? undefined : typeAhead;
  const offline = useNetInfo().isConnected === false;
  if (!typed.trim() || !query.trim()) return <Recent scope={scope} mine={mine} onJump={onJump} commands={commands} onTerm={typeAhead} />;
  if (offline) return <SearchOffline query={query} mine={mine} />;
  if (scope === 'mine') return <MineResults query={query} mine={mine} onEverywhere={() => onScope('everywhere')} commands={commands} palette={palette} show={show} onCounts={onCounts} typeAhead={ahead} />;
  return (
    <>
      <PublicResults
        query={query}
        area={scope === 'area' && area ? area.area : null}
        kinds={area?.kinds}
        onKind={area?.onKind}
        onPlace={area?.onPlace}
        onEverywhere={() => onScope('everywhere')}
        mine={mine}
        show={show}
        canMake={scope === 'everywhere'}
        onShow={onShow}
        onCounts={onCounts}
        typeAhead={ahead}
        onAddBar={signedIn ? () => setAdding(true) : undefined}
      />
      {commands}
      {adding ? <AddBarSheet onClose={() => setAdding(false)} onAdded={(v) => openBar(v.handle)} onOpenExisting={openBar} /> : null}
    </>
  );
}

const KIND_LABEL: Record<RecentActivity['kind'], string> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine', ingredient: 'Ingredient', menu: 'Menu', bar: 'Bar', flavor: 'Flavor map' };
const JUMPS = [
  { label: 'Classics', href: '/drinks?show=staff', icon: 'star' },
  { label: 'On menu now', href: '/drinks?show=on-menu', icon: 'list.bullet' },
  { label: 'Old drinks', href: '/drinks?show=past', icon: 'clock' },
  { label: 'Drafts', href: '/drafts', icon: 'pencil' },
  { label: 'Ingredients', href: '/drinks?show=ingredients', icon: 'drop.fill' },
] as const;

/** The ways in that aren't a search: the flavor map, the history and the techniques (prep-flavor-entry), each when it's switched on. */
const ENTRIES = [
  { title: 'Flavor map', caption: 'What goes with what, counted from real drinks', icon: 'target', href: '/flavor-map' },
  { title: 'Cocktail history', caption: "Every classic's family tree, back to the punch bowl", icon: 'book', href: '/history' },
  { title: 'Techniques and equipment', caption: 'Foams, clarifying, milk punch, infusions, and the kit for each', icon: 'flask', href: '/techniques' },
] as const;

function Recent({ scope, mine, onJump, commands, onTerm }: { scope: SearchScope; mine: SearchMine; onJump?: () => void; commands?: ReactNode; onTerm?: (term: string) => void }) {
  const ds = useDs();
  const browse = !!onTerm;
  const router = useRouter();
  const all = useRecentActivityStore((s) => s.items);
  const clear = useRecentActivityStore((s) => s.clear);
  const terms = useRecentSearches((s) => s.terms);
  const myVenueIds = useActiveVenue().venues.map((v) => v.id);
  const venue = scope === 'mine' && !!mine.venueId;
  const facts = useMineFacts(venue ? mine.venueId : null, NO_ITEMS);
  const { drafts } = useDrafts();
  const [now] = useState(() => Date.now());
  const here = (r: RecentActivity) => (scope === 'mine' ? recentMatchesContext(r, mine.contextIds) : belongsHere(r.barId, myVenueIds, mine.venueId));
  const recent = all.filter(here);
  const open = (r: RecentActivity) => router.push((r.kind === 'menu' && !r.isDraft ? `/menus/${encodeURIComponent(r.id)}` : r.href) as never);
  // "Cocktail · 2 hours ago", "Menu · on now · yesterday" (nav-search-empty-venue).
  const caption = (r: RecentActivity) => {
    const onNow = r.kind === 'menu' && !r.isDraft && menuFacts(r.id, [], facts) === 'On now';
    return [r.isDraft ? 'Draft' : KIND_LABEL[r.kind], onNow ? 'on now' : null, friendlyWhen(r.at, now)].filter(Boolean).join(' · ');
  };
  const drink = (k: RecentActivity['kind']) => k === 'cocktail' || k === 'beer' || k === 'wine';
  const draftCount = venue ? drafts.filter((d: { bar_id?: string | null }) => inSelectedContext(d.bar_id, mine.contextIds)).length : 0;
  const go = (href: string) => {
    onJump?.();
    router.navigate(href as never);
  };
  const clearAll = () => {
    useRecentSearches.getState().clear();
    clear((r) => !here(r));
  };
  // The ways in wait until there's nothing of yours to go back to (search2).
  const history = browse && (terms.length > 0 || recent.length > 0);
  return (
    <View style={styles.empty}>
      {onTerm && terms.length ? <RecentSearches terms={terms} onPick={onTerm} onClear={clearAll} /> : null}
      <ResultGroup
        label={browse ? 'Opened lately' : 'Recent'}
        plain
        items={recent}
        // The palette keeps its rows bare: the arrow keys walk them.
        action={browse && !terms.length ? { label: 'Clear', onPress: clearAll } : undefined}
        render={(r) => {
          const x = browse && Platform.OS !== 'android' ? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} /> : undefined;
          return drink(r.kind) ? (
            <DrinkRow key={`${r.kind}-${r.id}`} name={r.title} itemId={r.id} imageUrl={r.imageUrl ?? null} glass={fallbackGlass(r.kind === 'beer' ? 'Beer' : r.kind === 'wine' ? 'Wine' : 'Cocktail')} caption={caption(r)} displayName trailing={x} onPress={() => open(r)} />
          ) : (
            <ResultRow
              key={`${r.kind}-${r.id}`}
              title={r.title}
              caption={caption(r)}
              icon={r.kind === 'menu' ? 'list.bullet' : r.kind === 'flavor' ? 'target' : 'drop.fill'}
              accentIcon={r.kind === 'flavor'}
              avatar={r.kind === 'bar' ? { uri: r.imageUrl ?? null } : undefined}
              ingredient={r.kind === 'ingredient' ? { id: r.isDraft ? null : r.id } : undefined}
              trailing={x}
              onPress={() => open(r)}
            />
          );
        }}
      />
      {venue && !history ? (
        <View style={styles.jumps}>
          <Caption tone="muted" role="heading" style={styles.cap}>
            Jump to
          </Caption>
          <View style={styles.chips}>
            {/* Drafts stays with its count, even at none (decided 10 Oct, b53); outlined chips, as drawn. */}
            {JUMPS.map((j) => (
              <Chip
                key={j.label}
                label={j.label}
                count={j.label === 'Drafts' ? draftCount : undefined}
                leading={browse ? <IconSymbol name={j.icon} size={16} color={ds.accentText} /> : undefined}
                quiet={!browse}
                selected={false}
                onPress={() => go(j.href)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {browse && !history ? <StyleTiles /> : null}
      {commands}
      {history ? null : (
        <View>
          {ENTRIES.map((e) => (
            <ResultRow key={e.href} title={e.title} caption={e.caption} icon={e.icon} accentIcon={e.href === '/flavor-map'} onPress={() => go(e.href)} />
          ))}
        </View>
      )}
      {browse ? null : (
        <Body tone="muted">
          {scope === 'mine'
            ? `Type a drink, an ingredient or a menu. Switch to Everywhere for other bars, bartenders and classics.`
            : scope === 'area'
              ? "Search a bar's name, a drink, an ingredient or a style."
              : 'Search bars, the drinks they pour, bartenders, classics and ingredients.'}
        </Body>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.md },
  // The palette's line under its field, edge to edge across the card.
  rule: { height: StyleSheet.hairlineWidth },
  empty: { gap: space.lg },
  jumps: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cap: { letterSpacing: 0.8, textTransform: 'uppercase' },
});
