import { getLocales } from 'expo-localization';
import { RowScore, scoreWords as rowScoreWords, type MatchTextProps } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { useVersionLabel } from '@/hooks/useSpecMatches';
import { drinkReason, type BarScore, type DiscoverDrink } from '@/lib/discoverDrinks';
import { itemHref } from '@/lib/itemRoutes';
import { formatDistance, usesMiles } from '@/lib/nearMe';
import { formatScore } from '@/lib/ranking';

const place = (b: DiscoverDrink['bar']) => [b.locality, b.city].filter(Boolean).join(', ');

/** "Best Martini" scores: each drink's own, and each bar's for the drink. A drink or bar nobody has scored has none. */
export interface DrinkScores {
  drinks: Readonly<Record<string, number>>;
  bars: Readonly<Record<string, BarScore>>;
}

/** The scores at the end of a drink row: the drink's, then its bar's under it ("Bar 9.1"). Nothing when neither is scored. */
export function DrinkScore({ drink, bar }: { drink?: number; bar?: number }) {
  return <RowScore score={drink} detail={bar !== undefined ? `Bar ${formatScore(bar)}` : null} />;
}

/** What a screen reader hears for those scores. */
export function scoreWords(drink?: number, bar?: number): string | null {
  return rowScoreWords(drink, bar !== undefined ? `bar scores ${formatScore(bar)}` : null);
}

/**
 * One drink at its bar, the sub line plain as drawn (disc-list): the bar's
 * small logo, the bar, how far it is (else where), and what it is to its
 * classic ("the classic spec", or what its variation changes); the scores
 * (when given) at the end, and the searched word lit (tint on Discover).
 * No "on now": Discover lists only what's on now unless Past menus is on,
 * and a past drink carries its "Past · 2024 to 2025" tag (Kevin, 14 Oct).
 * A mixed list's row may carry one reason instead: "New" or "Zero-proof" (15 Oct).
 * `atBar`: a tapped bar's own drinks (disc-map-bar), so the bar and its logo
 * aren't repeated. `everywhere`: search's Everywhere, which puts why it
 * matched ("Riff on a Negroni") on its own line, the word lit (nav-search-everywhere).
 */
export function DrinkAtBarRow({ drink: d, scores, query, matchLook = 'tint', atBar = false, everywhere = false, onPress, onShowBar }: { drink: DiscoverDrink; scores?: DrinkScores; query?: string; matchLook?: MatchTextProps['look']; atBar?: boolean; everywhere?: boolean; onPress?: () => void; /** Hovering opens this bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const bar = d.bar;
  const version = useVersionLabel(d.id);
  const away = d.distance === null || d.distance === undefined ? null : formatDistance(d.distance / 1000, usesMiles(getLocales()[0]));
  // A tapped bar's rows say what the drink is instead (ponytail: its description; the ingredient line needs discover_list to return the spec's lines).
  const reason = d.menu.past ? null : d.pos != null ? drinkReason(d, new Date()) : null;
  const what = atBar ? (d.why ?? version ?? d.description) : everywhere ? version : (d.why ?? version);
  const caption = (atBar ? [what] : [bar.name, away ?? place(bar), what]).filter(Boolean).join(' · ');
  const drinkScore = scores?.drinks[d.id];
  const barScore = atBar ? undefined : scores?.bars[d.barId]?.score;
  const said = scoreWords(drinkScore, barScore);
  return (
    <DrinkRow
      name={d.name}
      href={itemHref('Cocktail', d.id)}
      onPress={onPress}
      itemId={d.id}
      imageUrl={d.imageUrl}
      glass={null}
      dense
      caption={caption}
      logo={atBar ? undefined : { uri: bar.logo, name: bar.name, profileId: d.barId }}
      note={everywhere ? (d.why ?? undefined) : undefined}
      tag={d.menu.past ?? reason ?? undefined}
      tagTone={reason ? 'accent' : undefined}
      trailing={<DrinkScore drink={drinkScore} bar={barScore} />}
      query={query}
      matchLook={matchLook}
      label={said ? [d.name, caption, everywhere ? d.why : null, d.menu.past, said].filter(Boolean).join('. ') : undefined}
      onHoverIn={onShowBar ? () => onShowBar(d.barId) : undefined}
      onHoverOut={onShowBar ? () => onShowBar(null) : undefined}
    />
  );
}
