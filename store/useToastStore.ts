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
  /** `error` is for a save or change that was refused (board Sta-errors): amber, a triangle, announced as an alert. */
  tone?: 'error';
}

interface ToastState {
  toast: Toast | null;
  /** Android: how far the top of the FAB on screen is from the screen's bottom edge, 0 with none. The toast sits above it, as Material's snackbar does. */
  fabTop: number;
  setFabTop: (top: number) => void;
  show: (toast: Omit<Toast, 'id'>) => number;
  hide: (id?: number) => void;
  /**
   * The toast hosts mounted, oldest first: the root's, then one inside each
   * open sheet. A sheet is a window of its own over the app (a Modal), so a
   * toast drawn at the root sits under it; only the newest host draws.
   */
  hosts: number[];
  addHost: (id: number) => void;
  removeHost: (id: number) => void;
}

let next = 1;

/** The one toast on screen (components/ds/Toast.tsx draws it). A new one replaces the last. */
export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,
  fabTop: 0,
  setFabTop: (fabTop) => set({ fabTop }),
  show: (toast) => {
    const id = next++;
    set({ toast: { ...toast, id } });
    return id;
  },
  hide: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null });
  },
  hosts: [],
  addHost: (id) => set({ hosts: [...get().hosts, id] }),
  removeHost: (id) => set({ hosts: get().hosts.filter((h) => h !== id) }),
}));
