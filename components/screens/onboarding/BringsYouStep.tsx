import { Button, Caption } from '@/components/ds';

import { SetupPage } from './SetupPage';
import { Answer } from './SetupParts';

/** "What brings you here?" (owner-setup step 1): an owner's bar, work at a bar, or drinks. */
export function BringsYouStep({ onOwner, onBartender, onDrinks, onSkip, error }: { onOwner: () => void; onBartender: () => void; onDrinks: () => void; onSkip: () => void; error: string | null }) {
  return (
    <SetupPage footer={<Button label="Not now" variant="ghost" onPress={onSkip} />}>
      {/* Owners, managers and head bartenders (owner-setup call 1). */}
      <Answer label="I’m setting up a bar" detail="I own it, run it or manage it: its menus, drinks, kit and team." onPress={onOwner} />
      <Answer label="I make drinks at a bar" detail="Find your bar, your drinks and the menus you worked on." onPress={onBartender} />
      <Answer label="I love drinks" detail="Rank them, keep them, make them at home." onPress={onDrinks} />
      {error ? <Caption tone="accent">{error}</Caption> : null}
    </SetupPage>
  );
}
