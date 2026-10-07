/**
 * The slot on the map's bar card for that bar's highest-ranked drinks, under
 * its name and above the drinks matching Discover's search.
 * ponytail: renders nothing until the per-bar top drinks data lands (a
 * separate PR builds it). Upgrade path: fill this component from that hook;
 * DiscoverMapPane already passes the bar's profile id.
 */
export function BarTopDrinks(_props: { barId: string }) {
  return null;
}
