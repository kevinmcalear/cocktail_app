import { CommandFilter, CommandSearch } from '@/components/CommandSearch';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from 'tamagui';

type SearchPopoverProps = {
  visible: boolean;
  onClose: () => void;
  initialQuery?: string;
  initialFilter?: CommandFilter;
};

/** Cursor-style search palette (overlay only — not the home screen). */
export function SearchPopover({
  visible,
  onClose,
  initialQuery = '',
  initialFilter = 'All',
}: SearchPopoverProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const { items, error } = useSearchCatalog();

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
            key={`${initialQuery}|${initialFilter}|${visible}`}
            items={items}
            initialQuery={initialQuery}
            initialFilter={initialFilter}
            autoFocus
            showFooter
            onSelect={onClose}
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
