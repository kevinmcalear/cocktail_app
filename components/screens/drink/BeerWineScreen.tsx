import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Display, GlassButton, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { CouldNotLoad, NotAvailable } from '@/components/screens/safety/NotAvailable';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useFavorites } from '@/hooks/useFavorites';
import { useStudyPile } from '@/hooks/useStudyPile';
import { recentEntry, useTrackRecent } from '@/hooks/useTrackRecent';
import { useCanEditItem } from '@/hooks/useViewAs';
import { savedSketch } from '@/lib/beerWineWizard';
import { formatAbv } from '@/lib/drinkMath';
import { bareItemId, DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { glassOver, heroPicture, orderedPictures, type ItemImageLink } from '@/lib/itemImages';

import { DrinkControls } from './DrinkControls';
import { DrinkDesktop } from './DrinkDesktop';
import { DrinkTags, type Fact } from './DrinkFacts';
import { DrinkHero, phoneHeroHeight } from './DrinkHero';
import { DrinkLoading } from './DrinkLoading';
import { MakeLine } from './MakeLine';

type Item = NonNullable<ReturnType<(typeof DRINK_KINDS)['beer']['useItem']>['data']>;

/** /beer/<id> and /wine/<id>: loads it, then shows it on the drink page. */
export function BeerWineScreen({ kind: kindName }: { kind: DrinkKind }) {
  const kind = DRINK_KINDS[kindName];
  const { id } = useLocalSearchParams<{ id?: string }>();
  const safeId = bareItemId(kind.kind, id);
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { toggleStudyPile, isInStudyPile } = useStudyPile();
  // isPending, not isLoading: "no data yet" includes the static prerender and the
  // first paint, when nothing is fetching, and those must not read as not found.
  const { data: item, isPending, error, refetch } = kind.useItem(safeId);
  const canEdit = useCanEditItem(item);

  useTrackRecent(!!item, item ? recentEntry(kind.kind, item.id, item.name, { imageUrl: heroPicture(item.item_images)?.url, barId: item.bar_id ?? null }) : null);

  // Not yours to read (another bar's drink): its public page, if it's published.
  if ((error as { code?: string } | null)?.code === 'PGRST116' && safeId) return <Redirect href={`/d/${safeId}`} />;
  if (isPending) return <DrinkLoading />;
  if (!item) {
    return (
      <BackbarTheme>
        {error ? <CouldNotLoad what="drink" failed={{ retry: () => void refetch() }} /> : <NotAvailable what="drink" />}
      </BackbarTheme>
    );
  }
  // Favourites and the study pile keep the prefixed id they always had.
  const key = `${kind.kind}-${item.id}`;
  return (
    <BeerWineBrand barId={item.bar_id}>
      <BeerWinePage
        kind={kindName}
        item={item}
        favorite={isFavorite(key)}
        onToggleFavorite={() => void toggleFavorite(key)}
        inStudyPile={isInStudyPile(key)}
        onToggleStudyPile={() => toggleStudyPile(key)}
        canEdit={canEdit}
        onEdit={() => router.push(`/${kind.kind}/${id}/edit`)}
      />
    </BeerWineBrand>
  );
}

/** The drink page's theme, in the colours of the venue it belongs to (as DrinkScreen). */
function BeerWineBrand({ barId, children }: { barId: string | null; children: React.ReactNode }) {
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  return (
    <BackbarTheme>
      <BrandProvider accent={venue?.accent ?? undefined} displayFace={venue?.displayFace}>
        {children}
      </BrandProvider>
    </BackbarTheme>
  );
}

interface BeerWinePageProps {
  kind: DrinkKind;
  item: Item;
  favorite: boolean;
  onToggleFavorite: () => void;
  inStudyPile: boolean;
  onToggleStudyPile: () => void;
  canEdit: boolean;
  onEdit: () => void;
}

/**
 * A beer or a wine on the drink page: the same hero, controls and desktop card
 * as a cocktail, with no spec. Its name and style, then the maker, strength
 * and price in the make line (the Library draws it "Beer · Pint"), the
 * description and its notes. With no photo it's drawn in its glass, as the
 * add wizard drew it.
 */
function BeerWinePage({ kind, item, favorite, onToggleFavorite, inStudyPile, onToggleStudyPile, canEdit, onEdit }: BeerWinePageProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  // A modal: an iOS page sheet starts below the status bar, but the insets still count it.
  const top = Platform.OS === 'ios' ? space.sm : insets.top;
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const wide = breakpoint !== 'phone';
  const { width, height } = useWindowDimensions();
  const { data: dropdowns } = useDropdowns();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Style and region are stored as tags.
  const tags = ((item.item_categories ?? []) as { category_id: string }[])
    .map((ic) => dropdowns?.categories?.find((c) => c.id === ic.category_id)?.name)
    .filter((n): n is string => !!n);
  const pictures = orderedPictures(item.item_images as ItemImageLink[] | undefined);
  // ponytail: app_item_presentation has no sketch_variant yet, so this is the style's usual glass; add the column to the view to show the pick.
  const sketch = savedSketch(kind, tags, (item as { sketch_variant?: string | null }).sketch_variant ?? null);
  const abv = formatAbv(item.abv);
  const facts = (
    [
      item.brand_maker ? { label: DRINK_KINDS[kind].maker.label, value: item.brand_maker } : null,
      abv ? { label: 'ABV', value: abv } : null,
      item.price != null ? { label: 'Price', value: `$${item.price}` } : null,
    ] as (Fact | null)[]
  ).filter((f): f is Fact => !!f);
  const heroHeight = wide ? height - top : phoneHeroHeight(width, height, top);
  const hero = (h: number) => <DrinkHero name={item.name} pictures={pictures} glass={null} itemId={item.id} sketch={sketch} palette={pictures[0]?.palette} height={h} fade={!wide} />;

  const body = (
    <View style={styles.body}>
      <View style={styles.make}>
        <View style={styles.header}>
          <Display>{item.name}</Display>
          <DrinkTags tags={tags} />
        </View>
        <MakeLine facts={facts} />
      </View>
      {item.description ? <Body tone="muted">{item.description}</Body> : null}
      {item.notes ? (
        <View style={styles.notes}>
          <Headline role="heading">Notes</Headline>
          <Body>{item.notes}</Body>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <DrinkDesktop
          hero={hero}
          top={top}
          staff={false}
          heroActions={
            <>
              <GlassButton accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'} icon={favorite ? 'heart.fill' : 'heart'} onMedia onPress={onToggleFavorite} />
              {canEdit ? <GlassButton accessibilityLabel={`Edit ${kind}`} label="Edit" onMedia onPress={onEdit} /> : null}
            </>
          }
        >
          {body}
        </DrinkDesktop>
      ) : (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
          {hero(heroHeight)}
          <View style={{ marginTop: -space.xxl, paddingHorizontal: gutter }}>{body}</View>
        </Animated.ScrollView>
      )}
      {/* Wide: the sidebar and the hero card's own buttons; no floating back (board drink-desktop). */}
      {wide && breakpoint === 'desktop' ? null : (
        <DrinkControls
          media={glassOver(pictures[0]) === 'dark' ? 'photo' : 'paper'}
          top={top}
          heroHeight={heroHeight}
          scrollY={scrollY}
          wide={wide}
          saved={favorite}
          onToggleSaved={onToggleFavorite}
          saveAs="favorite"
          inStudyPile={inStudyPile}
          onToggleStudyPile={onToggleStudyPile}
          canEdit={canEdit}
          onEdit={onEdit}
          editLabel={`Edit ${kind}`}
          backOnly={wide}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { justifyContent: 'center' },
  body: { gap: space.xl },
  make: { gap: space.md },
  header: { gap: space.sm },
  notes: { gap: space.sm },
});
