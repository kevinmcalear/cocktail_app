import { useLocalSearchParams, useRouter } from 'expo-router';

import { AddDrinkScreen, type AddDrinkProps } from '@/components/drink/AddDrinkScreen';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import type { DrinkKind } from '@/lib/drinkKinds';
import { useCreatorNavStore } from '@/store/useCreatorNavStore';

import { AddBeerWineWizard } from './AddBeerWineWizard';

/**
 * /add-beer and /add-wine: a new one is added with the step-by-step wizard
 * (full page and in the workspace); a draft saved by the older editor still
 * opens in it.
 */
export function AddBeerWineRoute({ kind, ...props }: AddDrinkProps & { kind: DrinkKind }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ barId?: string; draftId?: string; name?: string; menuSectionId?: string }>();
  const draftId = props.draftIdProp !== undefined ? props.draftIdProp : params.draftId;
  if (draftId) return <AddDrinkScreen kind={kind} {...props} />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const wizard = (
    <AddBeerWineWizard
      kind={kind}
      barId={(props.barIdProp !== undefined ? props.barIdProp : params.barId) || null}
      initialName={props.initialNameProp !== undefined ? props.initialNameProp : params.name}
      embedded={!!props.isInline}
      onClose={props.onClose ?? goBack}
      onSaved={(id) => {
        if (props.onSave) props.onSave();
        else if (params.menuSectionId) {
          // Made from a menu section: back to the menu editor, which puts it in that section.
          useCreatorNavStore.getState().deliverMenuDrink(params.menuSectionId, id);
          goBack();
        } else router.replace(`/${kind}/${id}`);
      }}
    />
  );
  return props.isInline ? wizard : <VenueBrandProvider>{wizard}</VenueBrandProvider>;
}
