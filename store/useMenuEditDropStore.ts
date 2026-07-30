import type { SearchItem } from '@/components/SearchList';
import {
  isSectionDrinkItem,
  itemAllowedInSection,
  type SectionDrinkType,
} from '@/lib/sectionAllowedTypes';
import { Platform } from 'react-native';
import { create } from 'zustand';

export type MenuDropRect = { x: number; y: number; w: number; h: number };

export type MenuDropHandler = {
  /** allowed_types per section id */
  allowedBySection: Record<string, SectionDrinkType[]>;
  tryAdd: (sectionId: string, item: SearchItem) => 'ok' | 'duplicate' | 'denied';
};

type DragState = {
  item: SearchItem;
  x: number;
  y: number;
  hoverSectionId: string | null;
};

type MenuEditDropState = {
  handler: MenuDropHandler | null;
  dropRects: Record<string, MenuDropRect>;
  drag: DragState | null;
  register: (handler: MenuDropHandler) => void;
  unregister: () => void;
  setDropRect: (sectionId: string, rect: MenuDropRect) => void;
  clearDropRect: (sectionId: string) => void;
  startDrag: (item: SearchItem, x: number, y: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
};

function hitSection(
  x: number,
  y: number,
  rects: Record<string, MenuDropRect>
): string | null {
  // ponytail: web uses DOM hit-test so scroll doesn't stale-measure; native uses rects
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const ghosts = document.querySelectorAll('[data-menu-drag-ghost]');
    ghosts.forEach((g) => {
      (g as HTMLElement).style.visibility = 'hidden';
    });
    const el = document.elementFromPoint(x, y);
    ghosts.forEach((g) => {
      (g as HTMLElement).style.visibility = '';
    });
    const node = (el as Element | null)?.closest?.('[data-menu-drop-section]') as HTMLElement | null;
    const fromDom = node?.getAttribute('data-menu-drop-section') ?? null;
    if (fromDom) return fromDom;
  }
  for (const [id, r] of Object.entries(rects)) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
  }
  return null;
}

function hoverFor(
  item: SearchItem,
  x: number,
  y: number,
  handler: MenuDropHandler | null,
  rects: Record<string, MenuDropRect>
): string | null {
  const sectionId = hitSection(x, y, rects);
  if (!sectionId || !handler) return null;
  const types = handler.allowedBySection[sectionId];
  if (!types || !itemAllowedInSection(item, types)) return null;
  return sectionId;
}

let removePointerListeners: (() => void) | null = null;

function bindPointerListeners(
  move: (x: number, y: number) => void,
  up: () => void,
  cancel: () => void
) {
  removePointerListeners?.();
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const onMove = (e: PointerEvent) => move(e.clientX, e.clientY);
    const onUp = () => up();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    removePointerListeners = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      removePointerListeners = null;
    };
    return;
  }
  removePointerListeners = null;
}

/** ponytail: bridge ⌘K / section picker → menu Add drop zones while editing */
export const useMenuEditDropStore = create<MenuEditDropState>((set, get) => ({
  handler: null,
  dropRects: {},
  drag: null,
  register: (handler) => set({ handler }),
  unregister: () => {
    removePointerListeners?.();
    set({ handler: null, dropRects: {}, drag: null });
  },
  setDropRect: (sectionId, rect) =>
    set((s) => ({ dropRects: { ...s.dropRects, [sectionId]: rect } })),
  clearDropRect: (sectionId) =>
    set((s) => {
      if (!(sectionId in s.dropRects)) return s;
      const { [sectionId]: _, ...rest } = s.dropRects;
      return { dropRects: rest };
    }),
  startDrag: (item, x, y) => {
    const { handler, dropRects } = get();
    if (!handler || !isSectionDrinkItem(item)) return;
    const hoverSectionId = hoverFor(item, x, y, handler, dropRects);
    set({ drag: { item, x, y, hoverSectionId } });
    bindPointerListeners(
      (mx, my) => {
        const state = get();
        if (!state.drag) return;
        const hover = hoverFor(state.drag.item, mx, my, state.handler, state.dropRects);
        set({ drag: { item: state.drag.item, x: mx, y: my, hoverSectionId: hover } });
      },
      () => get().endDrag(),
      () => get().cancelDrag()
    );
  },
  endDrag: () => {
    removePointerListeners?.();
    const { drag, handler } = get();
    set({ drag: null });
    if (!drag || !handler || !drag.hoverSectionId) return;
    handler.tryAdd(drag.hoverSectionId, drag.item);
  },
  cancelDrag: () => {
    removePointerListeners?.();
    set({ drag: null });
  },
}));
