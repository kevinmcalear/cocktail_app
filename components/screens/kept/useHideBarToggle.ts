import { useToast } from '@/components/ds';
import { useHiddenBars, useHideBar } from '@/hooks/useHiddenBars';
import { useLovedBars } from '@/hooks/useKept';

/**
 * Hide a bar from your Discover (disc-hide-bar): it leaves your map, drinks
 * list and Top bars, with Undo on the toast. Hidden, the same toggle shows it
 * again. Lives in the bar page's More menu (ProfileSafety), not as a button
 * of its own, as other apps keep "not interested" out of the way.
 */
export function useHideBarToggle(profileId: string, name: string) {
  const hidden = useHiddenBars().data?.some((b) => b.id === profileId) ?? false;
  const hideBar = useHideBar();
  const loved = useLovedBars().data?.some((b) => b.id === profileId) ?? false;
  const toast = useToast();
  const on = hideBar.isPending && hideBar.variables ? hideBar.variables.hide : hidden;
  const toggle = () => {
    if (on) {
      hideBar.mutate({ profileId, hide: false });
      return;
    }
    // Hiding stops loving it (useHideBar); Undo brings both back.
    const wasLoved = loved;
    hideBar.mutate({ profileId, hide: true });
    const undo = () => hideBar.mutate({ profileId, hide: false, relove: wasLoved });
    toast.show({ title: `${name} is hidden from Discover`, detail: 'Show it again from its page or in Settings.', action: { label: 'Undo', onPress: undo } });
  };
  return { hidden: on, toggle };
}
