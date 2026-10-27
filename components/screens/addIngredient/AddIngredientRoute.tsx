import { useLocalSearchParams, useRouter } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';

import { AddBottle } from './AddBottle';

interface Props {
  isInline?: boolean;
  barIdProp?: string;
  onClose?: () => void;
  onSave?: () => void;
}

/**
 * /add-ingredient without a draft: A bottle you buy, the short form; It's
 * something you make goes to the house recipe steps (/make-recipe).
 */
export function AddIngredientRoute({ isInline, barIdProp, onClose, onSave }: Props) {
  const router = useRouter();
  const params = useLocalSearchParams<{ barId?: string; name?: string }>();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const barId = (barIdProp !== undefined ? barIdProp : params.barId) || null;
  const wizard = (
    <AddBottle
      barId={barId}
      // Something you make: the recipe steps for the same place, in the workspace's stack too (they're a page of their own).
      onMake={(name) => {
        const to = { pathname: '/make-recipe' as const, params: { ...(name ? { name } : {}), ...(barId ? { barId } : {}) } };
        if (isInline) {
          onClose?.();
          router.push(to);
        } else router.replace(to);
      }}
      initialName={params.name}
      embedded={!!isInline}
      onClose={onClose ?? goBack}
      onSaved={({ id }) => {
        if (isInline) return (onSave ?? onClose)?.();
        router.replace(`/ingredient/${id}`);
      }}
    />
  );
  return isInline ? wizard : <VenueBrandProvider>{wizard}</VenueBrandProvider>;
}
