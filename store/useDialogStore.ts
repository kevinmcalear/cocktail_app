import type { AlertButton } from 'react-native';
import { create } from 'zustand';

export type Dialog = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  /** Run when the dialog is dismissed without pressing a button. */
  onDismiss?: () => void;
};

type DialogState = {
  /** Dialogs waiting to be shown; the first is on screen. */
  queue: Dialog[];
  show: (dialog: Omit<Dialog, 'id'>) => void;
  close: (id: number) => void;
};

let nextId = 1;

export const useDialogStore = create<DialogState>()((set) => ({
  queue: [],
  show: (dialog) => set((state) => ({ queue: [...state.queue, { ...dialog, id: nextId++ }] })),
  close: (id) => set((state) => ({ queue: state.queue.filter((d) => d.id !== id) })),
}));
