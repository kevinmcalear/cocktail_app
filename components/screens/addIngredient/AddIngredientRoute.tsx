import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Platform } from 'react-native';

import { useBreakpoint } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { useCreateBar } from '@/hooks/useBringInPlace';

import { WizardDialog } from '../addDrink/WizardDialog';
import { WizardWaiting } from '../addDrink/WizardWaiting';
import { AddBottle } from './AddBottle';

/**
 * /add-ingredient without a draft: A bottle you buy (Add-bottle), one
 * screen; on a wide web window a centred dialog. It's something I make goes
 * to the house-made steps (/make-recipe). Saved, it opens the bottle's page.
 */
export function AddIngredientRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ barId?: string; name?: string }>();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // No bar in the link: where you are now, once that's known (useCreateBar).
  const place = useCreateBar(params.barId || undefined);
  const barId = place.barId;
  const desktop = useBreakpoint() === 'desktop';
  const dialog = Platform.OS === 'web' && desktop;
  // The dialog's Escape and scrim close as the X does, asking first when something is typed.
  const closeRef = useRef<(() => void) | null>(null);
  const wizard = !place.ready ? (
    <WizardWaiting />
  ) : (
    <AddBottle
      barId={barId}
      initialName={params.name}
      embedded={dialog}
      closeRef={closeRef}
      onMake={(name) => router.replace({ pathname: '/make-recipe', params: { ...(name ? { name } : {}), ...(barId ? { barId } : {}) } })}
      onClose={goBack}
      onSaved={({ id }) => router.replace(`/ingredient/${id}`)}
    />
  );
  return (
    <VenueBrandProvider>
      {dialog ? (
        <WizardDialog label="A bottle you buy" onClose={() => closeRef.current?.()}>
          {wizard}
        </WizardDialog>
      ) : (
        wizard
      )}
    </VenueBrandProvider>
  );
}
