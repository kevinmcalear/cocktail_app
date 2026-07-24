import { DraftFolderTree } from '@/components/DraftFolderTree';
import { SearchPopover } from '@/components/SearchPopover';
import { UniversalCreateButton } from '@/components/UniversalCreateButton';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/ctx/AuthContext';
import { useBars } from '@/hooks/useBars';
import { useBeers } from '@/hooks/useBeers';
import { useCocktails } from '@/hooks/useCocktails';
import { useDrafts } from '@/hooks/useDrafts';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useIngredients } from '@/hooks/useIngredients';
import { useWines } from '@/hooks/useWines';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PERSONAL_CONTEXT } from '@/lib/barContextFilter';
import { useAppStore } from '@/store/useAppStore';
import { useCreatorNavStore } from '@/store/useCreatorNavStore';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Separator, Text, XStack, YStack, useTheme } from 'tamagui';

export const WEB_SIDEBAR_WIDTH = 240;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 400;

type NavItem = {
  href: string;
  label: string;
  icon: 'TabHome' | 'TabTest';
  match: (pathname: string) => boolean;
  requiresTesting?: boolean;
};

const NAV: NavItem[] = [
  {
    href: '/(tabs)',
    label: 'Home',
    icon: 'TabHome',
    match: (p) => p === '/' || p === '' || p === '/(tabs)' || p.endsWith('/index'),
  },
  {
    href: '/(tabs)/test',
    label: 'Quiz',
    icon: 'TabTest',
    match: (p) => p.includes('/test') || p.endsWith('test'),
    requiresTesting: true,
  },
];

function CurrentMenusNav({
  activeBg,
  selectedMenuId,
  onSelectMenu,
}: {
  activeBg: string;
  selectedMenuId: string | null;
  onSelectMenu: (menuId: string, menuName: string, barId?: string | null) => void;
}) {
  const theme = useTheme();
  const { data: userBars } = useBars();
  const { data: dropdowns } = useDropdowns();
  const [sectionOpen, setSectionOpen] = useState(false);
  const [openVenues, setOpenVenues] = useState<Record<string, boolean>>({});

  const menus = dropdowns?.menus || [];
  const menusByBar: Record<string, typeof menus> = {};
  const unassigned: typeof menus = [];
  menus.forEach((menu: any) => {
    if (menu.bar_id) {
      if (!menusByBar[menu.bar_id]) menusByBar[menu.bar_id] = [];
      menusByBar[menu.bar_id].push(menu);
    } else {
      unassigned.push(menu);
    }
  });

  const venues = (userBars || [])
    .map((barMapping: any) => {
      const bar = barMapping.bars;
      if (!bar) return null;
      const barId = barMapping.bar_id;
      const barMenus = menusByBar[barId] || [];
      if (barMenus.length === 0) return null;
      const name = (Array.isArray(bar) ? bar[0]?.name : bar?.name) || 'Unknown Bar';
      return { id: barId, name, menus: barMenus };
    })
    .filter(Boolean) as { id: string; name: string; menus: any[] }[];

  if (unassigned.length > 0) {
    venues.push({ id: PERSONAL_CONTEXT, name: 'Personal', menus: unassigned });
  }

  const isVenueOpen = (id: string) => openVenues[id] ?? false;

  if (venues.length === 0) return null;

  return (
    <YStack flexShrink={0} marginTop="$1">
      <TouchableOpacity
        onPress={() => setSectionOpen((v) => !v)}
        style={styles.sectionHeader}
        accessibilityLabel="Current Menus"
      >
        <IconSymbol
          name={sectionOpen ? 'chevron.down' : 'chevron.right'}
          size={12}
          color={theme.color11?.get() as string}
        />
        <CustomIcon name="TabMenus" size={16} color={theme.color11?.get() as string} />
        <Text fontSize={12} fontWeight="700" color="$color11" textTransform="uppercase" letterSpacing={0.6}>
          Current Menus
        </Text>
      </TouchableOpacity>

      {sectionOpen && (
        <YStack gap={2} paddingLeft={4}>
          {venues.map((venue) => {
            const open = isVenueOpen(venue.id);
            return (
              <YStack key={venue.id}>
                <TouchableOpacity
                  onPress={() => setOpenVenues((prev) => ({ ...prev, [venue.id]: !open }))}
                  style={styles.venueRow}
                >
                  <IconSymbol
                    name={open ? 'chevron.down' : 'chevron.right'}
                    size={11}
                    color={theme.color11?.get() as string}
                  />
                  <Text fontSize={13} fontWeight="600" color="$color" numberOfLines={1} flex={1}>
                    {venue.name}
                  </Text>
                </TouchableOpacity>
                {open &&
                  venue.menus.map((menu: any) => {
                    const selected = selectedMenuId === menu.id;
                    return (
                      <Pressable
                        key={menu.id}
                        onPress={() => onSelectMenu(menu.id, menu.name, menu.bar_id ?? null)}
                        style={[styles.menuRow, selected && { backgroundColor: activeBg }]}
                        accessibilityState={selected ? { selected: true } : {}}
                        accessibilityLabel={menu.name}
                      >
                        <Text
                          fontSize={13}
                          fontWeight={selected ? '600' : '500'}
                          color={selected ? '$color' : '$color11'}
                          numberOfLines={1}
                        >
                          {menu.name}
                        </Text>
                      </Pressable>
                    );
                  })}
              </YStack>
            );
          })}
        </YStack>
      )}
    </YStack>
  );
}

export function WebSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const { isTestingEnabled, isEditModeEnabled } = useSettingsStore();
  const selectedNode = useCreatorNavStore((s) => s.selectedNode);
  const setSelectedNode = useCreatorNavStore((s) => s.setSelectedNode);
  const requestCreate = useCreatorNavStore((s) => s.requestCreate);
  const selectedMenuId = useAppStore((s) => s.selectedMenuId);
  const setSelectedMenuId = useAppStore((s) => s.setSelectedMenuId);

  const { drafts } = useDrafts();
  const { data: publishedCocktails } = useCocktails({ allContexts: true });
  const { data: publishedBeers } = useBeers({ allContexts: true });
  const { data: publishedWines } = useWines({ allContexts: true });
  const { data: publishedIngredients } = useIngredients({ allContexts: true });

  const [sidebarWidth, setSidebarWidth] = useState(WEB_SIDEBAR_WIDTH);
  const [dragging, setDragging] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHovered, setSearchHovered] = useState(false);
  const widthRef = useRef(sidebarWidth);
  const pushRecent = useRecentActivityStore((s) => s.push);

  // ponytail: global ⌘K on the always-mounted sidebar — no search store
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const isDark = colorScheme === 'dark';
  const activeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const hoverBorder = theme.borderColor?.get() as string;
  const onSettings = pathname.includes('settings');
  const onResizeDown = useCallback(
    (e: any) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      setDragging(true);
      const startX = e.clientX as number;
      const startWidth = widthRef.current;
      const maxWidth = Math.min(SIDEBAR_MAX, Math.floor(windowWidth * 0.45));

      if (typeof document !== 'undefined') {
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }

      const onMove = (moveEvent: MouseEvent) => {
        const next = Math.min(
          maxWidth,
          Math.max(SIDEBAR_MIN, startWidth + (moveEvent.clientX - startX))
        );
        widthRef.current = next;
        setSidebarWidth(next);
      };
      const onUp = () => {
        setDragging(false);
        if (typeof document !== 'undefined') {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [windowWidth]
  );

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80';
  const displayName =
    user?.user_metadata?.full_name ||
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'Account';
  const email = user?.email || '';

  const items = NAV.filter((item) => !item.requiresTesting || isTestingEnabled);

  const goCreator = () => {
    if (!pathname.includes('edit-mode')) {
      router.push('/edit-mode' as any);
    }
  };

  const onSelectMenu = (menuId: string, menuName?: string, barId?: string | null) => {
    setSelectedMenuId(menuId);
    pushRecent({
      id: menuId,
      kind: 'menu',
      title: menuName || 'Menu',
      subtitle: 'Menu',
      href: '/(tabs)/menus',
      barId: barId ?? null,
    });
    if (!pathname.includes('menus') || pathname.includes('edit-mode')) {
      router.push('/(tabs)/menus' as any);
    }
  };

  return (
    <YStack
      width={sidebarWidth}
      height="100%"
      backgroundColor="$background"
      borderRightWidth={1}
      borderRightColor="$borderColor"
      paddingTop="$3"
      paddingBottom="$3"
      paddingHorizontal="$2"
      style={{ flexShrink: 0, position: 'relative' }}
    >
      <YStack gap="$1" flexShrink={0}>
        <Pressable
          accessibilityLabel="Search"
          accessibilityHint="Opens search. Shortcut Command K"
          onPress={() => setSearchOpen(true)}
          onHoverIn={() => setSearchHovered(true)}
          onHoverOut={() => setSearchHovered(false)}
          style={[
            styles.navItem,
            styles.searchTrigger,
            searchHovered && { backgroundColor: activeBg },
          ]}
        >
          <XStack alignItems="center" gap="$2.5" flex={1}>
            <IconSymbol
              name="magnifyingglass"
              size={18}
              color={theme.color11?.get() as string}
            />
            <Text fontSize={14} fontWeight="500" color="$color11" numberOfLines={1}>
              Search
            </Text>
          </XStack>
          <Text
            fontSize={12}
            fontWeight="500"
            color="$color11"
            style={{ opacity: searchHovered ? 1 : 0 }}
          >
            ⌘K
          </Text>
        </Pressable>

        {items.map((item) => {
          const isFocused = item.match(pathname);
          const color = isFocused
            ? (theme.color?.get() as string)
            : (theme.color11?.get() as string);

          return (
            <Pressable
              key={item.href}
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={item.label}
              onPress={() => router.push(item.href as any)}
              style={[styles.navItem, isFocused && { backgroundColor: activeBg }]}
            >
              <XStack alignItems="center" gap="$2.5" flex={1}>
                <CustomIcon name={item.icon} size={20} color={color} />
                <Text
                  fontSize={14}
                  fontWeight={isFocused ? '600' : '500'}
                  color={isFocused ? '$color' : '$color11'}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </XStack>
            </Pressable>
          );
        })}

        <CurrentMenusNav
          activeBg={activeBg}
          selectedMenuId={selectedMenuId}
          onSelectMenu={onSelectMenu}
        />
      </YStack>

      <SearchPopover visible={searchOpen} onClose={() => setSearchOpen(false)} />

      <Separator borderColor="$borderColor" marginVertical="$2" />

      <YStack flex={1} minHeight={0}>
        <DraftFolderTree
          drafts={drafts}
          publishedCocktails={publishedCocktails || []}
          publishedBeers={publishedBeers || []}
          publishedWines={publishedWines || []}
          publishedIngredients={publishedIngredients || []}
          selectedNode={selectedNode}
          personalLabel="Personal"
          groupBarsUnderVenues
          alwaysShowPersonal
          onNodeSelect={(node) => {
            setSelectedNode(node);
            goCreator();
          }}
          onCreateNode={(type, barId) => {
            requestCreate(type, barId);
            goCreator();
          }}
        />
      </YStack>

      <YStack gap="$2" flexShrink={0} paddingTop="$2">
        {isEditModeEnabled && (
          <View style={styles.createSlot}>
            <UniversalCreateButton variant="button" width="100%" />
          </View>
        )}

        <Pressable
          onPress={() => router.push('/settings' as any)}
          accessibilityLabel="Settings"
          accessibilityState={onSettings ? { selected: true } : {}}
          style={[
            styles.accountChip,
            { borderColor: hoverBorder },
            onSettings && { backgroundColor: activeBg },
          ]}
        >
          <XStack alignItems="center" gap="$2.5" flex={1}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            <YStack flex={1} minWidth={0}>
              <Text fontSize={13} fontWeight="600" color="$color" numberOfLines={1}>
                {displayName}
              </Text>
              {!!email && (
                <Text fontSize={11} color="$color11" numberOfLines={1}>
                  {email}
                </Text>
              )}
            </YStack>
          </XStack>
        </Pressable>
      </YStack>

      <View
        // @ts-expect-error web mouse handler
        onMouseDown={onResizeDown}
        style={[styles.resizeHandle, dragging && styles.resizeHandleActive]}
        accessibilityLabel="Resize sidebar"
      />
    </YStack>
  );
}

const styles = StyleSheet.create({
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  searchTrigger: {
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  menuRow: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    paddingLeft: 28,
    borderRadius: 6,
  },
  createSlot: {
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    right: -3,
    width: 6,
    height: '100%',
    cursor: 'col-resize',
    zIndex: 20,
  } as any,
  resizeHandleActive: {
    backgroundColor: 'rgba(127,127,127,0.25)',
  },
});
