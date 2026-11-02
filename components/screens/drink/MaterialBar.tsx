import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { GlassButton } from '@/components/ds';
import type { Tones } from '@/lib/tones';

import type { Controls } from './ItemHeader';

/** Android only (MaterialBar.android.tsx): iOS has the system's bar, the web PageControls. */
export function MaterialPage({ children }: { liquid: string | null; photo: boolean; bar: boolean; glide: { scrollY: SharedValue<number>; top: number; left: number; width: number } | null; children: ReactNode }) {
  return <>{children}</>;
}

export function MaterialBar(_: { name: string; top: number; photo: boolean; hero: number; width: number; scrollY: SharedValue<number>; smallAt?: number; noBack?: boolean; controls: Controls; drawing: ReactNode }) {
  return null;
}

export const useItemTones = (): Tones | null => null;

/** Android's list tiles (RowGroup): a tile's look by its place in the group. */
export const useTile = (): ((index: number, count: number) => object) | null => null;

/** The dock's end beside Android's Back. */
export const MATERIAL_DOCK = { left: 0, top: 0 };

/** More's button in the bar: the glass one, off Android. */
export const BarButton = GlassButton;
