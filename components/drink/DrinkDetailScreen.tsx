import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Paragraph, Text, XStack, YStack, useTheme } from 'tamagui';

import { ItemDetailLayout } from '@/components/ItemDetailLayout';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useFavorites } from '@/hooks/useFavorites';
import { useStudyPile } from '@/hooks/useStudyPile';
import { recentEntry, useTrackRecent } from '@/hooks/useTrackRecent';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { bareItemId, DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';

const PLACEHOLDER_IMAGE = require('@/assets/images/cocktails/house_martini.jpg');

function Pill({ icon, children }: { icon?: ComponentProps<typeof IconSymbol>['name']; children: string }) {
  const theme = useTheme();
  return (
    <XStack
      alignItems="center"
      gap="$2"
      backgroundColor="$backgroundStrong"
      borderWidth={1}
      borderColor="$borderColor"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$10"
    >
      {icon ? <IconSymbol name={icon} size={16} color={theme.color?.get() as string} /> : null}
      <Text color="$color" fontSize={14} fontWeight="500">
        {children}
      </Text>
    </XStack>
  );
}

/** A beer or wine: photos, maker, tags, strength, price, description and notes. */
export function DrinkDetailScreen({ kind: kindName }: { kind: DrinkKind }) {
  const kind = DRINK_KINDS[kindName];
  const { id } = useLocalSearchParams<{ id?: string }>();
  const safeId = bareItemId(kind.kind, id);
  const router = useRouter();
  const theme = useTheme();

  const { isFavorite, toggleFavorite } = useFavorites();
  const { toggleStudyPile, isInStudyPile } = useStudyPile();
  const { data: dropdowns } = useDropdowns();
  const { data: item, isLoading } = kind.useItem(safeId);
  const canEdit = useEffectiveRole() > 30;
  const [notesExpanded, setNotesExpanded] = useState(false);

  useTrackRecent(
    !!item,
    item
      ? recentEntry(kind.kind, item.id, item.name, {
          imageUrl: item.item_images?.[0]?.images?.url,
          barId: item.bar_id ?? null,
        })
      : null
  );

  if (isLoading || !item) {
    return (
      <ItemDetailLayout
        id={id as string}
        title="Not Found"
        images={[]}
        isLoading={isLoading}
        isFavorite={false}
        isInStudyPile={false}
        onToggleFavorite={() => {}}
        onToggleStudyPile={() => {}}
      >
        <YStack style={styles.container} justifyContent="center" alignItems="center">
          <Text color="$color">{`${kind.label} not found.`}</Text>
        </YStack>
      </ItemDetailLayout>
    );
  }

  const images = (item.item_images?.map((img: any) => img.images?.url).filter(Boolean) as string[]) || [];
  if (images.length === 0) images.push(PLACEHOLDER_IMAGE);

  // Style and region are stored as tags.
  const tagNames: string[] = (item.item_categories ?? [])
    .map((ic: any) => dropdowns?.categories?.find((c: any) => c.id === ic.category_id)?.name)
    .filter(Boolean);
  const prefixedId = `${kind.kind}-${item.id}`;

  return (
    <ItemDetailLayout
      id={prefixedId}
      title={item.name}
      images={images}
      isFavorite={isFavorite(prefixedId)}
      isInStudyPile={isInStudyPile(prefixedId)}
      onToggleFavorite={toggleFavorite}
      onToggleStudyPile={toggleStudyPile}
      onEditPress={canEdit ? () => router.push(`/${kind.kind}/${id}/edit`) : undefined}
    >
      <XStack flexWrap="wrap" gap="$2" paddingHorizontal="$4" marginBottom="$4">
        {item.brand_maker ? <Pill icon={kind.maker.icon}>{item.brand_maker}</Pill> : null}
        {tagNames.map((tag) => (
          <Pill key={tag}>{tag}</Pill>
        ))}
        {item.abv != null ? <Pill icon="percent">{`${item.abv}% ABV`}</Pill> : null}
        {item.price != null && item.price !== '' ? <Pill icon="dollarsign.circle.fill">{`$${item.price}`}</Pill> : null}
      </XStack>

      {(item.description || item.notes) && (
        <YStack gap="$3" paddingHorizontal="$4" marginBottom="$4">
          {item.description ? (
            <Paragraph color="$color" fontSize={16} lineHeight={24}>
              {item.description}
            </Paragraph>
          ) : null}
          {item.notes ? (
            <TouchableOpacity
              style={[
                styles.notesToggle,
                { backgroundColor: theme.backgroundStrong?.get() as string, borderColor: theme.borderColor?.get() as string },
              ]}
              onPress={() => setNotesExpanded(!notesExpanded)}
              activeOpacity={0.7}
              accessibilityRole="button"
              aria-expanded={notesExpanded}
            >
              <XStack alignItems="center" gap="$2">
                <IconSymbol name="note.text" size={16} color={theme.color?.get() as string} style={{ opacity: 0.8 }} />
                <Text color="$color" fontSize={14} fontWeight="bold" textTransform="uppercase" letterSpacing={1}>
                  Notes
                </Text>
                <View style={{ flex: 1 }} />
                <IconSymbol
                  name={notesExpanded ? 'chevron.up' : 'chevron.down'}
                  size={14}
                  color={theme.color?.get() as string}
                  style={{ opacity: 0.6 }}
                />
              </XStack>
              {notesExpanded ? (
                <Paragraph color="$color" fontSize={16} lineHeight={24} marginTop="$3" opacity={0.9}>
                  {item.notes}
                </Paragraph>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </YStack>
      )}
    </ItemDetailLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notesToggle: { padding: 16, borderRadius: 12, width: '100%', borderWidth: 1 },
});
