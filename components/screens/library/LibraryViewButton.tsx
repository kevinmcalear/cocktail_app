import { useState } from 'react';
import { View } from 'react-native';

import { GlassButton } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import type { Show } from '@/lib/libraryFilters';

import type { LibrarySegment } from './LibraryHead';

/** The views each segment of the switch holds (the old chip row's, now in the header's menu). */
export const SEGMENT_VIEWS: Record<LibrarySegment, Show[]> = {
  drinks: ['all', 'on-menu', 'staff', 'past', 'rnd', 'batched', 'cocktails', 'beer', 'wine', 'ready', 'needs'],
  house: ['preps', 'garnishes'],
  bottles: ['bottles', 'ingredients', 'needs-price'],
};

/**
 * Prod-drinks draws no filters, so every other view of the list (On menu,
 * Classics, Old drinks, R&D, Batched, Beer, Wine, the kit check, Ingredients,
 * Needs a price) sits behind one small button in the header.
 */
export function LibraryViewButton({ views, show, count, onPick }: { views: { value: Show; label: string }[]; show: Show; count: (value: Show) => number | null; onPick: (value: Show) => void }) {
  const [open, setOpen] = useState(false);
  if (views.length < 2) return null;
  return (
    <>
      <GlassButton icon="line.3.horizontal.decrease" accessibilityLabel="Show: choose a view of the list" onPress={() => setOpen(true)} />
      <MenuSheet visible={open} onClose={() => setOpen(false)} title="Show" plain>
        <View role="radiogroup" accessibilityLabel="Show" style={{ gap: space.sm }}>
          {views.map((f) => {
            const n = count(f.value);
            return (
              <Choice
                key={f.value}
                label={n == null ? f.label : `${f.label} · ${n}`}
                detail={undefined}
                selected={f.value === show}
                onPress={() => {
                  onPick(f.value);
                  setOpen(false);
                }}
              />
            );
          })}
        </View>
      </MenuSheet>
    </>
  );
}
