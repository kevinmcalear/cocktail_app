import { CommandFilter, CommandSearch } from '@/components/CommandSearch';
import type { SearchItem } from '@/components/SearchList';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import type { SectionDrinkType } from '@/lib/sectionAllowedTypes';
import { useMenuEditDropStore } from '@/store/useMenuEditDropStore';
import { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from 'tamagui';

type SearchPopoverProps = {
  visible: boolean;
  onClose: () => void;
  initialQuery?: string;
  initialFilter?: CommandFilter;
  /** Limit filter pills (e.g. section-allowed drink types). */
  filters?: readonly CommandFilter[];
  /** Override catalog (e.g. menu drink picker). */
  items?: SearchItem[];
  /** Pick mode: select instead of navigate. */
  onItemSelect?: (item: SearchItem) => void;
  /** Empty-state create from search query + active filter. */
  onCreateNew?: (info: { name: string; type: SectionDrinkType }) => void;
  /** Lock venue picker to this menu's venue. */
  lockedContextId?: string;
};

/** Cursor-style search palette (overlay only — not the home screen). */
export function SearchPopover({
  visible,
  onClose,
  initialQuery = '',
  initialFilter = 'All',
  filters,
  items: itemsProp,
  onItemSelect,
  onCreateNew,
  lockedContextId,
}: SearchPopoverProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const { items: catalogItems, error } = useSearchCatalog();
  const items = itemsProp ?? catalogItems;
  const canDropOnMenu = useMenuEditDropStore((s) => !!s.handler);
  const startDrag = useMenuEditDropStore((s) => s.startDrag);

  useEffect(() => {
    if (!visible || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  useEffect(() => {
    if (error) console.error('SearchPopover catalog error:', error);
  }, [error]);

  if (!visible) return null;

  const panelW = Math.min(720, width - 48);
  const panelH = Math.min(620, height - 80);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Dismiss search">
        <Pressable
          style={[
            styles.panel,
            {
              width: panelW,
              height: panelH,
              backgroundColor: theme.backgroundStrong?.get() as string,
              borderColor: theme.borderColor?.get() as string,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <CommandSearch
            key={`${initialQuery}|${initialFilter}|${filters?.join(',') ?? ''}|${visible}`}
            items={items}
            initialQuery={initialQuery}
            initialFilter={initialFilter}
            filters={filters}
            autoFocus
            showFooter
            onSelect={onClose}
            onItemSelect={onItemSelect}
            onItemDragStart={
              // ponytail: ⌘K + window pointer tracking is web; native still taps Add → select
              canDropOnMenu && Platform.OS === 'web'
                ? (item, pos) => {
                    onClose();
                    requestAnimationFrame(() => startDrag(item, pos.x, pos.y));
                  }
                : undefined
            }
            onCreateNew={onCreateNew}
            lockedContextId={lockedContextId}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 80,
  },
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    maxWidth: '100%',
    boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
  } as any,
});
