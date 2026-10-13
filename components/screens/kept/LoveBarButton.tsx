import { useState } from 'react';

import { GlassButton } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';
import { useLoveBar, useLovedBars } from '@/hooks/useKept';

import { useAgeGate } from '../safety/AgeGate';
import { LoveAlertsSheet } from './LoveAlertsSheet';

/**
 * The heart on a bar's page: keeps the bar in Collection's Bars. Loving it
 * asks what it may tell you about (week-love-alerts); tapping Loved opens the
 * same choice, with Stop loving. Signed in only; loving a bar needs a
 * confirmed age, like the rest of Collection.
 */
export function LoveBarButton({ profileId, name, labelled = false }: { profileId: string; name: string; labelled?: boolean }) {
  const signedIn = useSignedIn();
  const loved = useLovedBars().data?.some((b) => b.id === profileId) ?? false;
  const love = useLoveBar();
  const age = useAgeGate();
  const [asking, setAsking] = useState(false);
  if (!signedIn) return null;
  // While the change saves, show where it's going.
  const on = love.isPending && love.variables ? love.variables.love : loved;
  return (
    <>
      <GlassButton
        accessibilityLabel={on ? `You love ${name}: choose what it tells you, or stop loving it` : `Love ${name}: keep it in your Collection`}
        icon={on ? 'heart.fill' : 'heart'}
        label={labelled ? (on ? 'Loved' : 'Love') : undefined}
        onPress={() =>
          on
            ? setAsking(true)
            : age.gate(() => {
                love.mutate({ profileId, love: true });
                setAsking(true);
              })
        }
      />
      {age.sheet}
      {asking ? <LoveAlertsSheet visible profileId={profileId} name={name} onClose={() => setAsking(false)} /> : null}
    </>
  );
}
