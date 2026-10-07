import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { BackbarTheme, useDs } from '@/components/ds';
import { BatchScreen } from '@/components/screens/batch/BatchScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { FEATURES } from '@/constants/features';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCocktail } from '@/hooks/useCocktails';
import { useDilutionDefaults } from '@/hooks/useDrinkMath';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { classifyMethod } from '@/lib/batch';
import { drinkStrength } from '@/lib/drinkMath';
import { specLines, type PresentationRecipe } from '@/lib/spec';

/** Batch a drink for prep; opened from the drink page. With Prep switched off it opens the drink. */
export default function BatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return FEATURES.prep ? <Batch id={id} /> : <Redirect href={`/cocktail/${id}`} />;
}

function Batch({ id }: { id: string }) {
  const router = useRouter();
  const { data: cocktail, error, refetch } = useCocktail(id);
  const { data: dropdowns } = useDropdowns();
  const { venues } = useActiveVenue();
  const { access, amountsOpenAt } = useSpecAccess(cocktail?.id, cocktail?.bar_id ?? null);
  const { data: dilutionDefaults } = useDilutionDefaults(cocktail?.bar_id);
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/cocktail/${id}`));
  if (error) return <ErrorState title="Couldn't load this drink" onRetry={() => void refetch()} />;
  if (!cocktail) return <Loading />;

  const methods = (dropdowns?.methods ?? []) as { id: string; name: string }[];
  const methodNames = (cocktail.item_methods ?? [])
    .map((m) => m.method?.name ?? methods.find((x) => x.id === m.method_item_id)?.name)
    .filter((n): n is string => !!n);
  const lines = specLines(cocktail.recipes as PresentationRecipe[] | undefined);
  // The same dilution the drink page shows: the drink's own figure, the venue's default, or the house rule.
  const strength = drinkStrength(lines, classifyMethod(methodNames), { dilutionPct: cocktail.dilution_pct, defaults: dilutionDefaults });
  return (
    <BatchScreen
      name={cocktail.name}
      lines={lines}
      methodNames={methodNames}
      dilutionPct={strength?.dilutionPct ?? null}
      abv={strength?.abv ?? null}
      serviceStyle={cocktail.service_style ?? null}
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
