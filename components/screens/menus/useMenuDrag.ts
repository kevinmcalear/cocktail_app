import { useEffect, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';

import { cannotAdd } from '@/lib/menuLayout';
import type { MenuDrink } from '@/types/menus';

import type { LayoutEditor } from './useLayoutEditor';

/** Where a drag would land: before the row at index in that section. */
export type DropAt = { key: string; index: number };

export interface MenuDrag {
  /** On the web, where the browser's drag and drop works; native keeps its grip drag. */
  on: boolean;
  at: DropAt | null;
  /** The drink being dragged. */
  dragging: string | null;
}

// react-native-web writes dataSet as data-* attributes; React Native's types don't know it.
/** A row you can drag: a library drink (no from) or a menu row in section from. */
export const dragSource = (drinkId: string, from?: string) => ({ dataSet: { dragDrink: drinkId, dragFrom: from ?? '' } }) as object;
/** A menu row's body, measured for where a drop lands (without the slot or its menu). */
export const dropRow = { dataSet: { dropRow: '' } } as object;
/** A section a drink can be dropped into. */
export const dropSection = (key: string) => ({ dataSet: { dropSection: key } }) as object;
/** The drop slot, measured so it doesn't count as moving the rows. */
export const dropSlot = { dataSet: { dropSlot: '' } } as object;

/**
 * Drag and drop in the desktop builder (board venue-menus-builder-desktop): a
 * library row or a menu row drags into any section that takes it, a dashed slot
 * showing where it lands. The browser's own drag and drop, listened for on the
 * builder's root; rows and sections only carry data attributes. Native (an iPad
 * at desktop width) keeps the grip drag within a section, and Move to another
 * section.
 */
export function useMenuDrag(editor: LayoutEditor): [root: React.RefObject<React.ComponentRef<typeof View> | null>, drag: MenuDrag] {
  // The builder's root: drags are listened for here, once.
  const root = useRef<React.ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<DropAt | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const live = useRef(editor);
  useEffect(() => {
    live.current = editor;
  });

  useEffect(() => {
    const el = root.current as HTMLElement | null;
    if (Platform.OS !== 'web' || !el) return;
    let held: { drink: MenuDrink; from: string | null } | null = null;
    let shown: DropAt | null = null;
    const show = (next: DropAt | null) => {
      if (next?.key === shown?.key && next?.index === shown?.index) return;
      shown = next;
      setAt(next);
    };
    const end = () => {
      held = null;
      show(null);
      setDragging(null);
    };
    const source = (e: Event) => (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-drag-drink]') ?? null;

    // react-native-web has no draggable prop: set it as the pointer goes down.
    const down = (e: PointerEvent) => {
      const src = source(e);
      if (src) src.draggable = true;
    };
    const start = (e: DragEvent) => {
      const src = source(e);
      if (!src) return;
      const id = src.dataset.dragDrink;
      const from = src.dataset.dragFrom || null;
      const ed = live.current;
      const drink = from ? ed.section(from)?.drinks.find((d) => d.id === id) : ed.library.find((d) => d.id === id);
      if (!drink || !e.dataTransfer) return void e.preventDefault();
      held = { drink, from };
      e.dataTransfer.setData('text/plain', drink.name);
      e.dataTransfer.effectAllowed = from ? 'move' : 'copy';
      // The whole row follows the pointer, not just the picture it started on.
      const box = src.getBoundingClientRect();
      e.dataTransfer.setDragImage(src, e.clientX - box.left, e.clientY - box.top);
      // After the browser takes its picture of the row, so the picture isn't dimmed.
      requestAnimationFrame(() => setDragging(drink.id));
    };
    const over = (e: DragEvent) => {
      if (!held) return;
      const sec = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-drop-section]');
      const key = sec?.dataset.dropSection;
      const target = key ? live.current.section(key) : null;
      if (!sec || !key || !target || (held.from !== key && cannotAdd(target, held.drink))) return show(null);
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = held.from ? 'move' : 'copy';
      const rows = [...sec.querySelectorAll<HTMLElement>('[data-drop-row]')];
      // Measured as if the slot weren't there: it's taller than a row, so the
      // rows it pushes down would otherwise move the slot again, and flicker.
      const slot = shown?.key === key ? (sec.querySelector<HTMLElement>('[data-drop-slot]')?.getBoundingClientRect().height ?? 0) : 0;
      const i = rows.findIndex((r, n) => {
        const b = r.getBoundingClientRect();
        return e.clientY < b.top - (shown && n >= shown.index ? slot : 0) + b.height / 2;
      });
      show({ key, index: i < 0 ? rows.length : i });
    };
    const drop = (e: DragEvent) => {
      if (held && shown) {
        e.preventDefault();
        live.current.drop(held.drink, held.from, shown.key, shown.index);
      }
      end();
    };
    const leave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) show(null);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('dragstart', start);
    el.addEventListener('dragover', over);
    el.addEventListener('dragleave', leave);
    el.addEventListener('drop', drop);
    el.addEventListener('dragend', end);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('dragstart', start);
      el.removeEventListener('dragover', over);
      el.removeEventListener('dragleave', leave);
      el.removeEventListener('drop', drop);
      el.removeEventListener('dragend', end);
    };
  }, []);

  return [root, { on: Platform.OS === 'web', at, dragging }];
}
