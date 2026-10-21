import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { CreditsStep } from './CreditsStep';

jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: { id: 'p-me', displayName: 'Jo' } }) }));
jest.mock('@/hooks/useProfiles', () => ({ usePublicPeople: () => ({ data: [] }) }));
jest.mock('@/hooks/useRankings', () => ({ usePublicBars: (q: string) => ({ data: q.length >= 2 ? [{ id: 'bar-p-attaboy', display_name: 'Attaboy', city: 'New York' }] : [] }) }));

// The draft as the step leaves it, after each change.
const changed = jest.fn<void, [WizardDraft]>();
const latest = () => changed.mock.calls[changed.mock.calls.length - 1][0];
function Harness({ venueName = null }: { venueName?: string | null }) {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Ash Garden' });
  const set = (patch: Partial<WizardDraft>) => {
    const next = { ...draft, ...patch };
    changed(next);
    setDraft(next);
  };
  return <CreditsStep draft={draft} set={set} venueName={venueName} ingredients={[]} />;
}

describe('CreditsStep, where and when', () => {
  test('at home: at home until a bar is picked, and a typed year only once it is one', async () => {
    await renderWithTamagui(<Harness />);
    expect(screen.getByRole('radio', { name: 'At home', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Not sure', checked: true })).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('First made at a bar'), 'Atta');
    await fireEvent.press(screen.getByRole('button', { name: 'Attaboy · New York' }));
    expect(latest().place).toEqual({ id: 'bar-p-attaboy', name: 'Attaboy' });
    expect(screen.getByRole('radio', { name: 'Attaboy', checked: true })).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Another year'), '20a19');
    expect(latest().originYear).toBe(2019);
    await fireEvent.changeText(screen.getByLabelText('Another year'), '2999');
    expect(latest().originYear).toBeNull();
    expect(screen.getByText(/^A year from 1600 to /)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /^This year/ }));
    expect(latest().originYear).toBe(new Date().getFullYear());

    await fireEvent.press(screen.getByRole('radio', { name: 'At home' }));
    expect(latest().place).toBeNull();
  });

  test("at a venue, it's the venue's unless it's from somewhere else", async () => {
    await renderWithTamagui(<Harness venueName="Little Rye" />);
    expect(screen.getByRole('radio', { name: 'Yes, it’s ours', checked: true })).toBeTruthy();
    expect(screen.getByText('First made at Little Rye.')).toBeTruthy();
    expect(screen.queryByLabelText('Where’s it from?')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'No, from somewhere else' }));
    expect(latest().elsewhere).toBe(true);
    expect(screen.queryByText('First made at Little Rye.')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Where’s it from?'), 'Atta');
    await fireEvent.press(screen.getByRole('button', { name: 'Attaboy · New York' }));
    expect(latest().place).toEqual({ id: 'bar-p-attaboy', name: 'Attaboy' });

    await fireEvent.press(screen.getByRole('radio', { name: 'Yes, it’s ours' }));
    expect(latest()).toMatchObject({ elsewhere: false, place: null });
  });
});
