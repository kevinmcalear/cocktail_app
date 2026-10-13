import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  /** One button on the toast, like Undo. */
  action?: ToastAction;
  /** The accent the action is drawn in: the venue's, from where it was shown. */
  accent?: string;
  /** Points to sit above the bottom edge's usual spot, for a screen with its own bottom bar. */
  lift?: number;
}

interface ToastState {
  toast: Toast | null;
  show: (toast: Omit<Toast, 'id'>) => number;
  hide: (id?: number) => void;
}

let next = 1;

/** The one toast on screen (components/ds/Toast.tsx draws it). A new one replaces the last. */
export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,
  show: (toast) => {
    const id = next++;
    set({ toast: { ...toast, id } });
    return id;
  },
  hide: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null });
  },
}));
