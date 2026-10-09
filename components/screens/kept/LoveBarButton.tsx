import { GlassButton } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';
import { useLoveBar, useLovedBars } from '@/hooks/useKept';

import { useAgeGate } from '../safety/AgeGate';

/**
 * The heart on a bar's page: keeps the bar in Collection's Bars. Signed in
 * only; loving a bar needs a confirmed age, like the rest of Collection.
 */
export function LoveBarButton({ profileId, name }: { profileId: string; name: string }) {
  const signedIn = useSignedIn();
  const loved = useLovedBars().data?.some((b) => b.id === profileId) ?? false;
  const love = useLoveBar();
  const age = useAgeGate();
  if (!signedIn) return null;
  // While the change saves, show where it's going.
  const on = love.isPending && love.variables ? love.variables.love : loved;
  return (
    <>
      <GlassButton
        accessibilityLabel={on ? `Stop loving ${name}` : `Love ${name}: keep it in your Collection`}
        icon={on ? 'heart.fill' : 'heart'}
        onPress={() => (on ? love.mutate({ profileId, love: false }) : age.gate(() => love.mutate({ profileId, love: true })))}
      />
      {age.sheet}
    </>
  );
}
