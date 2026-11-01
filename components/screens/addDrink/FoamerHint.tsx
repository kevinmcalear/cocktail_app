import { useState } from 'react';
import { FoamPicker } from '@/components/techniques/FoamPicker';
import { TechniqueSheet } from '@/components/techniques/TechniqueSheet';
import { newLine, pickByName, type WizardDraft } from '@/lib/drinkWizard';
import { needsFoamer } from '@/lib/techniques/foamPicker';
import { prepFacts } from '@/lib/techniques/template';

import type { CatalogIngredient } from './IngredientSearch';
import { Prompt } from './Prompt';

interface Props {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  ingredients: readonly CatalogIngredient[];
}

/**
 * On the method step: a dry shake with nothing that foams offers the foam
 * picker, which adds the foamer to the spec. A spec that's vegan so far
 * (read from its lines) steers away from egg white.
 */
export function FoamerHint({ draft, set, ingredients }: Props) {
  const [open, setOpen] = useState(false);
  const names = draft.lines.map((l) => l.name);
  if (!needsFoamer(draft.methods.map((m) => m.name), names)) return null;
  const vegan = names.length > 0 && prepFacts(names).vegan === true;
  return (
    <>
      <Prompt
        icon="drop.fill"
        title="Nothing in this spec foams yet."
        body={vegan ? 'It’s vegan so far, so egg white is out: try aquafaba or a few foamer drops.' : 'Egg white, aquafaba or a few foamer drops will.'}
        actions={[{ label: 'Pick a foamer', onPress: () => setOpen(true) }]}
      />
      <TechniqueSheet visible={open} onClose={() => setOpen(false)} eyebrow="Foam" title="Pick a foamer">
        <FoamPicker
          kind="shaken"
          onUse={(a) => {
            const pick = pickByName(a.ingredient, ingredients);
            const line = newLine(pick, a.perDrink!.unit, a.perDrink!.amount);
            // Not on the shelf yet: the sour syrup comes in as a house prep with its steps.
            if (!pick.id && a.id === 'mc-syrup') line.technique = a.technique;
            set({ lines: [...draft.lines, line] });
            setOpen(false);
          }}
        />
      </TechniqueSheet>
    </>
  );
}
