import type { toast as burntToast } from 'burnt';

/**
 * burnt's web toast is sonner (about 10 KB brotli). Most routes can toast, so a
 * static import put it on every page's first load; it loads on the first toast
 * instead. Its <Toaster /> is mounted by the root layout (components/nav/RootLazy).
 */
export function toast(options: Parameters<typeof burntToast>[0]): void {
  void import('burnt').then((Burnt) => Burnt.toast(options));
}
