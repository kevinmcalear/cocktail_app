import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { NotesStep } from './TextSteps';

const changed = jest.fn<void, [WizardDraft]>();
function Harness() {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Ash Garden' });
  const set = (patch: Partial<WizardDraft>) => {
    const next = { ...draft, ...patch };
    changed(next);
    setDraft(next);
  };
  return <NotesStep draft={draft} set={set} />;
}

test('notes go with the drink unless you keep them to yourself', async () => {
  await renderWithTamagui(<Harness />);
  expect(screen.getByRole('radio', { name: 'With the drink', checked: true })).toBeTruthy();
  expect(screen.getByText('Shown on its page to whoever can see the drink. You choose who on the next step.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'Just me' }));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ notesPrivate: true }));
  expect(screen.getByText('Only you see them, on the drink’s page. Never shared or published.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'With the drink' }));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ notesPrivate: false }));
});
