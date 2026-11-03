import type { HouseNudge } from '@/lib/makeItHouse';

import { Prompt } from './Prompt';

/** "The name says coconut fat-washed. Make the Bacardi that way?": what a line typed, or the drink's name, says about how it's made. */
export function NudgeCard({ nudge, name, onMake, onNotNow }: { nudge: HouseNudge; name?: string; onMake: () => void; onNotNow: () => void }) {
  return (
    <Prompt
      icon="flask"
      title={`${nudge.from === 'typed' ? 'You wrote' : 'The name says'} ${nudge.phrase}. Make the ${name} that way?`}
      body="Write it as a house-made, here, without leaving this drink."
      actions={[
        { label: 'Make it in-house', onPress: onMake },
        { label: 'Not now', onPress: onNotNow },
      ]}
    />
  );
}
