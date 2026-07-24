import { CategoryTree, CategoryTreeNode } from '@/components/CategoryTree';
import { SearchItem } from '@/components/SearchList';
import { SpecPillButton } from '@/components/SpecPillButton';
import { VenueContextPicker } from '@/components/VenueContextPicker';
import { AdaptiveSheetModal } from '@/components/ui/AdaptiveSheetModal';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useDrafts } from '@/hooks/useDrafts';
import { useDropdowns } from '@/hooks/useDropdowns';
import { recentMatchesContext } from '@/hooks/useTrackRecent';
import {
  AttrKey,
  AttrSelection,
  EMPTY_ATTRS,
  allowedAttrKeys,
  appliedAttrPills,
  pruneAttrs,
} from '@/lib/commandFilterAttrs';
import { capitalize } from '@/lib/stringUtils';
import { useAppStore } from '@/store/useAppStore';
import { openDraftInCreator, openInCreator } from '@/store/useCreatorNavStore';
import { RecentActivity, useRecentActivityStore } from '@/store/useRecentActivityStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text, XStack, YStack, useTheme } from 'tamagui';

type AttrOption = {
  id: string;
  label: string;
  iconKey?: string | null;
  iconUrl?: string | null;
};

type AttrRow = {
  key: AttrKey;
  label: string;
  options: AttrOption[];
  /** Hierarchical domains (spirit/beer/wine) — roots become section headers. */
  tree?: CategoryTreeNode[];
};

function toTree(cats: { id: string; name: string; parent_id: string | null }[]): CategoryTreeNode[] {
  return cats.map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id }));
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export const COMMAND_FILTERS = ['All', 'Menus', 'Cocktails', 'Beer', 'Wine', 'Ingredients'] as const;
export type CommandFilter = (typeof COMMAND_FILTERS)[number];

/** Home search + filter chrome width on web. */
export const HOME_CHROME_MAX = 880;

export function searchPlaceholder(filter: CommandFilter = 'All') {
  if (filter === 'All') return 'Search menus, cocktails, beer, wine…';
  return `Search ${filter.toLowerCase()}`;
}

const FILTER_TO_CATEGORY: Record<Exclude<CommandFilter, 'All'>, SearchItem['category']> = {
  Menus: 'Menu',
  Cocktails: 'Cocktail',
  Beer: 'Beer',
  Wine: 'Wine',
  Ingredients: 'Ingredient',
};

const SECTION_ORDER: SearchItem['category'][] = [
  'Menu',
  'Cocktail',
  'Beer',
  'Wine',
  'Ingredient',
];

const DRAFT_AMBER = '#E5A93B';

const SECTION_LABEL: Record<string, string> = {
  Menu: 'Menu',
  Cocktail: 'Cocktail',
  Beer: 'Beer',
  Wine: 'Wine',
  Ingredient: 'Ingredient',
  menu: 'Menu',
  cocktail: 'Cocktail',
  beer: 'Beer',
  wine: 'Wine',
  ingredient: 'Ingredient',
  quiz: 'Quiz',
};

type Selectable =
  | { kind: 'item'; id: string; item: SearchItem }
  | { kind: 'recent'; id: string; recent: RecentActivity };

type ListRow =
  | { type: 'header'; id: string; label: string }
  | { type: 'grid'; id: string; cells: Selectable[] };

function timeAgo(at: number) {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function categoryIcon(category?: SearchItem['category'] | RecentActivity['kind']) {
  switch (category) {
    case 'Menu':
    case 'menu':
      return 'TabMenus' as const;
    case 'Beer':
    case 'beer':
      return 'Beer' as const;
    case 'Wine':
    case 'wine':
      return 'Wine' as const;
    case 'Ingredient':
    case 'ingredient':
      return 'TabIngredients' as const;
    case 'quiz':
      return 'TabTest' as const;
    default:
      return 'TabDrinks' as const;
  }
}

function itemImageUrl(item: SearchItem): string | null {
  if (item.image?.uri) return item.image.uri as string;
  const url = item.item_images?.[0]?.images?.url;
  return url || null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function gridColumns(width: number) {
  if (width >= 720) return 6;
  if (width >= 520) return 5;
  if (width >= 400) return 4;
  return 3;
}

type CommandSearchProps = {
  items: SearchItem[];
  placeholder?: string;
  initialQuery?: string;
  initialFilter?: CommandFilter;
  /** Controlled query — when set, parent owns the text field. */
  query?: string;
  onQueryChange?: (query: string) => void;
  filter?: CommandFilter;
  onFilterChange?: (filter: CommandFilter) => void;
  /** Hide venue picker + input (home screen owns those). */
  hideChrome?: boolean;
  autoFocus?: boolean;
  showFooter?: boolean;
  onSelect?: () => void;
  /** Home: click left/right of the filter chrome to collapse. */
  onDismiss?: () => void;
};

export function CommandSearch({
  items,
  placeholder,
  initialQuery = '',
  initialFilter = 'All',
  query: queryProp,
  onQueryChange,
  filter: filterProp,
  onFilterChange,
  hideChrome = false,
  autoFocus = false,
  showFooter = true,
  onSelect,
  onDismiss,
}: CommandSearchProps) {
  const theme = useTheme();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  const [queryInternal, setQueryInternal] = useState(initialQuery);
  const [filterInternal, setFilterInternal] = useState<CommandFilter>(initialFilter);
  const query = queryProp ?? queryInternal;
  const setQuery = onQueryChange ?? setQueryInternal;
  const filter = filterProp ?? filterInternal;
  const setFilter = (next: CommandFilter) => {
    if (onFilterChange) onFilterChange(next);
    else setFilterInternal(next);
  };
  const resolvedPlaceholder = placeholder ?? searchPlaceholder(filter);
  const [attrs, setAttrs] = useState<AttrSelection>(EMPTY_ATTRS);
  const [draftAttrs, setDraftAttrs] = useState<AttrSelection>(EMPTY_ATTRS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelWidth, setPanelWidth] = useState(0);
  const recent = useRecentActivityStore((s) => s.items);
  const selectedContextIds = useAppStore((s) => s.selectedContextIds);
  const setSelectedMenuId = useAppStore((s) => s.setSelectedMenuId);
  const { data: dropdowns } = useDropdowns();
  const { drafts } = useDrafts();

  const color = theme.color?.get() as string;
  const muted = theme.color11?.get() as string;
  const border = theme.borderColor?.get() as string;
  const surface = theme.color4?.get() as string;
  const searchSurface = theme.backgroundStrong?.get() as string;
  const highlight = 'rgba(255,255,255,0.1)';

  const cols = gridColumns(panelWidth || windowWidth);
  const gap = 6;
  const padH = hideChrome ? 0 : 10;
  const cellW =
    panelWidth > 0
      ? (panelWidth - padH * 2 - gap * (cols - 1)) / cols
      : 72;

  const allowedKeys = useMemo(() => allowedAttrKeys(filter), [filter]);

  const attrRows = useMemo((): AttrRow[] => {
    const cats = dropdowns?.categories || [];
    const byDomain = (domain: string | null) =>
      cats.filter((c: any) => (domain === null ? !c.domain : c.domain === domain));
    const allowed = new Set(allowedKeys);
    const withIcons = (items: any[]): AttrOption[] =>
      items.map((i) => ({
        id: i.id,
        label: i.name,
        iconKey: i.icon_key ?? null,
        iconUrl: i.icon_url ?? null,
      }));
    const domainRow = (
      key: AttrKey,
      label: string,
      domain: string
    ): AttrRow => {
      const list = byDomain(domain);
      return {
        key,
        label,
        options: list.map((c: any) => ({ id: c.id, label: c.name })),
        tree: list.some((c: any) => c.parent_id) ? toTree(list) : undefined,
      };
    };

    return [
      {
        key: 'method' as AttrKey,
        label: 'Method',
        options: withIcons(dropdowns?.methods || []),
      },
      {
        key: 'glassware' as AttrKey,
        label: 'Glassware',
        options: withIcons(dropdowns?.glassware || []),
      },
      {
        key: 'ice' as AttrKey,
        label: 'Ice',
        options: withIcons(dropdowns?.iceTypes || []),
      },
      {
        key: 'family' as AttrKey,
        label: 'Family',
        options: withIcons(dropdowns?.families || []),
      },
      {
        key: 'category' as AttrKey,
        label: 'Category',
        options: (() => {
          const seen = new Set<string>();
          return byDomain(null)
            .concat(byDomain('cocktail_family'))
            .concat(byDomain('glassware_style'))
            .filter((c: any) => {
              if (seen.has(c.id)) return false;
              seen.add(c.id);
              return true;
            })
            .map((c: any) => ({ id: c.id, label: c.name }));
        })(),
      },
      domainRow('beerStyle', 'Beer', 'beer'),
      domainRow('wineStyle', 'Wine', 'wine'),
      domainRow('spirit', 'Spirit', 'spirit'),
    ].filter((row) => allowed.has(row.key) && row.options.length > 0);
  }, [dropdowns, allowedKeys]);

  const appliedPills = useMemo(() => {
    const labelMap = new Map<string, string>();
    for (const row of attrRows) {
      for (const o of row.options) labelMap.set(`${row.key}:${o.id}`, o.label);
    }
    return appliedAttrPills(attrs, (key, id) => labelMap.get(`${key}:${id}`));
  }, [attrs, attrRows]);

  useEffect(() => {
    setAttrs((prev) => pruneAttrs(prev, filter));
  }, [filter]);

  const openFilters = useCallback(() => {
    setDraftAttrs(attrs);
    setFiltersOpen(true);
  }, [attrs]);

  const applyFilters = useCallback(() => {
    setAttrs(pruneAttrs(draftAttrs, filter));
    setFiltersOpen(false);
  }, [draftAttrs, filter]);

  const removeAttr = useCallback((key: AttrKey, id: string) => {
    setAttrs((prev) => ({ ...prev, [key]: prev[key].filter((x) => x !== id) }));
  }, []);

  const toggleDraftAttr = useCallback((key: AttrKey, id: string) => {
    setDraftAttrs((prev) => ({ ...prev, [key]: toggleId(prev[key], id) }));
  }, []);

  const filtered = useMemo(() => {
    let result = items;
    if (filter !== 'All') {
      const cat = FILTER_TO_CATEGORY[filter];
      result = result.filter((i) => i.category === cat);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.recipes?.some((r) => r.ingredient?.name?.toLowerCase().includes(q))
      );
    }

    if (attrs.method.length) {
      result = result.filter((i) => i.method_id && attrs.method.includes(i.method_id));
    }
    if (attrs.glassware.length) {
      result = result.filter((i) => i.glassware_id && attrs.glassware.includes(i.glassware_id));
    }
    if (attrs.ice.length) {
      result = result.filter((i) => i.ice_id && attrs.ice.includes(i.ice_id));
    }
    if (attrs.family.length) {
      result = result.filter((i) => i.family_id && attrs.family.includes(i.family_id));
    }

    const categoryIds = [
      ...attrs.category,
      ...attrs.beerStyle,
      ...attrs.wineStyle,
      ...attrs.spirit,
    ];
    if (categoryIds.length) {
      result = result.filter((i) =>
        i.item_categories?.some((c) => categoryIds.includes(c.category_id))
      );
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, filter, query, attrs]);

  const recentFiltered = useMemo(() => {
    const draftIds = new Set(drafts.map((d: any) => d.id));
    const inVenue = recent
      .filter((r) => recentMatchesContext(r, selectedContextIds))
      .filter((r) => !r.isDraft || draftIds.has(r.id));
    if (filter === 'All') return inVenue;
    const cat = FILTER_TO_CATEGORY[filter];
    const kindMap: Record<string, RecentActivity['kind']> = {
      Menu: 'menu',
      Cocktail: 'cocktail',
      Beer: 'beer',
      Wine: 'wine',
      Ingredient: 'ingredient',
    };
    const kind = kindMap[cat || ''];
    return inVenue.filter((r) => r.kind === kind);
  }, [recent, filter, selectedContextIds, drafts]);

  const { rows, selectable } = useMemo(() => {
    const listRows: ListRow[] = [];
    const selectables: Selectable[] = [];
    const q = query.trim();
    const perSection = q ? 24 : 8;

    const pushGrid = (sectionId: string, cells: Selectable[]) => {
      chunk(cells, cols).forEach((group, i) => {
        listRows.push({ type: 'grid', id: `${sectionId}-row-${i}`, cells: group });
      });
    };

    if (!q && recentFiltered.length > 0) {
      listRows.push({ type: 'header', id: 'h-recent', label: 'Recent' });
      const cells: Selectable[] = recentFiltered.map((r) => {
        const cell: Selectable = {
          kind: 'recent',
          id: `recent-${r.kind}-${r.id}`,
          recent: r,
        };
        selectables.push(cell);
        return cell;
      });
      pushGrid('recent', cells);
    }

    // Group catalog by type — section headers replace right-side type labels
    for (const cat of SECTION_ORDER) {
      if (filter !== 'All' && FILTER_TO_CATEGORY[filter] !== cat) continue;
      const group = filtered.filter((i) => i.category === cat).slice(0, perSection);
      if (group.length === 0) continue;
      listRows.push({
        type: 'header',
        id: `h-${cat}`,
        label: SECTION_LABEL[cat!] || cat!,
      });
      const cells: Selectable[] = group.map((item) => {
        const cell: Selectable = {
          kind: 'item',
          id: `item-${item.category}-${item.id}`,
          item,
        };
        selectables.push(cell);
        return cell;
      });
      pushGrid(`sec-${cat}`, cells);
    }

    return { rows: listRows, selectable: selectables };
  }, [query, recentFiltered, filtered, filter, cols]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filter, attrs]);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const openItem = useCallback(
    (item: SearchItem) => {
      if (item.isDraft) {
        const draftId = item.id.replace(/^(beer|wine|menu)-/, '');
        const entityType =
          item.category === 'Menu'
            ? 'menu'
            : item.category === 'Beer'
              ? 'beer'
              : item.category === 'Wine'
                ? 'wine'
                : item.category === 'Ingredient'
                  ? 'ingredient'
                  : 'cocktail';
        openDraftInCreator(
          { id: draftId, entity_type: entityType, draft_data: { name: item.name } },
          (href) => router.push(href as any)
        );
        onSelect?.();
        return;
      }
      if (item.category === 'Menu') {
        setSelectedMenuId(item.id.replace('menu-', ''));
        router.push('/(tabs)/menus' as any);
      } else if (item.category === 'Beer') {
        router.push(`/beer/${item.id}` as any);
      } else if (item.category === 'Wine') {
        router.push(`/wine/${item.id}` as any);
      } else if (item.category === 'Ingredient') {
        router.push(`/ingredient/${item.id}` as any);
      } else {
        router.push(`/cocktail/${item.id}` as any);
      }
      onSelect?.();
    },
    [onSelect, router, setSelectedMenuId]
  );

  const openRecent = useCallback(
    (r: RecentActivity) => {
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
          (href) => router.push(href as any)
        );
        onSelect?.();
        return;
      }
      if (r.kind === 'menu') setSelectedMenuId(r.id);
      router.push(r.href as any);
      onSelect?.();
    },
    [onSelect, router, setSelectedMenuId]
  );

  const activate = useCallback(
    (index: number) => {
      const cell = selectable[index];
      if (!cell) return;
      if (cell.kind === 'recent') openRecent(cell.recent);
      else openItem(cell.item);
    },
    [selectable, openRecent, openItem]
  );

  const cycleFilter = useCallback(
    (dir: 1 | -1) => {
      const i = COMMAND_FILTERS.indexOf(filter);
      setFilter(COMMAND_FILTERS[(i + dir + COMMAND_FILTERS.length) % COMMAND_FILTERS.length]);
    },
    [filter, onFilterChange]
  );

  // ponytail: refs so one capture listener stays fresh without resubscribing
  const keyRef = useRef({ activeIndex, selectable, cols, activate, cycleFilter });
  keyRef.current = { activeIndex, selectable, cols, activate, cycleFilter };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const { activeIndex: idx, selectable: cells, cols: c, activate: open, cycleFilter: cycle } =
        keyRef.current;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + c, Math.max(0, cells.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - c, 0));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, cells.length - 1)));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        open(idx);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.code === 'BracketLeft' || e.code === 'BracketRight')
      ) {
        // capture + preventDefault so Chrome doesn't treat ⌘[ / ⌘] as history
        e.preventDefault();
        e.stopPropagation();
        cycle(e.code === 'BracketRight' ? 1 : -1);
      }
    };
    // capture: beat TextInput caret / submit handling
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  const mod = Platform.OS === 'ios' || Platform.OS === 'web' ? '⌘' : 'Ctrl';

  const renderCell = (cell: Selectable, selIndex: number) => {
    const isActive = selIndex === activeIndex;
    const isDraft =
      (cell.kind === 'item' && !!cell.item.isDraft) ||
      (cell.kind === 'recent' && !!cell.recent.isDraft);
    const title =
      cell.kind === 'recent' ? cell.recent.title : capitalize(cell.item.name);
    const imageUrl =
      cell.kind === 'recent'
        ? cell.recent.imageUrl || null
        : itemImageUrl(cell.item);
    const iconName =
      cell.kind === 'recent'
        ? categoryIcon(cell.recent.kind)
        : categoryIcon(cell.item.category);
    const meta =
      cell.kind === 'recent' ? timeAgo(cell.recent.at) : undefined;

    return (
      <Pressable
        key={cell.id}
        onPress={() => activate(selIndex)}
        {...(Platform.OS === 'web'
          ? { onHoverIn: () => setActiveIndex(selIndex) }
          : {})}
        accessibilityRole="button"
        accessibilityLabel={isDraft ? `${title} (draft)` : title}
        style={[
          styles.card,
          {
            width: cellW,
            borderColor: isDraft ? DRAFT_AMBER : isActive ? muted : border,
            backgroundColor: isActive ? highlight : surface || 'rgba(255,255,255,0.04)',
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
            <CustomIcon name={iconName} size={18} color={muted} />
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
          <YStack paddingHorizontal={5} paddingVertical={5} gap={1}>
            <Text fontSize={10} fontWeight="600" color="$color" numberOfLines={2}>
              {title}
            </Text>
            {!!meta && (
              <Text fontSize={9} color="$color11" numberOfLines={1}>
                {meta}
              </Text>
            )}
          </YStack>
        )}
      </Pressable>
    );
  };

  const filterChrome = (
    <YStack gap={6}>
      <XStack alignItems="center" gap={8}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <XStack gap={8} paddingBottom={2} alignItems="center">
            {COMMAND_FILTERS.map((f) => {
              const selected = filter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={f}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: selected ? highlight : 'transparent',
                      borderColor: selected ? 'transparent' : border,
                    },
                  ]}
                >
                  <Text
                    fontSize={13}
                    fontWeight="500"
                    color={selected ? '$color' : '$color11'}
                  >
                    {f}
                  </Text>
                </Pressable>
              );
            })}

            {attrRows.length > 0 && (
              <Pressable
                onPress={openFilters}
                accessibilityRole="button"
                accessibilityLabel="Additional filters"
                style={[
                  styles.pill,
                  {
                    backgroundColor: appliedPills.length ? highlight : 'transparent',
                    borderColor: appliedPills.length ? 'transparent' : border,
                    flexDirection: 'row',
                    gap: 6,
                  },
                ]}
              >
                <IconSymbol
                  name="line.3.horizontal.decrease"
                  size={14}
                  color={appliedPills.length ? color : muted}
                />
                <Text
                  fontSize={13}
                  fontWeight="500"
                  color={appliedPills.length ? '$color' : '$color11'}
                >
                  Filters
                  {appliedPills.length > 0 ? ` · ${appliedPills.length}` : ''}
                </Text>
              </Pressable>
            )}
          </XStack>
        </ScrollView>

        <VenueContextPicker />
      </XStack>

      {appliedPills.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap={8} paddingBottom={2}>
            {appliedPills.map((p) => (
              <Pressable
                key={`${p.key}-${p.id}`}
                onPress={() => removeAttr(p.key, p.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.label} filter`}
                style={[
                  styles.pill,
                  {
                    backgroundColor: highlight,
                    borderColor: 'transparent',
                    flexDirection: 'row',
                    gap: 6,
                  },
                ]}
              >
                <Text fontSize={12} fontWeight="500" color="$color">
                  {capitalize(p.label)}
                </Text>
                <IconSymbol name="xmark" size={11} color={muted} />
              </Pressable>
            ))}
          </XStack>
        </ScrollView>
      )}
    </YStack>
  );

  const chromeCentered = hideChrome && Platform.OS === 'web';

  return (
    <YStack
      flex={1}
      minHeight={0}
      backgroundColor="transparent"
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setPanelWidth((prev) => (prev === w ? prev : w));
      }}
    >
      {/* Outer press dismisses (home gutters); inner stops that for the chrome itself. */}
      <Pressable
        onPress={onDismiss}
        accessibilityRole={onDismiss ? 'button' : undefined}
        accessibilityLabel={onDismiss ? 'Dismiss search' : undefined}
        style={{
          width: '100%',
          alignItems: chromeCentered ? 'center' : 'stretch',
          paddingTop: hideChrome ? 2 : 12,
          paddingBottom: 8,
        }}
      >
        <Pressable
          onPress={onDismiss ? (e) => e.stopPropagation() : undefined}
          style={{
            width: '100%',
            maxWidth: chromeCentered ? HOME_CHROME_MAX : undefined,
            paddingHorizontal: hideChrome ? 0 : 16,
            gap: 8,
          }}
        >
          {!hideChrome && (
            <YStack
              borderRadius={16}
              borderWidth={1}
              borderColor={border}
              backgroundColor={searchSurface}
              overflow="hidden"
            >
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder={resolvedPlaceholder}
                placeholderTextColor={muted}
                autoFocus={autoFocus}
                style={[styles.inputBoxed, { color }]}
              />
            </YStack>
          )}
          {filterChrome}
        </Pressable>
      </Pressable>

      <AdaptiveSheetModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Additional filters"
        maxHeight="80%"
      >
        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 20 }}
        >
          {attrRows.map((row) =>
            row.tree ? (
              <CategoryTree
                key={row.key}
                categories={row.tree}
                selectedIds={draftAttrs[row.key]}
                onToggle={(id) => toggleDraftAttr(row.key, id)}
              />
            ) : (
              <YStack key={row.key} gap={8}>
                <Text
                  fontSize={11}
                  fontWeight="600"
                  color="$color11"
                  letterSpacing={0.7}
                  textTransform="uppercase"
                >
                  {row.label}
                </Text>
                <XStack flexWrap="wrap" gap={8}>
                  {row.options.map((o) => (
                    <SpecPillButton
                      key={o.id}
                      name={o.label}
                      iconKey={o.iconKey}
                      iconUrl={o.iconUrl}
                      selected={draftAttrs[row.key].includes(o.id)}
                      onPress={() => toggleDraftAttr(row.key, o.id)}
                    />
                  ))}
                </XStack>
              </YStack>
            )
          )}
        </ScrollView>
        <XStack paddingHorizontal={24} paddingTop={8} gap={10}>
          <Pressable
            onPress={() => setFiltersOpen(false)}
            style={[styles.applyBtn, { borderColor: border, flex: 1 }]}
          >
            <Text fontSize={15} fontWeight="600" color="$color11" textAlign="center">
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={applyFilters}
            style={[styles.applyBtn, { backgroundColor: color, borderColor: color, flex: 2 }]}
          >
            <Text
              fontSize={15}
              fontWeight="600"
              color="$backgroundStrong"
              textAlign="center"
            >
              Apply
            </Text>
          </Pressable>
        </XStack>
      </AdaptiveSheetModal>

      <View style={[styles.divider, { backgroundColor: border }]} />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: padH,
          paddingVertical: 8,
          paddingBottom: 16,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <YStack padding="$5" alignItems="center">
            <Text color="$color11" fontSize={14}>
              No results
            </Text>
          </YStack>
        }
        renderItem={({ item: row }) => {
          if (row.type === 'header') {
            return (
              <Text
                fontSize={10}
                fontWeight="600"
                color="$color11"
                letterSpacing={0.8}
                textTransform="uppercase"
                paddingTop={10}
                paddingBottom={6}
              >
                {row.label}
              </Text>
            );
          }

          return (
            <View style={[styles.gridRow, { gap }]}>
              {row.cells.map((cell) => {
                const selIndex = selectable.findIndex((s) => s.id === cell.id);
                return renderCell(cell, selIndex);
              })}
            </View>
          );
        }}
      />

      {showFooter && (
        <>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <XStack
            paddingHorizontal={14}
            paddingVertical={10}
            gap={16}
            alignItems="center"
            flexWrap="wrap"
          >
            <Hint label="Select" keys="↑↓←→" muted={muted} />
            <Hint label="Open" keys="↵" muted={muted} />
            <Hint label="Change Filter" keys={`${mod}[ or ${mod}]`} muted={muted} />
          </XStack>
        </>
      )}
    </YStack>
  );
}

function Hint({ label, keys, muted }: { label: string; keys: string; muted: string }) {
  return (
    <XStack alignItems="center" gap={6}>
      <Text fontSize={11} color="$color11" opacity={0.85}>
        {keys}
      </Text>
      <Text fontSize={11} color="$color11" opacity={0.65}>
        {label}
      </Text>
    </XStack>
  );
}

const styles = StyleSheet.create({
  inputBoxed: {
    fontSize: 17,
    fontWeight: '400',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: 'transparent',
    borderWidth: 0,
    outlineWidth: 0,
    outlineStyle: 'none',
    boxShadow: 'none',
  } as any,
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginBottom: 6,
  },
  card: {
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
