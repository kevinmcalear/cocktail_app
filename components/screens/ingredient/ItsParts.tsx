import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { ListGroup, ListRow, SectionLabel } from '@/components/ds/ListGroup';
import { space } from '@/constants/tokens';
import type { ItsPart } from '@/hooks/useItsParts';

/**
 * Its parts (board Add-parts, "Saves together: its parts"): each house-made
 * it's made from, and theirs indented under them. Each opens its own page,
 * with Back named for this one.
 */
export function ItsParts({ itemId, parts }: { itemId: string; parts: ItsPart[] }) {
  const router = useRouter();
  if (!parts.length) return null;
  return (
    <View>
      <SectionLabel title="Its parts" />
      <ListGroup>
        {parts.map((p, i) => (
          <ListRow
            key={`${p.level}:${p.id}`}
            first={i === 0}
            title={p.name}
            detail={p.detail}
            lead={p.level > 2 ? <View style={{ width: (p.level - 2) * space.lg }} /> : undefined}
            onPress={() => router.push(`/ingredient/${p.id}?from=${itemId}` as Href)}
          />
        ))}
      </ListGroup>
    </View>
  );
}
