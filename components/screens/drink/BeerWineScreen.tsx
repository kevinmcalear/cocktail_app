import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider } from '@/components/ds';
import { DrinkDrawing } from '@/components/ds/DrinkDrawing';
import { CouldNotLoad, NotAvailable } from '@/components/screens/safety/NotAvailable';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useFavorites } from '@/hooks/useFavorites';
import { useMode } from '@/hooks/useMode';
import { useShareSlug } from '@/hooks/useShareSlug';
import { useTeamRole } from '@/hooks/useTeamRole';
import { recentEntry, useTrackRecent } from '@/hooks/useTrackRecent';
import { useCanEditItem, useEffectiveRole } from '@/hooks/useViewAs';
import { savedSketch } from '@/lib/beerWineWizard';
import { formatAbv } from '@/lib/drinkMath';
import { bareItemId, DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { heroPicture, orderedPictures, type ItemImageLink } from '@/lib/itemImages';
import { drinkUrl, shareOrCopy } from '@/lib/shareLink';
import { liquidOf } from '@/lib/sketch/types';

import { AllergyLine } from './AllergyLine';
import { ApprovalNotice } from './ApprovalNotice';
import { DrinkHero } from './DrinkHero';
import { drawingSize } from './DrawingHero';
import { DrinkLoading } from './DrinkLoading';
import { ItemShell } from './ItemShell';
import { ItemTitle } from './ItemTitle';
import { PalateFit } from './NamesBlock';
import { FactRows, RowGroup, type GroupRow } from './RowGroup';

type Item = NonNullable<ReturnType<(typeof DRINK_KINDS)['beer']['useItem']>['data']>;

/** /beer/<id> and /wine/<id>: loads it, then shows it on the drink page. */
export function BeerWineScreen({ kind: kindName }: { kind: DrinkKind }) {
  const kind = DRINK_KINDS[kindName];
  const { id } = useLocalSearchParams<{ id?: string }>();
  const safeId = bareItemId(kind.kind, id);
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
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
  // Favourites keep the prefixed id they always had.
  const key = `${kind.kind}-${item.id}`;
  return (
    <BeerWineBrand barId={item.bar_id}>
      <BeerWinePage
        kind={kindName}
        item={item}
        favorite={isFavorite(key)}
        onToggleFavorite={() => void toggleFavorite(key)}
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
  canEdit: boolean;
  onEdit: () => void;
}

/**
 * A beer or a wine (canvas GWBCX, Item-page): the drink page's hero, sky and
 * type, with no spec and so no toggle. Guests read what it tastes like, how it
 * meets their palate and the facts a menu gives; the bar's team adds the
 * allergens and how to pour it. With no photo it's drawn in its glass, as the
 * add wizard drew it.
 */
function BeerWinePage({ kind, item, favorite, onToggleFavorite, canEdit, onEdit }: BeerWinePageProps) {
  const { data: dropdowns } = useDropdowns();
  const home = useMode().mode === 'home';
  const teamRole = useTeamRole(item.bar_id);
  const viewing = useEffectiveRole(item.bar_id);
  // The bar's own team, in venue mode, at Employee or up (View as applied): allergens and Pour it.
  const staff = !home && teamRole !== null && viewing >= 20;

  // Style and region are stored as tags.
  const tags = ((item.item_categories ?? []) as { category_id: string }[])
    .map((ic) => dropdowns?.categories?.find((c) => c.id === ic.category_id)?.name)
    .filter((n): n is string => !!n);
  const pictures = orderedPictures(item.item_images as ItemImageLink[] | undefined).filter((p) => !p.isSketch);
  // ponytail: app_item_presentation has no sketch_variant yet, so this is the style's usual glass; add the column to the view to show the pick.
  const sketch = savedSketch(kind, tags, (item as { sketch_variant?: string | null }).sketch_variant ?? null);
  const abv = formatAbv(item.abv);
  const glass = dropdowns?.glassware.find((g) => g.id === item.glassware_id)?.name ?? null;
  const pour = [item.serve_ml ? `${item.serve_ml} ml` : null, item.price != null ? `$${item.price}` : null].filter(Boolean).join(' · ');
  const facts = [
    abv ? { label: 'Strength', value: abv } : null,
    pour ? { label: kind === 'wine' ? 'Glass' : 'Pour', value: pour } : null,
    glass ? { label: 'Served', value: glass } : null,
  ].filter((f): f is { label: string; value: string } => !!f);
  const pourIt: GroupRow[] = [];
  if (glass) pourIt.push({ key: 'glass', label: 'Glass', value: glass });
  if (item.serve_ml) pourIt.push({ key: 'pour', label: 'Pour', value: `${item.serve_ml} ml` });
  const label = DRINK_KINDS[kind].label;
  const size = drawingSize(staff);
  const slug = useShareSlug('d', item.id).data;

  const title = <ItemTitle eyebrow={[label, tags[0]].filter(Boolean).join(' · ')} name={item.name} credit={[item.brand_maker, item.origin].filter(Boolean).join(', ') || null} />;

  return (
    <ItemShell
      name={item.name}
      photo={pictures[0] ? { url: pictures[0].url, hero: (h, fade) => <DrinkHero name={item.name} pictures={pictures} glass={null} itemId={item.id} palette={pictures[0].palette} height={h} fade={fade} /> } : null}
      art={(pour) => <DrinkDrawing inputs={sketch} seed={item.id} size="hero" staff={staff} pour={pour} label={`Drawing of ${item.name}`} />}
      size={size}
      liquid={liquidOf(sketch).hex}
      title={title}
      action={null}
      body={(columns) => (
        <View style={styles.body}>
          {columns ? null : title}
          {item.description ? <Body>{item.description}</Body> : null}
          {staff ? null : <PalateFit itemId={item.id} name={item.name} />}
          <FactRows rows={facts} />
          {staff ? <AllergyLine itemId={item.id} guest={false} /> : null}
          {item.bar_id && staff ? <ApprovalNotice itemId={item.id} /> : null}
          {item.notes ? <Body tone="muted">{item.notes}</Body> : null}
          {staff ? <RowGroup title="Pour it" rows={pourIt} /> : null}
        </View>
      )}
      controls={{
        save: { saved: favorite, onToggle: onToggleFavorite, label: ['Add to favorites', 'Remove from favorites'], icon: 'heart' },
        onShare: () => void shareOrCopy(drinkUrl(slug ?? item.id), item.name),
        onEdit: canEdit ? onEdit : undefined,
        editLabel: `Edit ${kind}`,
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
});
