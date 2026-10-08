import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { recentMatchesContext } from '@/hooks/useTrackRecent';
import type { SearchMine } from '@/hooks/useSearchMine';
import { timeAgo } from '@/lib/commandSearchGrid';
import { fallbackGlass } from '@/lib/itemRoutes';
import type { Area } from '@/lib/nearMe';
import { scopeOptions, type SearchScope } from '@/lib/searchScope';
import { capitalize } from '@/lib/stringUtils';
import { useRecentActivityStore, type RecentActivity } from '@/store/useRecentActivityStore';

import { MineResults } from './MineResults';
import { PublicResults } from './PublicResults';
import { ResultGroup, ResultRow } from './ResultRows';
import { ScopeSwitch } from './ScopeSwitch';
import { SearchField } from './SearchField';

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
}

/** The search field and where it looks. The same at every door: the tab, ⌘K, Library and Discover. */
export function SearchHead({ query, onQuery, scope, onScope, mine, area, autoFocus, onDone }: HeadProps) {
  const options = scopeOptions(mine.label, area?.label ?? null);
  const placeholder = scope === 'everywhere' ? 'Search bars, drinks and people' : scope === 'area' ? `Search ${area?.label === 'This area' ? 'this area' : (area?.label ?? 'here')}` : `Search ${mine.venueId ? mine.label : 'your drinks'}`;
  return (
    <View style={styles.head}>
      <SearchField query={query} onQuery={onQuery} placeholder={placeholder} autoFocus={autoFocus} onSubmit={onDone} onDone={onDone} />
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
}

/** What the search finds in its scope, or what was opened lately while nothing is typed. */
export function SearchBody({ query, scope, onScope, mine, area, onJump }: BodyProps) {
  if (!query.trim()) return <Recent scope={scope} mine={mine} onJump={onJump} />;
  if (scope === 'mine') return <MineResults query={query} mine={mine} onEverywhere={() => onScope('everywhere')} />;
  return (
    <PublicResults
      query={query}
      area={scope === 'area' && area ? area.area : null}
      kinds={area?.kinds}
      onKind={area?.onKind}
      onEverywhere={() => onScope('everywhere')}
    />
  );
}

const KIND_LABEL: Record<RecentActivity['kind'], string> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine', ingredient: 'Ingredient', menu: 'Menu', quiz: 'Quiz' };
const JUMPS = [
  { label: 'On menu now', show: 'on-menu' },
  { label: 'Staff list', show: 'staff' },
  { label: 'Past', show: 'past' },
  { label: 'Ingredients', show: 'ingredients' },
] as const;

function Recent({ scope, mine, onJump }: { scope: SearchScope; mine: SearchMine; onJump?: () => void }) {
  const router = useRouter();
  const all = useRecentActivityStore((s) => s.items);
  const recent = scope === 'mine' ? all.filter((r) => recentMatchesContext(r, mine.contextIds)) : all;
  const open = (r: RecentActivity) => router.push((r.kind === 'menu' && !r.isDraft ? `/menus/${encodeURIComponent(r.id)}` : r.href) as never);
  const caption = (r: RecentActivity) => `${r.isDraft ? 'Draft' : KIND_LABEL[r.kind]} · ${timeAgo(r.at)} ago`;
  const drink = (k: RecentActivity['kind']) => k === 'cocktail' || k === 'beer' || k === 'wine';
  const venue = scope === 'mine' && !!mine.venueId;
  return (
    <View style={styles.empty}>
      <ResultGroup
        label="Recent"
        items={recent}
        render={(r) =>
          drink(r.kind) ? (
            <DrinkRow key={`${r.kind}-${r.id}`} name={capitalize(r.title)} itemId={r.id} imageUrl={r.imageUrl ?? null} glass={fallbackGlass(r.kind === 'beer' ? 'Beer' : r.kind === 'wine' ? 'Wine' : 'Cocktail')} caption={caption(r)} onPress={() => open(r)} />
          ) : (
            <ResultRow key={`${r.kind}-${r.id}`} title={capitalize(r.title)} caption={caption(r)} icon={r.kind === 'menu' ? 'list.bullet' : 'drop.fill'} onPress={() => open(r)} />
          )
        }
      />
      {venue ? (
        <View style={styles.jumps}>
          <Caption tone="muted" role="heading">
            Jump to
          </Caption>
          <View style={styles.chips}>
            {JUMPS.map((j) => (
              <Chip key={j.show} label={j.label} selected={false} onPress={() => {
                  onJump?.();
                  router.navigate(`/library?show=${j.show}` as never);
                }} />
            ))}
          </View>
        </View>
      ) : null}
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
  empty: { gap: space.lg },
  jumps: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
