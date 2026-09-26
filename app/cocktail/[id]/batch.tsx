import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { BackbarTheme, useDs } from '@/components/ds';
import { BatchScreen } from '@/components/screens/batch/BatchScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCocktail } from '@/hooks/useCocktails';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { useRedesign } from '@/lib/flags';
import { specLines, type PresentationRecipe } from '@/lib/spec';

/** Batch a drink for prep. Redesign only; opened from the drink page. */
export default function BatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const redesign = useRedesign();
  const { data: cocktail, error, refetch } = useCocktail(id);
  const { data: dropdowns } = useDropdowns();
  const { venues } = useActiveVenue();
  const { access, amountsOpenAt } = useSpecAccess(cocktail?.id, cocktail?.bar_id ?? null);

  if (!redesign) return <Redirect href={`/cocktail/${id}`} />;
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/cocktail/${id}`));
  if (error) return <ErrorState title="Couldn't load this drink" onRetry={() => void refetch()} />;
  if (!cocktail) return <Loading />;

  const methods = (dropdowns?.methods ?? []) as { id: string; name: string }[];
  const methodNames = (cocktail.item_methods ?? [])
    .map((m) => m.method?.name ?? methods.find((x) => x.id === m.method_item_id)?.name)
    .filter((n): n is string => !!n);
  return (
    <BatchScreen
      name={cocktail.name}
      lines={specLines(cocktail.recipes as PresentationRecipe[] | undefined)}
      methodNames={methodNames}
      lockedUntil={access.names && access.amounts ? null : amountsOpenAt}
      accent={venues.find((v) => v.id === cocktail.bar_id)?.accent ?? undefined}
      onClose={close}
    />
  );
}

function Loading() {
  return (
    <BackbarTheme scheme="light">
      <Ground />
    </BackbarTheme>
  );
}

function Ground() {
  const ds = useDs();
  return <View style={{ flex: 1, backgroundColor: ds.c.ground }} accessibilityLabel="Loading batch" />;
}
