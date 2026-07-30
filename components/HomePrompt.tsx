import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/ctx/AuthContext';
import { useBars } from '@/hooks/useBars';
import { useDrafts } from '@/hooks/useDrafts';
import { PERSONAL_CONTEXT } from '@/lib/barContextFilter';
import { capitalize } from '@/lib/stringUtils';
import { useAppStore } from '@/store/useAppStore';
import { creatorCreateHref, openDraftInCreator, openInCreator } from '@/store/useCreatorNavStore';
import { RecentActivity, RecentKind, useRecentActivityStore } from '@/store/useRecentActivityStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text, XStack, YStack, useTheme } from 'tamagui';

// ponytail: local copy — importing CommandSearch pulled recentMatchesContext into Home's graph
const HOME_CHROME_MAX = 880;
const DRAFT_AMBER = '#E5A93B';

const ENTITY_SECTIONS = [
  { type: 'cocktail', label: 'Unfinished drinks', kind: 'cocktail' as const },
  { type: 'beer', label: 'Unfinished beer', kind: 'beer' as const },
  { type: 'wine', label: 'Unfinished wine', kind: 'wine' as const },
  { type: 'menu', label: 'Unfinished menus', kind: 'menu' as const },
  { type: 'ingredient', label: 'Unfinished ingredients', kind: 'ingredient' as const },
] as const;

// ponytail: menus open in Creator Hub (same as UniversalCreateButton)
const QUICK_CREATE = [
  { label: 'Drink', icon: 'TabDrinks' as const, route: '/add-cocktail' },
  { label: 'Beer', icon: 'Beer' as const, route: '/add-beer' },
  { label: 'Wine', icon: 'Wine' as const, route: '/add-wine' },
  { label: 'Ingredient', icon: 'TabIngredients' as const, route: '/add-ingredient' },
  { label: 'Menu', icon: 'TabMenus' as const, route: creatorCreateHref('menu', PERSONAL_CONTEXT) },
] as const;

type VenueGroup = {
  key: string;
  name: string;
  logoUrl: string | null;
  drafts: any[];
};

function timeGreeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

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

function draftTitle(d: { entity_type: string; draft_data?: any }) {
  const data = d.draft_data || {};
  const raw = data.name || data.menuName || `Untitled ${capitalize(d.entity_type || 'Draft')}`;
  return capitalize(raw);
}

function draftImageUrl(d: { draft_data?: any }) {
  return d.draft_data?.localImages?.[0]?.url || d.draft_data?.coverUrl || null;
}

/** Pad last row so flex:1 squares keep Jump Back In column widths. */
function chunkRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function HomePrompt() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { drafts } = useDrafts();
  const { data: userBars } = useBars();
  const setSelectedMenuId = useAppStore((s) => s.setSelectedMenuId);
  const recentItems = useRecentActivityStore((s) => s.items);
  // ponytail: override only — default is grid when ≤6, list when >6
  const [viewOverrides, setViewOverrides] = useState<Record<string, 'grid' | 'list'>>({});

  const firstName = (user?.user_metadata?.first_name as string | undefined)?.trim();
  const hello = firstName ? `${timeGreeting()}, ${firstName}` : timeGreeting();

  // ponytail: Jump Back In is last-touched, not search-context — venue filter hid Caretakers drafts on Home
  const recent = useMemo(() => {
    const draftIds = new Set(drafts.map((d: any) => d.id));
    return recentItems
      .filter((r) => !r.isDraft || draftIds.has(r.id))
      .slice(0, 3);
  }, [recentItems, drafts]);

  const venueGroups = useMemo((): VenueGroup[] => {
    const barMeta = new Map<string, { name: string; logoUrl: string | null }>();
    for (const ub of userBars || []) {
      const bar = Array.isArray(ub.bars) ? ub.bars[0] : ub.bars;
      if (!ub.bar_id) continue;
      barMeta.set(ub.bar_id, {
        name: bar?.name || 'Venue',
        logoUrl: bar?.logo_url || null,
      });
    }

    const byVenue = new Map<string, any[]>();
    for (const d of drafts) {
      const key = d.bar_id || PERSONAL_CONTEXT;
      const list = byVenue.get(key);
      if (list) list.push(d);
      else byVenue.set(key, [d]);
    }

    const groups: VenueGroup[] = [];
    for (const [key, venueDrafts] of byVenue) {
      venueDrafts.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      if (key === PERSONAL_CONTEXT) {
        groups.push({ key, name: 'Personal', logoUrl: null, drafts: venueDrafts });
      } else {
        const meta = barMeta.get(key);
        groups.push({
          key,
          name: meta?.name || 'Venue',
          logoUrl: meta?.logoUrl || null,
          drafts: venueDrafts,
        });
      }
    }

    // ponytail: venues by freshest draft, Personal last when tied to a real bar list
    groups.sort((a, b) => {
      if (a.key === PERSONAL_CONTEXT && b.key !== PERSONAL_CONTEXT) return 1;
      if (b.key === PERSONAL_CONTEXT && a.key !== PERSONAL_CONTEXT) return -1;
      const aAt = new Date(a.drafts[0]?.updated_at || 0).getTime();
      const bAt = new Date(b.drafts[0]?.updated_at || 0).getTime();
      return bAt - aAt;
    });
    return groups;
  }, [drafts, userBars]);

  const muted = theme.color11?.get() as string;
  const border = theme.borderColor?.get() as string;
  const cardSurface = theme.color4?.get() as string;
  const fg = theme.color?.get() as string;

  const pushCreator = (href: string) => router.push(href as any);

  const openRecent = (r: RecentActivity) => {
    if (r.isDraft) {
      openInCreator(
        {
          type:
            r.kind === 'menu'
              ? 'menu_draft'
              : r.kind === 'ingredient'
                ? 'ingredient_draft'
                : 'drink_draft',
          id: r.id,
          name: r.title,
        },
        pushCreator
      );
      return;
    }
    if (r.kind === 'menu') setSelectedMenuId(r.id);
    router.push(r.href as any);
  };

  const openDraft = (d: any) => {
    openDraftInCreator(d, pushCreator);
  };

  return (
    <ScrollView
      style={{ flex: 1, width: '100%' }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <YStack
        width="100%"
        maxWidth={HOME_CHROME_MAX}
        alignSelf="center"
        gap={28}
        paddingHorizontal={24}
        paddingTop={28}
        paddingBottom={40}
      >
        <YStack gap={14}>
          <YStack gap={6}>
            <Text
              fontSize={28}
              fontWeight="700"
              color="$color"
              letterSpacing={-0.4}
              lineHeight={34}
            >
              {hello}
            </Text>
            <Text fontSize={15} color="$color11" lineHeight={21}>
              {venueGroups.length > 0
                ? 'Pick up where you left off — your drafts are waiting.'
                : 'Your bar is clear. Start something below.'}
            </Text>
          </YStack>

          <XStack flexWrap="wrap" gap={8}>
            {QUICK_CREATE.map((item) => (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as any)}
                accessibilityRole="button"
                accessibilityLabel={`Create ${item.label}`}
                style={[
                  styles.quickCreate,
                  {
                    borderColor: border,
                    backgroundColor: cardSurface || 'rgba(255,255,255,0.04)',
                  },
                ]}
              >
                <CustomIcon name={item.icon} size={16} color={muted} />
                <Text fontSize={13} fontWeight="600" color="$color">
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </XStack>
        </YStack>

        {recent.length > 0 && (
          <YStack width="100%" gap={8}>
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
                    accessibilityLabel={
                      r.isDraft ? `Continue draft ${r.title}` : `Continue ${r.title}`
                    }
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
              {recent.length < 3 &&
                Array.from({ length: 3 - recent.length }).map((_, i) => (
                  <YStack key={`pad-${i}`} flex={1} />
                ))}
            </XStack>
          </YStack>
        )}

        {venueGroups.length > 0 && (
          <YStack width="100%" gap={20}>
            <Text
              fontSize={11}
              fontWeight="600"
              color="$color11"
              letterSpacing={0.7}
              textTransform="uppercase"
              paddingHorizontal={4}
              opacity={0.75}
            >
              Unfinished
            </Text>

            {venueGroups.map((group) => (
              <YStack key={group.key} gap={12}>
                <XStack alignItems="center" gap={10} paddingHorizontal={4}>
                  {group.logoUrl ? (
                    <Image
                      source={{ uri: group.logoUrl }}
                      style={styles.venueLogo}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <YStack
                      width={32}
                      height={32}
                      borderRadius={6}
                      alignItems="center"
                      justifyContent="center"
                      backgroundColor="$color5"
                    >
                      <IconSymbol
                        name={group.key === PERSONAL_CONTEXT ? 'person.circle.fill' : 'building.2.fill'}
                        size={18}
                        color={muted}
                      />
                    </YStack>
                  )}
                  <Text fontSize={17} fontWeight="700" color="$color" flex={1} numberOfLines={1}>
                    {group.name}
                  </Text>
                </XStack>

                <YStack gap={14}>
                  {ENTITY_SECTIONS.map((section) => {
                    const items = group.drafts.filter((d) => d.entity_type === section.type);
                    if (items.length === 0) return null;
                    const sectionKey = `${group.key}:${section.type}`;
                    const mode =
                      viewOverrides[sectionKey] ?? (items.length <= 6 ? 'grid' : 'list');
                    return (
                      <YStack key={section.type} gap={6}>
                        <XStack
                          alignItems="center"
                          justifyContent="space-between"
                          paddingHorizontal={4}
                          gap={8}
                        >
                          <Text fontSize={12} fontWeight="600" color="$color11" flex={1}>
                            {section.label}
                          </Text>
                          <XStack gap={2}>
                            <Pressable
                              onPress={() =>
                                setViewOverrides((prev) => ({ ...prev, [sectionKey]: 'grid' }))
                              }
                              accessibilityRole="button"
                              accessibilityLabel="Grid view"
                              accessibilityState={{ selected: mode === 'grid' }}
                              hitSlop={6}
                              style={styles.viewToggle}
                            >
                              <IconSymbol
                                name="square.grid.2x2"
                                size={15}
                                color={mode === 'grid' ? fg : muted}
                              />
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                setViewOverrides((prev) => ({ ...prev, [sectionKey]: 'list' }))
                              }
                              accessibilityRole="button"
                              accessibilityLabel="List view"
                              accessibilityState={{ selected: mode === 'list' }}
                              hitSlop={6}
                              style={styles.viewToggle}
                            >
                              <IconSymbol
                                name="list.bullet"
                                size={15}
                                color={mode === 'list' ? fg : muted}
                              />
                            </Pressable>
                          </XStack>
                        </XStack>

                        {mode === 'grid' ? (
                          <YStack gap={8}>
                            {chunkRows(items, 3).map((row) => (
                              <XStack key={row.map((d) => d.id).join('-')} gap={8} width="100%">
                                {row.map((d) => {
                                  const title = draftTitle(d);
                                  const imageUrl = draftImageUrl(d);
                                  return (
                                    <Pressable
                                      key={d.id}
                                      onPress={() => openDraft(d)}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Continue draft ${title}`}
                                      style={[
                                        styles.card,
                                        {
                                          borderColor: DRAFT_AMBER,
                                          backgroundColor:
                                            cardSurface || 'rgba(255,255,255,0.04)',
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
                                          <CustomIcon
                                            name={kindIcon(section.kind)}
                                            size={18}
                                            color={muted}
                                          />
                                          <Text
                                            fontSize={10}
                                            fontWeight="600"
                                            color="$color"
                                            numberOfLines={2}
                                            textAlign="center"
                                          >
                                            {title}
                                          </Text>
                                        </YStack>
                                      )}
                                      {!!imageUrl && (
                                        <YStack
                                          paddingHorizontal={5}
                                          paddingVertical={5}
                                          gap={1}
                                        >
                                          <Text
                                            fontSize={10}
                                            fontWeight="600"
                                            color="$color"
                                            numberOfLines={2}
                                          >
                                            {title}
                                          </Text>
                                          <Text fontSize={9} color="$color11" numberOfLines={1}>
                                            {timeAgo(new Date(d.updated_at).getTime())}
                                          </Text>
                                        </YStack>
                                      )}
                                    </Pressable>
                                  );
                                })}
                                {row.length < 3 &&
                                  Array.from({ length: 3 - row.length }).map((_, i) => (
                                    <YStack key={`pad-${i}`} flex={1} />
                                  ))}
                              </XStack>
                            ))}
                          </YStack>
                        ) : (
                          <YStack gap={4}>
                            {items.map((d) => (
                              <Pressable
                                key={d.id}
                                onPress={() => openDraft(d)}
                                accessibilityRole="link"
                                accessibilityLabel={`Continue ${draftTitle(d)}`}
                                style={[
                                  styles.draftRow,
                                  {
                                    borderColor: border,
                                    backgroundColor: cardSurface || 'rgba(255,255,255,0.04)',
                                  },
                                ]}
                              >
                                <XStack alignItems="center" gap={10} flex={1} minWidth={0}>
                                  <CustomIcon
                                    name={kindIcon(section.kind)}
                                    size={16}
                                    color={muted}
                                  />
                                  <Text
                                    fontSize={14}
                                    fontWeight="500"
                                    color="$color"
                                    flex={1}
                                    numberOfLines={1}
                                  >
                                    {draftTitle(d)}
                                  </Text>
                                </XStack>
                                <Text fontSize={12} fontWeight="600" color={DRAFT_AMBER}>
                                  Continue
                                </Text>
                              </Pressable>
                            ))}
                          </YStack>
                        )}
                      </YStack>
                    );
                  })}
                </YStack>
              </YStack>
            ))}
          </YStack>
        )}
      </YStack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  quickCreate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
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
  venueLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewToggle: {
    padding: 4,
    borderRadius: 6,
  },
});
