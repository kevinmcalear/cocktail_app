import { GlassButton } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';
import { useLoveBar, useLovedBars } from '@/hooks/useKept';

/** The heart on a bar's page: keeps the bar in Collection's Bars. Signed in only. */
export function LoveBarButton({ profileId, name }: { profileId: string; name: string }) {
  const signedIn = useSignedIn();
  const loved = useLovedBars().data?.some((b) => b.id === profileId) ?? false;
  const love = useLoveBar();
  if (!signedIn) return null;
  // While the change saves, show where it's going.
  const on = love.isPending && love.variables ? love.variables.love : loved;
  return (
    <GlassButton
      accessibilityLabel={on ? `Stop loving ${name}` : `Love ${name}: keep it in your Collection`}
      icon={on ? 'heart.fill' : 'heart'}
      onPress={() => love.mutate({ profileId, love: !on })}
    />
  );
}
