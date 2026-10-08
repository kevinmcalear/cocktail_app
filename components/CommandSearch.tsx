import { CategoryTree, CategoryTreeNode } from '@/components/CategoryTree';
import { heroPicture } from '@/lib/itemImages';
import type { SearchItem } from '@/types/search';
import { SpecPillButton } from '@/components/SpecPillButton';
import { VenueContextPicker } from '@/components/VenueContextPicker';
import { AdaptiveSheetModal } from '@/components/ui/AdaptiveSheetModal';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PictureTag } from '@/components/ui/PictureTag';
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
import {
  createTypeFromFilter,
  isSectionDrinkItem,
  type SectionDrinkType,
} from '@/lib/sectionAllowedTypes';
import { capitalize } from '@/lib/stringUtils';
import { usePublicDrinks } from '@/hooks/usePublicDrinks';
import { caretCanMove, chunk, gridColumns, timeAgo } from '@/lib/commandSearchGrid';
import { compareSearchItems, matchesQuery, searchCardMeta, withPublicDrinks } from '@/lib/publicDrinks';
import { useAppStore } from '@/store/useAppStore';
import { openInCreator } from '@/store/useCreatorNavStore';
import { openSearchItem } from '@/lib/openSearchItem';
import { RecentActivity, useRecentActivityStore } from '@/store/useRecentActivityStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Body, Button, Caption, Chip, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { isApplePlatform } from '@/lib/platformKeys';

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
  return heroPicture(item.item_images)?.url ?? null;
}

type CommandSearchProps = {
  items: SearchItem[];
  placeholder?: string;
  initialQuery?: string;
  initialFilter?: CommandFilter;
  /** Limit which filter pills are shown (e.g. section drink types). */
  filters?: readonly CommandFilter[];
  /** Controlled query — when set, parent owns the text field. */
  query?: string;
  onQueryChange?: (query: string) => void;
  filter?: CommandFilter;
  onFilterChange?: (filter: CommandFilter) => void;
  /** Hide venue picker + input (home screen owns those). */
  hideChrome?: boolean;
  autoFocus?: boolean;
  showFooter?: boolean;
  /** Space under the results for a tab bar they scroll behind. */
  bottomInset?: number;
  onSelect?: () => void;
  /** Pick mode: select item instead of navigating (e.g. add to menu). */
  onItemSelect?: (item: SearchItem) => void;
  /** Long-press drink → drag onto menu Add zones (parent fades search). */
  onItemDragStart?: (item: SearchItem, pos: { x: number; y: number }) => void;
  /** Empty-state create — type comes from active filter + venue from parent. */
  onCreateNew?: (info: { name: string; type: SectionDrinkType }) => void;
  /** Lock venue selector to this context id (bar id or personal). */
  lockedContextId?: string;
  /** Home: click left/right of the filter chrome to collapse. */
  onDismiss?: () => void;
};

export function CommandSearch({
  items,
  placeholder,
  initialQuery = '',
  initialFilter = 'All',
  filters: filtersProp,
  query: queryProp,
  onQueryChange,
  filter: filterProp,
  onFilterChange,
  hideChrome = false,
  autoFocus = false,
  showFooter = true,
  bottomInset = 0,
  onSelect,
  onItemSelect,
  onItemDragStart,
  onCreateNew,
  lockedContextId,
  onDismiss,
}: CommandSearchProps) {
  const availableFilters = filtersProp?.length ? filtersProp : COMMAND_FILTERS;
  const ds = useDs();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
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
  const [inputFocused, setInputFocused] = useState(false);
  const recent = useRecentActivityStore((s) => s.items);
  const storeContextIds = useAppStore((s) => s.selectedContextIds);
  const selectedContextIds = lockedContextId ? [lockedContextId] : storeContextIds;
  const { data: dropdowns } = useDropdowns();
  const { drafts } = useDrafts();
  // Other bars' drinks, while typing. Not when picking for a menu or a venue's section.
  const showPublic = !onItemSelect && !lockedContextId && !!query.trim();
  const { data: publicDrinks } = usePublicDrinks(showPublic ? query : '');

  const color = ds.c.ink;
  const muted = ds.c.muted;
  const border = ds.c.line;
  const highlight = ds.c.raised;

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
    let result = withPublicDrinks(items, showPublic ? publicDrinks ?? [] : []);
    if (filter !== 'All') {
      const cat = FILTER_TO_CATEGORY[filter];
      result = result.filter((i) => i.category === cat);
    }
    const q = query.trim().toLowerCase();
    if (q) result = result.filter((i) => matchesQuery(i, q));

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

    return [...result].sort(compareSearchItems);
  }, [items, showPublic, publicDrinks, filter, query, attrs]);

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

    // Group catalog by type — section headers replace right-side type labels.
    // Other bars' drinks come last, under their own header.
    const sections = [
      ...SECTION_ORDER.map((cat) => ({ id: cat!, label: SECTION_LABEL[cat!] || cat!, has: (i: SearchItem) => i.category === cat && !i.fromBar })),
      { id: 'FromBars', label: 'From bars', has: (i: SearchItem) => !!i.fromBar },
    ];
    for (const { id: cat, label, has } of sections) {
      const group = filtered.filter(has).slice(0, perSection);
      if (group.length === 0) continue;
      listRows.push({ type: 'header', id: `h-${cat}`, label });
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
  }, [query, recentFiltered, filtered, cols]);

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
      if (onItemSelect) {
        // ponytail: caller closes (keeps palette open on reject, e.g. duplicate)
        onItemSelect(item);
        return;
      }
      openSearchItem(item, (href) => router.push(href as never));
      onSelect?.();
    },
    [onItemSelect, onSelect, router]
  );

  const openRecent = useCallback(
    (r: RecentActivity) => {
      if (onItemSelect) {
        const id =
          r.kind === 'beer' ? `beer-${r.id}` : r.kind === 'wine' ? `wine-${r.id}` : r.kind === 'menu' ? `menu-${r.id}` : r.id;
        const item = items.find((i) => i.id === id);
        if (item) onItemSelect(item);
        return;
      }
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
      router.push((r.kind === 'menu' && !r.isDraft ? `/menus/${encodeURIComponent(r.id)}` : r.href) as any);
      onSelect?.();
    },
    [items, onItemSelect, onSelect, router]
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
      const i = availableFilters.indexOf(filter);
      const len = availableFilters.length;
      if (i < 0 || len === 0) return;
      setFilter(availableFilters[(i + dir + len) % len]);
    },
    [availableFilters, filter, onFilterChange]
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
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && caretCanMove(e)) {
        // Typing: let left/right move the text cursor; they only move the grid
        // selection once the caret is at the edge of the query.
        return;
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

  const mod = isApplePlatform() ? '⌘' : 'Ctrl';

  const drinkFromCell = (cell: Selectable): SearchItem | null => {
    // Another bar's drink isn't dragged onto your menu.
    if (cell.kind === 'item') return isSectionDrinkItem(cell.item) && !cell.item.fromBar ? cell.item : null;
    const r = cell.recent;
    if (r.kind === 'menu' || r.kind === 'ingredient' || r.kind === 'quiz') return null;
    const id = r.kind === 'beer' ? `beer-${r.id}` : r.kind === 'wine' ? `wine-${r.id}` : r.id;
    const found = items.find((i) => i.id === id);
    return found && isSectionDrinkItem(found) ? found : null;
  };

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
    const meta = cell.kind === 'recent' ? timeAgo(cell.recent.at) : searchCardMeta(cell.item);
    const metaLine = meta ? (
      <Caption tone="muted" numberOfLines={1}>{meta}</Caption>
    ) : isDraft ? (
      <Caption tone="accent">Draft</Caption>
    ) : null;
    const dragItem = onItemDragStart ? drinkFromCell(cell) : null;

    return (
      <Pressable
        key={cell.id}
        onPress={() => activate(selIndex)}
        delayLongPress={350}
        onLongPress={
          dragItem && onItemDragStart
            ? (e) => {
                const ne = e.nativeEvent as {
                  pageX?: number;
                  pageY?: number;
                  clientX?: number;
                  clientY?: number;
                };
                // client* matches position:fixed + elementFromPoint
                onItemDragStart(dragItem, {
                  x: ne.clientX ?? ne.pageX ?? 0,
                  y: ne.clientY ?? ne.pageY ?? 0,
                });
              }
            : undefined
        }
        {...(Platform.OS === 'web'
          ? { onHoverIn: () => setActiveIndex(selIndex) }
          : {})}
        role="button"
        aria-label={isDraft ? `${title} (draft)` : meta && cell.kind === 'item' ? `${title}, ${meta}` : title}
        style={[
          styles.card,
          {
            width: cellW,
            borderColor: isDraft ? ds.accentText : isActive ? ds.c.lineStrong : border,
            backgroundColor: isActive ? highlight : ds.c.surface,
          },
        ]}
      >
        {imageUrl ? (
          <View>
            <Image
              source={{ uri: imageUrl }}
              style={[styles.cardImage, { backgroundColor: ds.c.raised }]}
              contentFit="cover"
              transition={200}
            />
            <PictureTag
              label={cell.kind === 'item' && cell.item.imageIsSketch ? 'Sketch' : null}
              style={{ right: 4, bottom: 4, paddingHorizontal: 4, paddingVertical: 2 }}
            />
          </View>
        ) : (
          <View style={[styles.cardBlank, { backgroundColor: ds.c.raised }]}>
            <CustomIcon name={iconName} size={20} color={muted} />
            <Caption numberOfLines={2} align="center">
              {title}
            </Caption>
            {cell.kind === 'item' && metaLine}
          </View>
        )}
        {!!imageUrl && (
          <View style={styles.cardText}>
            <Caption numberOfLines={2}>{title}</Caption>
            {metaLine}
          </View>
        )}
      </Pressable>
    );
  };

  const filterChrome = (
    <View style={styles.chrome}>
      <View style={styles.chromeRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.fill}>
          <View style={styles.pills} role="radiogroup" aria-label="Show">
            {availableFilters.map((f) => (
              <Chip key={f} label={f} quiet selected={filter === f} onPress={() => setFilter(f)} />
            ))}

            {attrRows.length > 0 && (
              <Pressable
                onPress={openFilters}
                role="button"
                aria-label="Additional filters"
                style={[
                  styles.pill,
                  appliedPills.length
                    ? { backgroundColor: color, borderColor: color }
                    : { backgroundColor: 'transparent', borderColor: ds.c.lineStrong },
                ]}
              >
                <IconSymbol name="line.3.horizontal.decrease" size={14} color={appliedPills.length ? ds.c.ground : color} />
                <Caption color={appliedPills.length ? ds.c.ground : color}>
                  Filters
                  {appliedPills.length > 0 ? ` · ${appliedPills.length}` : ''}
                </Caption>
              </Pressable>
            )}
          </View>
        </ScrollView>

        <VenueContextPicker lockedContextId={lockedContextId} />
      </View>

      {appliedPills.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.pills}>
            {appliedPills.map((p) => (
              <Pressable
                key={`${p.key}-${p.id}`}
                onPress={() => removeAttr(p.key, p.id)}
                role="button"
                aria-label={`Remove ${p.label} filter`}
                style={[styles.pill, { backgroundColor: highlight, borderColor: 'transparent' }]}
              >
                <Caption>{capitalize(p.label)}</Caption>
                <IconSymbol name="xmark" size={12} color={muted} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );

  const chromeCentered = hideChrome && Platform.OS === 'web';

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setPanelWidth((prev) => (prev === w ? prev : w));
      }}
    >
      {/* Outer press dismisses (home gutters); inner stops that for the chrome itself. Without onDismiss, both just close the keyboard. */}
      <Pressable
        onPress={onDismiss ?? Keyboard.dismiss}
        role={onDismiss ? 'button' : undefined}
        aria-label={onDismiss ? 'Dismiss search' : undefined}
        style={{
          width: '100%',
          alignItems: chromeCentered ? 'center' : 'stretch',
          paddingTop: hideChrome ? 2 : 12,
          paddingBottom: 8,
        }}
      >
        <Pressable
          onPress={onDismiss ? (e) => e.stopPropagation() : Keyboard.dismiss}
          style={{
            width: '100%',
            maxWidth: chromeCentered ? HOME_CHROME_MAX : undefined,
            paddingHorizontal: hideChrome ? 0 : 16,
            gap: 8,
          }}
        >
          {!hideChrome && (
            <View
              style={[
                styles.inputBox,
                // Visible focus (WCAG 2.4.7): the input's own outline is off.
                { borderColor: inputFocused ? ds.accentText : border, backgroundColor: ds.c.raised },
              ]}
            >
              <IconSymbol name="magnifyingglass" size={18} color={muted} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                accessibilityLabel="Search"
                placeholder={resolvedPlaceholder}
                placeholderTextColor={ds.c.faint}
                autoFocus={autoFocus}
                style={[styles.input, type.body, { color, fontFamily: fontFamilies.body }, NO_OUTLINE]}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} role="button" aria-label="Clear search" hitSlop={space.sm} style={[styles.clear, { backgroundColor: ds.c.lineStrong }]}>
                  <IconSymbol name="xmark" size={12} color={color} />
                </Pressable>
              ) : null}
            </View>
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
          contentContainerStyle={styles.sheetBody}
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
              <View key={row.key} style={styles.sheetGroup}>
                <Caption tone="muted" style={styles.label}>
                  {row.label}
                </Caption>
                <View style={styles.wrap}>
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
                </View>
              </View>
            )
          )}
        </ScrollView>
        <View style={styles.sheetActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setFiltersOpen(false)} style={styles.fill} />
          <Button label="Apply" onPress={applyFilters} style={styles.apply} />
        </View>
      </AdaptiveSheetModal>

      <View style={[styles.divider, { backgroundColor: border }]} />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: padH, paddingVertical: 8, paddingBottom: 16 + bottomInset, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Body tone="muted">No results</Body>
            {(() => {
              const name = query.trim();
              const type = onCreateNew ? createTypeFromFilter(filter, availableFilters) : null;
              if (!onCreateNew || !name || !type) return null;
              const label =
                type === 'cocktail' ? 'cocktail' : type === 'beer' ? 'beer' : 'wine';
              return (
                <Button
                  label={`Create ${label} “${name}”`}
                  variant="secondary"
                  icon="plus"
                  onPress={() => onCreateNew({ name, type })}
                />
              );
            })()}
          </View>
        }
        renderItem={({ item: row }) => {
          if (row.type === 'header') {
            return (
              <Caption tone="muted" style={[styles.label, styles.header]}>
                {row.label}
              </Caption>
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
          <View style={styles.footer}>
            <Hint label="Select" keys="↑↓←→" />
            <Hint label="Open" keys="↵" />
            <Hint label="Change Filter" keys={`${mod}[ or ${mod}]`} />
          </View>
        </>
      )}
    </View>
  );
}

function Hint({ label, keys }: { label: string; keys: string }) {
  return (
    <View style={styles.hint}>
      <Caption>{keys}</Caption>
      <Caption tone="muted">{label}</Caption>
    </View>
  );
}

// The field's own focus ring is off on web; the pill around it shows focus.
// RN's style types don't know 'none'.
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  fill: { flex: 1 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  input: { flex: 1, paddingVertical: space.md, backgroundColor: 'transparent', borderWidth: 0 },
  clear: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chrome: { gap: space.sm },
  chromeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pills: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: 2 },
  pill: {
    flexDirection: 'row',
    gap: space.sm,
    minHeight: layout.minTapTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textTransform: 'uppercase', letterSpacing: 0.8 },
  header: { paddingTop: space.md, paddingBottom: space.sm },
  sheetBody: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.xl },
  sheetGroup: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sheetActions: { flexDirection: 'row', paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  apply: { flex: 2 },
  empty: { padding: space.xl, alignItems: 'center', gap: space.md },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginBottom: space.sm,
  },
  card: {
    borderRadius: radius.control,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
  },
  cardBlank: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.sm },
  cardText: { paddingHorizontal: space.sm, paddingVertical: space.sm, gap: 2 },
});
