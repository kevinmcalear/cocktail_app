import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, useDs, useGutter } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDrafts } from '@/hooks/useDrafts';
import { useMineFacts } from '@/hooks/useMineFacts';
import { recentMatchesContext } from '@/hooks/useTrackRecent';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import type { SearchMine } from '@/hooks/useSearchMine';
import { belongsHere, inSelectedContext } from '@/lib/barContextFilter';
import { fallbackGlass } from '@/lib/itemRoutes';
import type { Area } from '@/lib/nearMe';
import { friendlyWhen, menuFacts } from '@/lib/searchCaptions';
import { scopeOptions, type SearchScope } from '@/lib/searchScope';
import { useRecentActivityStore, type RecentActivity } from '@/store/useRecentActivityStore';
import type { SearchItem } from '@/types/search';

import { MineResults } from './MineResults';
import { PublicResults } from './PublicResults';
import { ResultGroup, ResultRow } from './ResultRows';
import { ScopeSwitch } from './ScopeSwitch';
import { KeyCap, SearchField } from './SearchField';

const NO_ITEMS: SearchItem[] = [];

/** Discover's part in the search: its area and filters. */
export interface SearchArea {
  /** "This area" on the map, else the area chip's words. Null when the area is everywhere, so there's no area scope. */
  label: string | null;
  area: Area;
  kinds: readonly string[];
  onKind: (kind: string) => void;
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
  /** The ⌘K palette: the esc key cap and "Press tab to switch" (nav-search-desk-palette). */
  keys?: boolean;
  /** The search tab: Cancel beside the field while it's in use. */
  cancel?: boolean;
}

/** What the field says it searches: the venue, the area or everywhere. */
export function searchPlaceholder(scope: SearchScope, mine: SearchMine, area?: SearchArea | null): string {
  if (scope === 'everywhere') return 'Search bars, drinks and people';
  if (scope === 'area') return `Search ${area?.label === 'This area' ? 'this area' : (area?.label ?? 'here')}`;
  return `Search ${mine.venueId ? mine.label : 'your drinks'}`;
}

/** The search field and where it looks. The same at every door: the tab, ⌘K, Library and Discover. */
export function SearchHead({ query, onQuery, scope, onScope, mine, area, autoFocus, onDone, onSubmit, keys, cancel }: HeadProps) {
  const ds = useDs();
  const gutter = useGutter();
  const options = scopeOptions(mine.label, area?.label ?? null);
  const placeholder = searchPlaceholder(scope, mine, area);
  return (
    <View style={styles.head}>
      <SearchField query={query} onQuery={onQuery} placeholder={placeholder} autoFocus={autoFocus} onSubmit={onSubmit ?? onDone} onDone={onDone} keys={keys} cancel={cancel} />
      {keys ? <View style={[styles.rule, { marginHorizontal: -gutter, backgroundColor: ds.c.line }]} /> : null}
      {keys ? (
        <View style={styles.scopeRow}>
          <View style={styles.scope}>
            <ScopeSwitch options={options} scope={scope} onScope={onScope} />
          </View>
          <View style={styles.hint}>
            <Caption tone="muted">Press</Caption>
            <KeyCap label="tab" />
            <Caption tone="muted">to switch</Caption>
          </View>
        </View>
      ) : (
        <ScopeSwitch options={options} scope={scope} onScope={onScope} />
      )}
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
  /** Rows of the door's own (⌘K's Commands group, Pick for me): with Techniques and History while nothing is typed, after the results once something is. */
  commands?: ReactNode;
  /** The ⌘K palette: "Search everywhere for …" is a slim row there, not a button (nav-search-desk-palette). */
  palette?: boolean;
}

/** What the search finds in its scope, or what was opened lately while nothing is typed. */
export function SearchBody({ query, scope, onScope, mine, area, onJump, commands, palette }: BodyProps) {
  if (!query.trim()) return <Recent scope={scope} mine={mine} onJump={onJump} commands={commands} />;
  if (scope === 'mine') return <MineResults query={query} mine={mine} onEverywhere={() => onScope('everywhere')} commands={commands} palette={palette} />;
  return (
    <>
      <PublicResults
        query={query}
        area={scope === 'area' && area ? area.area : null}
        kinds={area?.kinds}
        onKind={area?.onKind}
        onEverywhere={() => onScope('everywhere')}
        mine={mine}
      />
      {commands}
    </>
  );
}

const KIND_LABEL: Record<RecentActivity['kind'], string> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine', ingredient: 'Ingredient', menu: 'Menu', bar: 'Bar', flavor: 'Flavor map' };
const JUMPS = [
  { label: 'On menu now', href: '/library?show=on-menu' },
  { label: 'Staff list', href: '/library?show=staff' },
  { label: 'Past', href: '/library?show=past' },
  { label: 'Drafts', href: '/drafts' },
  { label: 'Ingredients', href: '/library?show=ingredients' },
] as const;

/** The ways in that aren't a search: the flavor map, the history and the techniques (prep-flavor-entry), each when it's switched on. */
const ENTRIES = [
  { title: 'Flavor map', caption: 'What goes with what, counted from real drinks', icon: 'target', href: '/flavor-map', feature: 'flavorMap' },
  { title: 'Cocktail history', caption: "Every classic's family tree, back to the punch bowl", icon: 'book', href: '/history', feature: 'history' },
  { title: 'Techniques and equipment', caption: 'Foams, clarifying, milk punch, infusions, and the kit for each', icon: 'flask', href: '/techniques', feature: 'techniques' },
] as const;

function Recent({ scope, mine, onJump, commands }: { scope: SearchScope; mine: SearchMine; onJump?: () => void; commands?: ReactNode }) {
  const router = useRouter();
  const all = useRecentActivityStore((s) => s.items);
  const myVenueIds = useActiveVenue().venues.map((v) => v.id);
  const venue = scope === 'mine' && !!mine.venueId;
  const facts = useMineFacts(venue ? mine.venueId : null, NO_ITEMS);
  const { drafts } = useDrafts();
  const { has } = useVenueFeatures();
  const [now] = useState(() => Date.now());
  const recent = all.filter((r) => (scope === 'mine' ? recentMatchesContext(r, mine.contextIds) : belongsHere(r.barId, myVenueIds, mine.venueId)));
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
  return (
    <View style={styles.empty}>
      <ResultGroup
        label="Recent"
        items={recent}
        render={(r) =>
          drink(r.kind) ? (
            <DrinkRow key={`${r.kind}-${r.id}`} name={r.title} itemId={r.id} imageUrl={r.imageUrl ?? null} glass={fallbackGlass(r.kind === 'beer' ? 'Beer' : r.kind === 'wine' ? 'Wine' : 'Cocktail')} caption={caption(r)} onPress={() => open(r)} />
          ) : (
            <ResultRow
              key={`${r.kind}-${r.id}`}
              title={r.title}
              caption={caption(r)}
              icon={r.kind === 'menu' ? 'list.bullet' : r.kind === 'flavor' ? 'target' : 'drop.fill'}
              accentIcon={r.kind === 'flavor'}
              avatar={r.kind === 'bar' ? { uri: r.imageUrl ?? null } : undefined}
              ingredient={r.kind === 'ingredient' ? { id: r.isDraft ? null : r.id } : undefined}
              onPress={() => open(r)}
            />
          )
        }
      />
      {venue ? (
        <View style={styles.jumps}>
          <Caption tone="muted" role="heading" style={styles.cap}>
            Jump to
          </Caption>
          <View style={styles.chips}>
            {/* Drafts stays with its count, even at none (decided 10 Oct, b53); outlined chips, as drawn. */}
            {JUMPS.map((j) => (
              <Chip key={j.label} label={j.label} count={j.label === 'Drafts' ? draftCount : undefined} quiet selected={false} onPress={() => go(j.href)} />
            ))}
          </View>
        </View>
      ) : null}
      {commands}
      <View>
        {ENTRIES.filter((e) => has(e.feature)).map((e) => (
          <ResultRow key={e.href} title={e.title} caption={e.caption} icon={e.icon} accentIcon={e.href === '/flavor-map'} onPress={() => go(e.href)} />
        ))}
      </View>
      <Body tone="muted">
        {scope === 'mine'
          ? `Type a drink, an ingredient or a menu. Switch to Everywhere for other bars, bartenders and classics.`
          : scope === 'area'
            ? "Search a bar's name, a drink, an ingredient or a style."
            : 'Search bars, the drinks they pour, bartenders, classics and ingredients.'}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.md },
  // The palette's line under its field, edge to edge across the card.
  rule: { height: StyleSheet.hairlineWidth },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  scope: { flexGrow: 0, flexShrink: 1, minWidth: 240 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginLeft: 'auto' },
  empty: { gap: space.lg },
  jumps: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cap: { letterSpacing: 0.8, textTransform: 'uppercase' },
});
