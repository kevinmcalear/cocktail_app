import { useState } from 'react';
import { Alert } from 'react-native';

import { useDrinkLists } from '@/hooks/useDiscover';
import { useStartFromClassic } from '@/hooks/useStartFromClassic';
import type { ClassicMatch } from '@/lib/classics';
import type { WizardDraft } from '@/lib/drinkWizard';

import { Prompt } from './Prompt';

/** How many classics the empty spec offers. */
const OFFERED = 6;

interface Props {
  set: (change: Partial<WizardDraft>) => void;
  /** The classic the name already is ("House Negroni" is a Negroni): one card, not a list. */
  match?: ClassicMatch | null;
}

/**
 * A classic's spec as a head start: lines, method, glass, ice and garnish
 * fill in, credited as a version of it, and everything stays editable. With
 * `match`, a card for the classic the name is; otherwise the best-known
 * classics as chips, for an empty spec.
 */
export function StartFromClassic({ set, match }: Props) {
  const classics = useDrinkLists().data ?? [];
  const start = useStartFromClassic();
  const [gone, setGone] = useState(false);
  const go = (id: string) =>
    start.mutate(id, {
      onSuccess: set,
      onError: (e) => Alert.alert('Couldn’t load that spec', e.message),
    });

  if (match) {
    const name = match.classic.name;
    return (
      <Prompt
        icon="book"
        title={`${name} is a classic. Start from its spec?`}
        body="Its spec fills in, then change what you like. It’s noted as a riff."
        actions={[{ label: start.isPending ? 'Loading…' : `Start from the ${name}`, disabled: start.isPending, onPress: () => go(match.classic.id) }]}
      />
    );
  }

  if (!classics.length || gone) return null;
  return (
    <Prompt
      icon="book"
      title="Start from a classic?"
      body="Its spec fills in, then change what you like. It’s noted as a riff."
      chips={classics.slice(0, OFFERED).map((c) => ({ label: c.name, onPress: () => go(c.id), accessibilityLabel: `Start from the ${c.name}` }))}
      onDismiss={() => setGone(true)}
    />
  );
}
