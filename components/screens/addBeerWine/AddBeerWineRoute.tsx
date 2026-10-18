import { useLocalSearchParams, useRouter } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { BeerWineDraftEditScreen } from '@/components/screens/drink/edit/BeerWineEditScreen';
import type { DrinkKind } from '@/lib/drinkKinds';
import { useMenuDrinkHandoff } from '@/store/useMenuDrinkHandoff';

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
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const barId = (props.barIdProp !== undefined ? props.barIdProp : params.barId) || null;
  const initialName = props.initialNameProp !== undefined ? props.initialNameProp : params.name;
  if (draftId) return <BeerWineDraftEditScreen kind={kind} draftId={draftId} barId={barId} initialName={initialName} onExit={props.onClose ?? goBack} />;

  const wizard = (
    <AddBeerWineWizard
      kind={kind}
      barId={barId}
      initialName={initialName}
      embedded={!!props.isInline}
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
  return props.isInline ? wizard : <VenueBrandProvider>{wizard}</VenueBrandProvider>;
}
