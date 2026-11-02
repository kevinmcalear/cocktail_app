import type { toast as burntToast } from 'burnt';

type ToastOptions = Parameters<typeof burntToast>[0];

/**
 * burnt's web toast is sonner (about 7 KB brotli). Most routes can toast, so a
 * static import put it on every page's first load. It now loads with its
 * Toaster, straight after the first render (components/WebToaster.web.tsx),
 * which hands its toast over here once it is listening: sonner drops a toast
 * no Toaster is listening for, so toasts made before then wait and show in
 * order. Checked by components/ListeningToaster.test.tsx.
 */
let show: ((options: ToastOptions) => void) | null = null;
const waiting: ToastOptions[] = [];

export function toast(options: ToastOptions): void {
  if (show) show(options);
  else waiting.push(options);
}

/** The Toaster is listening (components/ListeningToaster.web.tsx): toasts go to it, the ones that waited first. */
export function toasterReady(toastNow: (options: ToastOptions) => void): void {
  show = toastNow;
  for (const options of waiting.splice(0)) toastNow(options);
}
