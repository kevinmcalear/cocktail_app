import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cocktailQuery } from '@/hooks/useCocktails';
import { useViewAs } from '@/hooks/useViewAs';
import { draftFromSpec, type SourceSpec, type WizardDraft } from '@/lib/drinkWizard';
import { getPreferredUnit } from '@/store/useSettingsStore';

/**
 * Loads a classic's spec (the drink page's query, so a page seen before is
 * instant) and turns it into the start of a new drink: lines, methods,
 * glass, ice and garnish, credited as a version of it.
 */
export function useStartFromClassic() {
  const client = useQueryClient();
  const { viewAsRoleLevel } = useViewAs();
  return useMutation({
    mutationFn: async (classicId: string): Promise<Partial<WizardDraft>> => {
      const item = await client.fetchQuery({ ...cocktailQuery(classicId, viewAsRoleLevel), staleTime: 60 * 1000 });
      if (!item) throw new Error('Couldn’t load that spec.');
      return draftFromSpec(item as unknown as SourceSpec, getPreferredUnit());
    },
  });
}
