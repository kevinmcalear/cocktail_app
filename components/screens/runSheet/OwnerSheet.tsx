import { View } from 'react-native';

import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useSetOwners } from '@/hooks/useRunSheet';

import type { PartyLook } from './parts';

/**
 * Who brings one thing, or a whole group ("Assign all spirits to..."): the
 * us, the bar visiting or a brand. "The sheet's pick" goes back to the
 * default (a brand's own bottles, the visiting bar's house preps, the rest to the bar it's at).
 */
export function OwnerSheet({ menuId, title, itemIds, current, picked, looks, onClose }: {
  menuId: string;
  title: string;
  itemIds: string[];
  /** The owner now, when it's one thing (undefined for a group). */
  current?: string | null;
  picked?: boolean;
  looks: PartyLook[];
  onClose: () => void;
}) {
  const setOwners = useSetOwners(menuId);
  const pick = (partyId: string | null | 'default') => {
    setOwners.mutate({ itemIds, partyId });
    onClose();
  };
  return (
    <MenuSheet visible onClose={onClose} title={title} subtitle={itemIds.length > 1 ? `${itemIds.length} things` : undefined}>
      <View role="radiogroup" accessibilityLabel={title} style={{ gap: space.sm }}>
        {looks.map((look) => (
          <Choice
            key={look.id ?? 'host'}
            label={look.name}
            detail={look.role}
            selected={current !== undefined && current === look.id}
            onPress={() => pick(look.id)}
          />
        ))}
        {picked || itemIds.length > 1 ? <Choice label="The sheet’s pick" detail="A brand’s own bottles go to the brand, the visiting bar’s house preps to them, the rest to the bar it’s at" selected={false} onPress={() => pick('default')} /> : null}
      </View>
    </MenuSheet>
  );
}
