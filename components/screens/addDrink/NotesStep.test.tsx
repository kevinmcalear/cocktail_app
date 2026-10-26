import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { NotesStep } from './TextSteps';

jest.mock('@/hooks/useVenueRoles', () => ({
  useRoleMatrix: () => ({
    data: [
      { role_id: null, name: null, base_level: 20, ends_at: null },
      { role_id: 'r1', name: 'Apprentice', base_level: 20, ends_at: null },
      { role_id: 'r2', name: 'Head bartender', base_level: 35, ends_at: null },
    ],
  }),
}));
jest.mock('@/hooks/useBarDetail', () => ({ useBarMembers: () => ({ data: [{ role_level: 40, display_name: 'Rob' }, { role_level: 30, display_name: 'Sam' }] }) }));

const changed = jest.fn<void, [WizardDraft]>();
function Harness({ barId = null }: { barId?: string | null }) {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Ash Garden' });
  const set = (patch: Partial<WizardDraft>) => {
    const next = { ...draft, ...patch };
    changed(next);
    setDraft(next);
  };
  return <NotesStep draft={draft} set={set} barId={barId} />;
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

test('at a venue the notes go to a role and everyone above it, in the venue\'s own role names (E29)', async () => {
  await renderWithTamagui(<Harness barId="bar-1" />);
  expect(screen.getByRole('radio', { name: 'Everyone who sees the drink. Guests and staff, and the public if it is published', checked: true })).toBeTruthy();
  expect(screen.getByText('Employee, Apprentice, and everyone above')).toBeTruthy();
  expect(screen.getByText('Drink Creator, Head bartender, Admin')).toBeTruthy();
  expect(screen.getByText('Rob')).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'Bartenders and up. Bartender, Drink Creator, Head bartender, Admin' }));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ notesPrivate: false, notesLevel: 30 }));
  expect(screen.getByRole('radio', { name: 'Bartenders and up. Bartender, Drink Creator, Head bartender, Admin', checked: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'Just me. Never shared or published' }));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ notesPrivate: true }));
  expect(screen.queryByRole('radio', { checked: true, name: /Bartenders/ })).toBeNull();
});
