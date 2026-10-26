import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert } from 'react-native';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useShelfEdit } from '@/hooks/useHomeBar';
import { useCreatePrep } from '@/hooks/usePrepCard';
import { plainDbMessage } from '@/lib/dbError';
import { toastDone } from '@/lib/toast';

import { PrepBuilder } from '../addDrink/prep/PrepBuilder';

/**
 * /make-recipe: New › Something you make (make-anything-steps-1, step 1;
 * steps-3, step 11). The same recipe steps as inside a drink, on their own
 * page: "Your recipes" where the drink would be, and Save it, which opens
 * the new recipe's page. `shelf` (Add to your bar's Make it in house) puts
 * it on your bar and goes back there, to House-made.
 */
export function MakeRecipeRoute() {
  const router = useRouter();
  const { barId, name, shelf } = useLocalSearchParams<{ barId?: string; name?: string; shelf?: string }>();
  const venue = useActiveVenue().venues.find((v) => v.id === barId) ?? null;
  const dropdowns = useDropdowns({ ingredients: true }).data;
  const create = useCreatePrep();
  const { add } = useShelfEdit();
  // One save at a time: a quick second tap lands before the screen knows it's saving.
  const saving = useRef(false);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  return (
    <VenueBrandProvider>
      <PrepBuilder
        page
        name={name ?? ''}
        drinkName=""
        above={[]}
        bar={venue ? { id: venue.id, name: venue.name } : null}
        ingredients={dropdowns?.ingredients ?? []}
        aliases={dropdowns?.ingredientAliases}
        onClose={goBack}
        onDone={(prep, n) => {
          if (saving.current) return;
          saving.current = true;
          create.mutate(
            { name: n, prep, barId: barId || null },
            {
              onSuccess: ({ id, warnings }) => {
                toastDone('Recipe saved', n);
                if (warnings.length) Alert.alert('Saved, with one thing to fix', warnings.join('\n\n'));
                if (shelf) {
                  add.mutate(id);
                  return goBack();
                }
                router.replace(`/ingredient/${id}`);
              },
              onError: (e) => {
                saving.current = false;
                Alert.alert('Couldn’t save it', plainDbMessage(e) ?? e.message);
              },
            }
          );
        }}
      />
    </VenueBrandProvider>
  );
}
