import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { CreditsStep } from './CreditsStep';

let mockCards: { id: string; name: string; imageUrl: null; glass: null; shares: string[] }[] = [];
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }), useCloseClassics: () => ({ data: mockCards }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [{ id: 'c-daiquiri', name: 'Daiquiri', imageUrl: null, aliases: [] }] }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: { id: 'p-me', displayName: 'Jo Park' } }) }));
jest.mock('@/hooks/useProfiles', () => ({
  usePublicPeople: (q: string) => ({
    data: q.toLowerCase().startsWith('sam') ? [{ id: 'p-sam', handle: 'sam.ortiz', display_name: 'Sam Ortiz', city: null, is_claimed: true, current_bar: 'Little Rye', job: null, worked: null }] : [],
  }),
}));
// "atabboy" matches nothing as typed; the database says it's close to Attaboy (marked near).
jest.mock('@/hooks/useRankings', () => ({
  usePublicBars: (q: string) => ({ data: q.length >= 2 ? [{ id: 'bar-p-attaboy', display_name: 'Attaboy', city: 'New York', near: q === 'atabboy' }] : [] }),
}));

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

beforeEach(() => {
  mockCards = [];
  changed.mockClear();
});

describe('CreditsStep, who made it', () => {
  test('one list: you to start, Sam added and asked first, everyone off saves as Not sure', async () => {
    await renderWithTamagui(<Harness venueName="Little Rye" />);
    expect(screen.getByText('Jo Park')).toBeTruthy();
    expect(screen.getByText('You · Little Rye')).toBeTruthy();
    expect(screen.queryByText('Made with')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Add someone'), 'Sam');
    await fireEvent.press(screen.getByRole('button', { name: 'Sam Ortiz, @sam.ortiz · Little Rye' }));
    expect(latest().coCreators).toEqual([{ id: 'p-sam', name: 'Sam Ortiz', sub: '@sam.ortiz · Little Rye', claimed: true }]);
    expect(screen.getByText('We’ll ask Sam first. Sam’s name shows on the drink once Sam says yes.')).toBeTruthy();
    expect(screen.getByLabelText('Waiting for Sam Ortiz to say yes')).toBeTruthy();

    // Off goes Jo: Sam is the maker now, so nobody is asked.
    await fireEvent.press(screen.getByRole('button', { name: 'Take yourself off' }));
    expect(latest()).toMatchObject({ creator: { id: 'p-sam', name: 'Sam Ortiz' }, coCreators: [] });
    expect(screen.queryByText(/^We’ll ask/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Take Sam Ortiz off' }));
    expect(latest()).toMatchObject({ creator: 'nobody', coCreators: [] });
    expect(screen.getByText('Take everyone off and it saves as Not sure.')).toBeTruthy();
  });
});

describe('CreditsStep, riff or original', () => {
  test('up to four cards, a searched classic joins them picked, and It’s an original clears it', async () => {
    mockCards = [
      { id: 'c-mm', name: 'Mezcal Margarita', imageUrl: null, glass: null, shares: ['mezcal', 'lime', 'agave'] },
      { id: 'c-tm', name: 'Tommy’s Margarita', imageUrl: null, glass: null, shares: ['lime', 'agave'] },
    ];
    await renderWithTamagui(<Harness />);
    expect(screen.getByText('Is it a riff on one of these?'.toUpperCase())).toBeTruthy();
    expect(screen.getByText('Shares mezcal, lime, agave')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Mezcal Margarita, shares mezcal, lime, agave' }));
    expect(latest().riffOf).toEqual({ id: 'c-mm', name: 'Mezcal Margarita' });

    await fireEvent.changeText(screen.getByLabelText('Find another classic'), 'Daiq');
    await fireEvent.press(screen.getByRole('button', { name: 'Daiquiri' }));
    expect(latest().riffOf).toEqual({ id: 'c-daiquiri', name: 'Daiquiri' });
    expect(screen.getByRole('radio', { name: 'Daiquiri', checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'It’s an original' }));
    expect(latest().riffOf).toBeNull();
  });
});

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

  test('a close spelling asks Did you mean; tapping it credits that bar, and adding one sits under No', async () => {
    await renderWithTamagui(<Harness />);
    await fireEvent.changeText(screen.getByLabelText('First made at a bar'), 'atabboy');
    expect(screen.getByText('Did you mean')).toBeTruthy();
    expect(screen.getByText('No, it’s somewhere else')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add “atabboy” as a new bar' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Attaboy · New York' }));
    expect(latest().place).toEqual({ id: 'bar-p-attaboy', name: 'Attaboy' });
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
