import { useState } from 'react';

import { finishStart, newLine, type WizardDraft, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import type { HouseNudge, HouseReading } from '@/lib/makeItHouse';
import type { TypedPour } from '@/lib/paste';
import type { SpecRow } from '@/lib/specPaste';
import { techniqueById, type Technique } from '@/lib/techniques';

import type { CatalogIngredient } from './IngredientSearch';

interface TypedHouseOptions {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  /** A new line as the step makes one: the pour as typed, or a likely one. */
  lineFor: (pick: WizardPick, pour?: TypedPour) => WizardLine;
  /** Adds one line (the step's own add). */
  add: (pick: WizardPick, pour?: TypedPour) => WizardLine;
  makeHouse: (line: WizardLine, t: Technique, adjunct: string | null) => void;
  /** Opens "What did you do to it?" for this line. */
  ask: (key: string) => void;
}

/**
 * Lines typed or pasted as made house ("2 oz coconut fat-washed Bacardi"):
 * the bottle goes in, then each asks once, like the name nudge, until it's
 * made house or put off (canvas make-create-finish-oil, steps 2 to 5).
 */
export function useTypedHouse({ draft, set, lineFor, add, makeHouse, ask }: TypedHouseOptions) {
  const [asks, setAsks] = useState<HouseNudge[]>([]);
  const drop = (key: string) => setAsks((list) => list.filter((a) => a.key !== key));
  /** What was typed for this line, for the sheet's "From what you typed". */
  const forLine = (key: string | null) => asks.find((a) => a.key === key) ?? null;
  // The first still to answer: its line is in and isn't house yet.
  const next = asks.find((a) => draft.lines.some((l) => l.key === a.key && !l.prep)) ?? null;

  /** One typed line: Looks right makes it house now; Check it asks how first. */
  const typed = (pick: WizardPick, reading: HouseReading<CatalogIngredient>, check: boolean, pour?: TypedPour) => {
    const line = add(pick, pour);
    if (!check) return makeHouse(line, reading.technique, reading.adjunct);
    setAsks((list) => [...list, { key: line.key, technique: reading.technique, adjunct: reading.adjunct, phrase: reading.phrase, from: 'typed' }]);
    ask(line.key);
  };

  /** A pasted spec, in order: its lines, its finish, and a question for each house line. Returns the finish's names. */
  const paste = (rows: readonly SpecRow[]): string[] => {
    const lines: WizardLine[] = [];
    const finish: WizardLine[] = [];
    const more: HouseNudge[] = [];
    for (const r of rows) {
      if (r.kind === 'skip') continue;
      if (r.kind === 'finish') {
        const start = finishStart(r.pick.name);
        finish.push(newLine(r.pick, r.unit ?? start.unit, r.amount || start.amount));
        continue;
      }
      const line = lineFor(r.pick, r.amount || r.unit ? { amount: r.amount, unit: r.unit, name: r.pick.name } : undefined);
      lines.push(line);
      const technique = techniqueById(r.house?.technique);
      if (r.house && technique) more.push({ key: line.key, technique, adjunct: r.house.adjunct, phrase: r.house.phrase, from: 'typed' });
    }
    set({ lines: [...draft.lines, ...lines], garnishes: [...draft.garnishes, ...finish] });
    setAsks((list) => [...list, ...more]);
    return finish.map((l) => l.name);
  };

  return { next, forLine, drop, typed, paste };
}
