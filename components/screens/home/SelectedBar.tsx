import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, GlassButton, Headline, PressableScale, RowScore, Surface, Tag, useDs } from '@/components/ds';
import { barPlace, directionsTarget, HoursLine } from '@/components/screens/bar/BarFactLines';
import { DirectionsButton, MapsButton } from '@/components/screens/bar/Directions';
import { type DrinkScores } from '@/components/screens/home/DrinksAtBars';
import { LoveBarButton } from '@/components/screens/kept/LoveBarButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useBestDrink, useRowScores } from '@/hooks/useBestDrink';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { byScore, drinkCount, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import type { MapPin } from '@/lib/discoverMap';
import { barSearchHref } from '@/lib/discoverMatch';
import { awayFrom } from '@/lib/directions';
import { peopleCount, usesMiles, type Area } from '@/lib/nearMe';
import { formatScore } from '@/lib/ranking';

import { BarMark } from './BarMark';
import { BarTopDrinks } from './BarTopDrinks';
import { TileGrid } from './DiscoverShelves';
import { DrinkHero } from './DrinkHero';
import { NextMatch } from './NextMatch';

type Point = { latitude: number; longitude: number } | null;

interface SelectedBarProps {
  pin: MapPin;
  drinks: DiscoverDrink[];
  scores?: DrinkScores;
  /** What was searched: the bar's page opens on it. */
  query?: string;
  /** Where Discover is looking: the drink that leads ranks in it. */
  area?: Area;
  /** Searching or filtering: the matches lead, a page each, and the bar follows them. */
  lead?: boolean;
  /** card: the wide screen's picked bar. sheet: the top of the phone sheet, whose list holds the bar's drinks. */
  variant?: 'card' | 'sheet';
  /** Where the person is, for "400 m" and Directions; null when unknown. */
  me?: Point;
  onClose: () => void;
}

/**
 * A tapped pin. Searching, the bar's matches come first, one at a time
 * ("1 of 2 at Little Rye", disc-search-pin), then the bar they're at and
 * what else is good there. Browsing, the bar (disc-map-bar): its type and
 * place, score, Love, hours, its top drinks, then (phones) its drinks in the
 * sheet's list below. On a phone the bar's row opens it, the pin button
 * beside the heart opens its listing in Apple or Google Maps, and the
 * header's pill (a back arrow and the bar's name) goes back to the results.
 */
export function SelectedBar({ pin, drinks, scores, query = '', area, lead = false, variant = 'card', me = null, onClose }: SelectedBarProps) {
  const ds = useDs();
  const router = useRouter();
  const facts = useBarFacts(pin.id).data;
  const [page, setPage] = useState(0);
  const matches = lead && !pin.closed ? drinks : [];
  const hero = matches[Math.min(page, matches.length - 1)];
  const next = matches.length > 1 ? matches[(page + 1) % matches.length] : undefined;
  const openBar = () => router.push(barSearchHref(pin.handle || pin.id, query) as never);
  const place = barPlace(facts?.bar_type, pin.place);
  const away = facts ? awayFrom(me, facts, usesMiles(getLocales()[0])) : null;
  // How far before the neighbourhood, so a long place never cuts it off; the wide card has only how far (Directions has the address).
  const near = awayFrom(me, pin, usesMiles(getLocales()[0]));
  const where = (variant === 'card' ? near : [near, place].filter(Boolean).join(' · ')) || place || 'Bar';
  const target = directionsTarget(facts, me);
  const count = pin.drinks ?? drinks.length;
  // A score or Closed sits at the right; an early bar says so under the place, and an unranked one says nothing.
  const score = pin.closed ? <Tag label={pin.closed} /> : pin.score !== null ? <RowScore score={pin.score} detail={pin.rankers ? `${pin.rankers} ranked` : null} /> : null;
  const early = !pin.closed && pin.score === null && pin.rankers ? `Early · ${peopleCount(pin.rankers)}` : null;
  const said = pin.closed ? pin.closed : pin.score !== null ? `Score ${formatScore(pin.score)}, ${pin.rankers} ranked` : pin.rankers ? `Early: ${peopleCount(pin.rankers)} ranked` : null;

  // The wide card's way back to the results; on a phone the header's pill is.
  const back = variant === 'card' ? <GlassButton icon="chevron.left" accessibilityLabel="Back to all results" onPress={onClose} /> : null;

  if (hero) {
    // The drink, then the bar it's at: a row that opens the bar.
    return (
      <View style={styles.card}>
        {matches.length > 1 || back ? (
          <View style={styles.top}>
            {back}
            <Caption tone="muted" role="status" style={styles.flex}>{matches.length > 1 ? `${page + 1} of ${matches.length} at ${pin.name}` : ''}</Caption>
          </View>
        ) : null}
        <DrinkHero key={hero.id} drink={hero} query={query} area={area} />
        {next ? <NextMatch drink={next} score={scores?.drinks[next.id]} count={matches.length} page={page} onNext={() => setPage((page + 1) % matches.length)} /> : null}
        <View style={[styles.atBar, { borderColor: ds.c.line }]}>
          <PressableScale role="link" accessibilityLabel={`At ${pin.name}, ${[pin.place, away].filter(Boolean).join(', ')}. Open the bar`} onPress={openBar} style={styles.atLink}>
            <BarMark logoUrl={pin.logo} name={pin.name} profileId={pin.id} brand={pin.brand} size={32} />
            <View style={styles.flex}>
              <Caption tone="muted">At</Caption>
              <Caption numberOfLines={1}>{[pin.name, pin.place, away].filter(Boolean).join(' · ')}</Caption>
            </View>
            <Caption>Bar</Caption>
            <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
          </PressableScale>
          <LoveBarButton profileId={pin.id} name={pin.name} />
        </View>
        <BarTopDrinks barId={pin.id} title="Also good here" />
      </View>
    );
  }

  const head = (
    <>
      <BarMark logoUrl={pin.logo} name={pin.name} profileId={pin.id} brand={pin.brand} size={48} />
      <View style={styles.flex}>
        <Headline numberOfLines={2}>{pin.name}</Headline>
        <Caption tone="muted" numberOfLines={1}>
          {where}
        </Caption>
        {early ? <Caption tone="muted">{early}</Caption> : null}
      </View>
      {score}
    </>
  );
  const headLabel = [`${pin.name}, ${where}`, said].filter(Boolean).join('. ');

  if (variant === 'sheet') {
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {/* The bar's row is the way in: no Open bar button. */}
          <PressableScale role="link" accessibilityLabel={`${headLabel}. Open the bar`} onPress={openBar} style={[styles.cardRow, styles.barHead]}>
            {head}
          </PressableScale>
          <LoveBarButton profileId={pin.id} name={pin.name} />
          <MapsButton target={target} />
        </View>
        <HoursLine facts={facts} />
        <BarTopDrinks barId={pin.id} />
        {!pin.closed && drinks.length ? (
          <Caption tone="muted" role="heading">
            {`${drinkCount(drinks.length)} here`}
          </Caption>
        ) : null}
      </View>
    );
  }

  const bar = (
    <View style={styles.cardRow}>
      <View style={[styles.cardRow, styles.barHead]} accessible accessibilityLabel={headLabel}>
        {head}
      </View>
      <LoveBarButton profileId={pin.id} name={pin.name} />
    </View>
  );

  // Wide screens: the bar's drinks, two rows of the shelves' grid, the rest in place (disc-desk-wide).
  return (
    <Surface style={[styles.card, styles.picked, { borderColor: ds.c.lineStrong }]}>
      {bar}
      {facts?.hours ? <HoursLine facts={facts} /> : null}
      {drinks.length ? <TileGrid drinks={drinks} atBar showAll={`Show all ${drinkCount(drinks.length)}`} style={styles.drinks} /> : null}
      <BarTopDrinks barId={pin.id} />
      <View style={[styles.cardActions, { borderTopColor: ds.c.line }]}>
        {!pin.closed && count ? <Caption tone="muted" style={styles.count}>{`${drinkCount(count)} here`}</Caption> : <View style={styles.count} />}
        <View style={styles.buttons}>
          <Button label="Close" variant="ghost" size="sm" onPress={onClose} />
          <DirectionsButton target={target} size="sm" />
          <Button label="Open bar" size="sm" onPress={openBar} />
        </View>
      </View>
    </Surface>
  );
}

interface PickedBarProps {
  pin: MapPin;
  filter: DrinkFilter;
  /** On "Best Martini" / "Top rated": that drink, so the bar's ones show scored, best first, as on the map. */
  best: { id: string; name: string } | null;
  me?: Point;
  onClose: () => void;
}

/**
 * Wide screens, browsing: the tapped pin at the top of Discover's list,
 * rather than a card over the map. Its drinks and scores come from the same
 * cached queries as the map's.
 */
export function PickedBar({ pin, filter, best, me, onClose }: PickedBarProps) {
  const atBar = useDiscoverList(filter, { barId: pin.id, enabled: !best && !pin.closed, pageSize: 100 });
  const { picked, scores } = useBestDrink(best, filter, { load: !!best, active: !!best });
  const drinks = scores ? byScore(picked.filter((d) => d.barId === pin.id), scores.drinks) : atBar.drinks;
  const browse = useRowScores(atBar.drinks, filter.area, !best);
  return <SelectedBar pin={pin} drinks={drinks} scores={scores ?? browse} query={filter.search} area={filter.area} me={me} onClose={onClose} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { gap: space.sm },
  // disc-desk-browse: the surface with a stronger edge, 14 by 16 inside.
  picked: { borderWidth: 1, paddingVertical: space.md + 2, paddingHorizontal: space.lg, gap: space.sm + 2 },
  cardRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  // A wrapped name is taller than the mark: top-align them.
  barHead: { alignItems: 'flex-start' },
  // The same room above the drinks as below them.
  drinks: { marginVertical: space.sm },
  // The count beside the buttons, as drawn; in a narrow column the buttons drop under it together rather than leaving Open bar alone.
  count: { flexGrow: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm, marginLeft: 'auto' },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm + 2 },
  // The wide card's back button, then "1 of 2 at Little Rye" when searching.
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  atBar: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.mark, paddingVertical: space.sm },
  atLink: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
});
