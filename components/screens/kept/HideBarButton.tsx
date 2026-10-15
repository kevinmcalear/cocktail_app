import { GlassButton, useToast } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';
import { useHiddenBars, useHideBar } from '@/hooks/useHiddenBars';
import { useLoveBar, useLovedBars } from '@/hooks/useKept';

/**
 * Hide a bar from your Discover, beside its heart (disc-hide-bar): it leaves
 * your map, drinks list and Top bars, with Undo on the toast. Hidden, the
 * same button shows it again. Signed in only.
 */
export function HideBarButton({ profileId, name }: { profileId: string; name: string }) {
  const signedIn = useSignedIn();
  const hidden = useHiddenBars().data?.some((b) => b.id === profileId) ?? false;
  const hideBar = useHideBar();
  const loved = useLovedBars().data?.some((b) => b.id === profileId) ?? false;
  const love = useLoveBar();
  const toast = useToast();
  if (!signedIn) return null;
  const on = hideBar.isPending && hideBar.variables ? hideBar.variables.hide : hidden;
  const toggle = () => {
    if (on) {
      hideBar.mutate({ profileId, hide: false });
      return;
    }
    // Hiding stops loving it (useHideBar); Undo brings both back.
    const wasLoved = loved;
    hideBar.mutate({ profileId, hide: true });
    const undo = () => hideBar.mutate({ profileId, hide: false }, { onSuccess: () => (wasLoved ? love.mutate({ profileId, love: true }) : undefined) });
    toast.show({ title: `${name} is hidden from Discover`, detail: 'Show it again from its page or in Settings.', action: { label: 'Undo', onPress: undo } });
  };
  return (
    <GlassButton
      accessibilityLabel={on ? `${name} is hidden from Discover: show it again` : `Hide ${name} from Discover`}
      icon={on ? 'eye' : 'eye.slash'}
      onPress={toggle}
    />
  );
}
