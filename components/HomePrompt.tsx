import { CommandFilter, CommandSearch } from '@/components/CommandSearch';
import { VenueContextPicker } from '@/components/VenueContextPicker';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { useDrafts } from '@/hooks/useDrafts';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { recentMatchesContext } from '@/hooks/useTrackRecent';
import { useAppStore } from '@/store/useAppStore';
import { RecentActivity, RecentKind, useRecentActivityStore } from '@/store/useRecentActivityStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, TextInput, UIManager } from 'react-native';
import { Text, XStack, YStack, useTheme } from 'tamagui';

const DRAFT_AMBER = '#E5A93B';

export const HOME_PILLS = ['Menus', 'Cocktails', 'Beer', 'Wine', 'Ingredients'] as const;
export type HomePill = (typeof HOME_PILLS)[number];

type HomePromptProps = {
  initialQuery?: string;
  initialFilter?: CommandFilter;
};

function timeAgo(at: number) {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function kindIcon(kind: RecentKind) {
  switch (kind) {
    case 'menu':
      return 'TabMenus' as const;
    case 'beer':
      return 'Beer' as const;
    case 'wine':
      return 'Wine' as const;
    case 'ingredient':
      return 'TabIngredients' as const;
    case 'quiz':
      return 'TabTest' as const;
    default:
      return 'TabDrinks' as const;
  }
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function HomePrompt({
  initialQuery = '',
  initialFilter = 'All',
}: HomePromptProps) {
  const theme = useTheme();
  const router = useRouter();
  const { items, error } = useSearchCatalog();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<CommandFilter>(initialFilter);
  const [expanded, setExpanded] = useState(initialQuery.length > 0 || initialFilter !== 'All');
  const setSelectedMenuId = useAppStore((s) => s.setSelectedMenuId);
  const selectedContextIds = useAppStore((s) => s.selectedContextIds);
  const recentItems = useRecentActivityStore((s) => s.items);
  const { drafts } = useDrafts();
  const recent = useMemo(() => {
    const draftIds = new Set(drafts.map((d: any) => d.id));
    return recentItems
      .filter((r) => recentMatchesContext(r, selectedContextIds))
      .filter((r) => !r.isDraft || draftIds.has(r.id))
      .slice(0, 3);
  }, [recentItems, selectedContextIds, drafts]);

  const muted = theme.color11?.get() as string;
  const color = theme.color?.get() as string;
  const border = theme.borderColor?.get() as string;
  const surface = theme.backgroundStrong?.get() as string;
  const cardSurface = theme.color4?.get() as string;

  useEffect(() => {
    if (error) console.error('HomePrompt catalog error:', error);
  }, [error]);

  const expand = (nextFilter: CommandFilter = filter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter(nextFilter);
    setExpanded(true);
  };

  const collapse = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(false);
    setFilter('All');
  };

  const onQueryChange = (next: string) => {
    setQuery(next);
    if (next.trim().length > 0 && !expanded) expand(filter);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        collapse();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  const openRecent = (r: RecentActivity) => {
    if (r.kind === 'menu' && !r.isDraft) setSelectedMenuId(r.id);
    router.push(r.href as any);
  };

  const searchChrome = (
    <YStack width="100%" gap={8}>
      <YStack
        width="100%"
        borderRadius={16}
        borderWidth={1}
        borderColor={border}
        backgroundColor={surface}
        overflow="hidden"
        style={styles.boxShadow as any}
      >
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="What do you want to do?"
          placeholderTextColor={muted}
          onSubmitEditing={() => expand(filter)}
          onFocus={() => {
            if (!expanded) expand(filter);
          }}
          returnKeyType="search"
          style={[styles.input, { color }]}
          // @ts-expect-error web
          outlineStyle="none"
        />
      </YStack>

      {!expanded && (
        <XStack alignItems="center" justifyContent="space-between" gap={8}>
          <XStack flex={1} flexWrap="wrap" gap={8} alignItems="center">
            {HOME_PILLS.map((pill) => (
              <Pressable
                key={pill}
                onPress={() => expand(pill)}
                accessibilityRole="button"
                accessibilityLabel={`Search ${pill}`}
                style={[styles.pill, { borderColor: border, backgroundColor: surface }]}
              >
                <Text fontSize={13} color="$color11" fontWeight="500">
                  {pill}
                </Text>
              </Pressable>
            ))}
          </XStack>
          <VenueContextPicker />
        </XStack>
      )}
    </YStack>
  );

  return (
    <YStack
      flex={1}
      justifyContent={expanded ? 'flex-start' : 'center'}
      alignItems="center"
      paddingHorizontal={24}
      paddingTop={expanded ? 12 : 0}
      minHeight={0}
      width="100%"
    >
      {/* Search stays capped; results below use the full panel width on web. */}
      <YStack width="100%" maxWidth={640} gap={14} alignItems="stretch">
        {searchChrome}

        {!expanded && recent.length > 0 && (
          <YStack width="100%" marginTop={20} gap={8}>
            <Text
              fontSize={11}
              fontWeight="600"
              color="$color11"
              letterSpacing={0.7}
              textTransform="uppercase"
              paddingHorizontal={4}
              opacity={0.75}
            >
              Jump back in
            </Text>
            <XStack gap={8} width="100%">
              {recent.map((r) => {
                const imageUrl = r.imageUrl || null;
                return (
                  <Pressable
                    key={`${r.kind}-${r.id}${r.isDraft ? '-draft' : ''}`}
                    onPress={() => openRecent(r)}
                    accessibilityRole="button"
                    accessibilityLabel={r.isDraft ? `Continue draft ${r.title}` : `Continue ${r.title}`}
                    style={[
                      styles.card,
                      {
                        borderColor: r.isDraft ? DRAFT_AMBER : border,
                        backgroundColor: cardSurface || 'rgba(255,255,255,0.04)',
                      },
                    ]}
                  >
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.cardImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <YStack
                        width="100%"
                        aspectRatio={1}
                        alignItems="center"
                        justifyContent="center"
                        backgroundColor="$color5"
                        gap={4}
                        padding={4}
                      >
                        <CustomIcon name={kindIcon(r.kind)} size={18} color={muted} />
                        <Text
                          fontSize={10}
                          fontWeight="600"
                          color="$color"
                          numberOfLines={2}
                          textAlign="center"
                        >
                          {r.title}
                        </Text>
                      </YStack>
                    )}
                    {!!imageUrl && (
                      <YStack paddingHorizontal={5} paddingVertical={5} gap={1}>
                        <Text fontSize={10} fontWeight="600" color="$color" numberOfLines={2}>
                          {r.title}
                        </Text>
                        <Text fontSize={9} color="$color11" numberOfLines={1}>
                          {timeAgo(r.at)}
                        </Text>
                      </YStack>
                    )}
                  </Pressable>
                );
              })}
            </XStack>
          </YStack>
        )}
      </YStack>

      {expanded && (
        <YStack flex={1} minHeight={0} width="100%" marginTop={8}>
          <CommandSearch
            items={items}
            hideChrome
            query={query}
            onQueryChange={onQueryChange}
            filter={filter}
            onFilterChange={setFilter}
            showFooter
          />
        </YStack>
      )}
    </YStack>
  );
}

const styles = StyleSheet.create({
  boxShadow: {
    boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
  },
  input: {
    fontSize: 17,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
});
