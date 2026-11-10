import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Platform } from 'react-native';

import { useBreakpoint } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { BeerWineDraftEditScreen } from '@/components/screens/drink/edit/BeerWineEditScreen';
import { useCreateBar } from '@/hooks/useBringInPlace';
import type { DrinkKind } from '@/lib/drinkKinds';
import { useMenuDrinkHandoff } from '@/store/useMenuDrinkHandoff';

import { WizardDialog } from '../addDrink/WizardDialog';
import { WizardWaiting } from '../addDrink/WizardWaiting';
import { AddBeerWineWizard } from './AddBeerWineWizard';

export interface AddDrinkProps {
  isInline?: boolean;
  draftIdProp?: string;
  barIdProp?: string;
  initialNameProp?: string;
  onClose?: () => void;
  onSave?: () => void;
}

/**
 * /add-beer and /add-wine: a new one is added with the step-by-step wizard
 * (full page and in the workspace); a draft saved by the older editor opens
 * on the drink edit page.
 */
export function AddBeerWineRoute({ kind, ...props }: AddDrinkProps & { kind: DrinkKind }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ barId?: string; draftId?: string; name?: string; menuSectionId?: string }>();
  const draftId = props.draftIdProp !== undefined ? props.draftIdProp : params.draftId;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const named = (props.barIdProp !== undefined ? props.barIdProp : params.barId) || undefined;
  // No bar in the link: where you are now, once that's known (a cold link at a bar is the bar's beer, with its price).
  const place = useCreateBar(named);
  const barId = named ?? place.barId;
  const initialName = props.initialNameProp !== undefined ? props.initialNameProp : params.name;
  const desktop = useBreakpoint() === 'desktop';
  const dialog = Platform.OS === 'web' && desktop && !props.isInline;
  // The dialog's Escape and scrim close as the X does, through the wizard (Leave it for now).
  const closeRef = useRef<(() => void) | null>(null);
  // A draft's link names its bar, or none for one at home.
  if (draftId) return <BeerWineDraftEditScreen kind={kind} draftId={draftId} barId={named ?? null} initialName={initialName} onExit={props.onClose ?? goBack} />;

  const wizard = !place.ready ? (
    <WizardWaiting />
  ) : (
    <AddBeerWineWizard
      kind={kind}
      barId={barId}
      initialName={initialName}
      embedded={!!props.isInline || dialog}
      closeRef={closeRef}
      onClose={props.onClose ?? goBack}
      onSaved={(id) => {
        if (props.onSave) props.onSave();
        else if (params.menuSectionId) {
          // Made from a menu section: back to the menu editor, which puts it in that section.
          useMenuDrinkHandoff.getState().deliver(params.menuSectionId, id);
          goBack();
        } else router.replace(`/${kind}/${id}`);
      }}
    />
  );
  if (props.isInline) return wizard;
  return <VenueBrandProvider>{dialog ? (
        <WizardDialog label={`Add a ${kind}`} onClose={() => closeRef.current?.()}>
          {wizard}
        </WizardDialog>
      ) : (
        wizard
      )}</VenueBrandProvider>;
}
