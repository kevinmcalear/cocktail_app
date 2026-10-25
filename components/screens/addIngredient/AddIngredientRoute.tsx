import { useLocalSearchParams, useRouter } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { useAppStore } from '@/store/useAppStore';

import { AddBottle } from './AddBottle';

interface Props {
  isInline?: boolean;
  barIdProp?: string;
  onClose?: () => void;
  onSave?: () => void;
}

/**
 * /add-ingredient without a draft: A bottle you buy, the short form; It's
 * something you make goes to the house recipe steps (/make-recipe). Opened
 * from an editor to make a missing ingredient (`attachTo`), the new one, or
 * the existing one picked instead of a copy, is handed back to that editor.
 */
export function AddIngredientRoute({ isInline, barIdProp, onClose, onSave }: Props) {
  const router = useRouter();
  const params = useLocalSearchParams<{ barId?: string; name?: string; attachTo?: string }>();
  const setRecentlyCreatedItem = useAppStore((s) => s.setRecentlyCreatedItem);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const wizard = (
    <AddBottle
      barId={(barIdProp !== undefined ? barIdProp : params.barId) || null}
      onMake={(name) => router.replace({ pathname: '/make-recipe', params: { ...(name ? { name } : {}), ...(params.barId ? { barId: params.barId } : {}), ...(params.attachTo ? { attachTo: params.attachTo } : {}) } })}
      initialName={params.name}
      embedded={!!isInline}
      onClose={onClose ?? goBack}
      onSaved={({ id, name }) => {
        if (params.attachTo) {
          setRecentlyCreatedItem({ type: 'ingredient', id, name, targetId: params.attachTo });
          return (onClose ?? goBack)();
        }
        if (isInline) return (onSave ?? onClose)?.();
        router.replace(`/ingredient/${id}`);
      }}
    />
  );
  return isInline ? wizard : <VenueBrandProvider>{wizard}</VenueBrandProvider>;
}
