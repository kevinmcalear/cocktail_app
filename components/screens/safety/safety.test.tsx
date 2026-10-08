import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';

import { useAgeGate } from './AgeGate';
import { DrinkingAgeGate } from './DrinkingAgeGate';
import { MyReportsScreen } from './MyReportsScreen';
import { NotAvailable } from './NotAvailable';
import { ReportSheet } from './ReportSheet';

let mockUser: { id: string } | null = { id: 'me' };
let mockAge: 'confirmed' | 'under_age' | 'unknown' | undefined = 'confirmed';
const mockFile = { mutate: jest.fn(), isPending: false, isSuccess: false, error: null as Error | null };
let mockExisting: { id: string; created_at: string } | null = null;
let mockReports: unknown[] = [];
const mockStore = new Map<string, string>();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: mockUser, loading: false })));
jest.mock('@/hooks/useSafety', () => ({
  useFileReport: () => mockFile,
  useMyOpenReport: () => ({ data: mockExisting, isLoading: false }),
  useMyReports: () => ({ data: mockReports, isLoading: false, error: null }),
}));
jest.mock('@/hooks/useAgeCheck', () => ({
  useAgeCheck: () => ({ data: mockAge, isError: false }),
  useConfirmAge: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));
jest.mock('@/lib/deviceStore', () => ({
  deviceStore: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
  },
}));

beforeEach(() => {
  mockUser = { id: 'me' };
  mockAge = 'confirmed';
  mockExisting = null;
  mockFile.mutate.mockClear();
  mockFile.isSuccess = false;
  mockFile.error = null;
  mockStore.clear();
});

const profile = [{ label: '@jo', target: { kind: 'profile' as const, profileId: 'p1' } }];

describe('ReportSheet', () => {
  test('sends a report only once a reason is picked, with the details', async () => {
    await renderWithTamagui(<ReportSheet subject="@jo" targets={profile} onClose={() => {}} />);
    const send = screen.getByRole('button', { name: 'Send report' });
    expect(send.props.accessibilityState?.disabled ?? send.props['aria-disabled']).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: /Bullying or harassment/ }));
    expect(screen.getByRole('radio', { name: /Bullying or harassment/, checked: true })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Details (optional)'), 'Abuse in my DMs');
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(mockFile.mutate).toHaveBeenCalledWith({ target: profile[0].target, reason: 'harassment', details: 'Abuse in my DMs' });
  });

  test('says so when the limit is reached, and confirms once sent', async () => {
    mockFile.error = new Error("You've sent 20 reports today, which is the most we take from one person in a day. Try again tomorrow.");
    const { rerender } = await renderWithTamagui(<ReportSheet subject="@jo" targets={profile} onClose={() => {}} />);
    expect(screen.getByRole('alert').props.children).toMatch(/20 reports today/);

    mockFile.error = null;
    mockFile.isSuccess = true;
    await rerender(<ReportSheet subject="@jo" targets={profile} onClose={() => {}} />);
    expect(screen.getByText('Thanks. Your report is in.')).toBeTruthy();
  });

  test('an open report already on file stops a second one', async () => {
    mockExisting = { id: 'r1', created_at: '2026-09-20T10:00:00Z' };
    await renderWithTamagui(<ReportSheet subject="@jo" targets={profile} onClose={() => {}} />);
    expect(screen.getByText('You’ve already reported this')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send report' })).toBeNull();
  });

  test('a ranking asks which bar first', async () => {
    const bars = [
      { label: 'Night Owl’s Martini', target: { kind: 'ranking' as const, itemId: 'm', profileId: 'b1' } },
      { label: 'Pale Moth’s Martini', target: { kind: 'ranking' as const, itemId: 'm', profileId: 'b2' } },
    ];
    await renderWithTamagui(<ReportSheet subject="a Martini ranking" targets={bars} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Pale Moth’s Martini' }));
    await fireEvent.press(screen.getByRole('radio', { name: /Fake rankings/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(mockFile.mutate).toHaveBeenCalledWith({ target: bars[1].target, reason: 'fake_rankings', details: '' });
  });
});

function Gated({ action }: { action: () => void }) {
  const { gate, sheet } = useAgeGate();
  return (
    <>
      <Text role="button" onPress={() => gate(action)}>
        Rank it
      </Text>
      {sheet}
    </>
  );
}

describe('useAgeGate', () => {
  test('a confirmed age goes straight through', async () => {
    const action = jest.fn();
    await renderWithTamagui(<Gated action={action} />);
    await fireEvent.press(screen.getByText('Rank it'));
    expect(action).toHaveBeenCalledTimes(1);
  });

  test('no answer yet: asks for the birth date and country, and waits', async () => {
    mockAge = 'unknown';
    const action = jest.fn();
    await renderWithTamagui(<Gated action={action} />);
    await fireEvent.press(screen.getByText('Rank it'));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Year')).toBeTruthy();
    expect(screen.getByText(/Your birth date is never stored/)).toBeTruthy();
  });

  test('under age: a final note, and the action never runs', async () => {
    mockAge = 'under_age';
    const action = jest.fn();
    await renderWithTamagui(<Gated action={action} />);
    await fireEvent.press(screen.getByText('Rank it'));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText('Thanks for being honest')).toBeTruthy();
    expect(screen.queryByLabelText('Year')).toBeNull();
  });
});

describe('DrinkingAgeGate', () => {
  const os = Platform.OS;
  const setOs = (value: string) => Object.defineProperty(Platform, 'OS', { value, configurable: true, writable: true });
  afterEach(() => setOs(os));

  test('signed-out web visitors answer once; the answer stays on the device', async () => {
    setOs('web');
    mockUser = null;
    await renderWithTamagui(
      <DrinkingAgeGate>
        <Text>The drink</Text>
      </DrinkingAgeGate>
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Yes, I am' }));
    expect(screen.getByText('The drink')).toBeTruthy();
    await waitFor(() => expect(mockStore.get('drinking-age-answer')).toBe('yes'));
  });

  test('a "no" keeps the page closed', async () => {
    setOs('web');
    mockUser = null;
    mockStore.set('drinking-age-answer', 'no');
    await renderWithTamagui(
      <DrinkingAgeGate>
        <Text>The drink</Text>
      </DrinkingAgeGate>
    );
    expect(await screen.findByText('Come back another time')).toBeTruthy();
    expect(screen.queryByText('The drink')).toBeNull();
  });

  test('signed-in people and the native app go straight through', async () => {
    setOs('web');
    await renderWithTamagui(
      <DrinkingAgeGate>
        <Text>The drink</Text>
      </DrinkingAgeGate>
    );
    expect(screen.getByText('The drink')).toBeTruthy();
  });
});

describe('MyReportsScreen', () => {
  const report = (over: object) => ({
    id: 'r', target_kind: 'item', reason: 'misleading', details: null, status: 'open', resolution: null,
    created_at: '2026-09-29T10:00:00Z', reviewed_at: null, item_id: 'i', profile: null, item: { name: 'Owl Sour' }, release: null, ...over,
  });

  test('each report says what happened, in words, with the moderator’s note', async () => {
    mockReports = [
      report({ id: 'a', status: 'actioned', resolution: 'Taken down while we check the credit.', item: null }),
      report({ id: 'b', status: 'dismissed', target_kind: 'profile', profile: { display_name: 'Jo Park' }, item: null, item_id: null }),
      report({ id: 'c' }),
    ];
    await renderWithTamagui(<MyReportsScreen />);
    expect(screen.getByText('Action taken')).toBeTruthy();
    expect(screen.getByText('Taken down')).toBeTruthy();
    expect(screen.getByText('From the moderator: Taken down while we check the credit.')).toBeTruthy();
    expect(screen.getByText('No action taken')).toBeTruthy();
    expect(screen.getByText('Jo Park')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    expect(screen.getByText('Owl Sour')).toBeTruthy();
  });

  test('says how to report when there’s nothing yet', async () => {
    mockReports = [];
    await renderWithTamagui(<MyReportsScreen />);
    expect(screen.getByText(/You haven’t reported anything/)).toBeTruthy();
  });
});

describe('NotAvailable', () => {
  test('says what might have happened and offers a way on, without saying which', async () => {
    await renderWithTamagui(<NotAvailable what="drink" />);
    expect(screen.getByText('Not available')).toBeTruthy();
    expect(screen.getByText(/made private or removed, or a moderator may have hidden it\. Or it’s from someone you’ve blocked\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discover drinks' })).toBeTruthy();
  });

  test('signed out: no talk of blocks, and a way to sign in', async () => {
    mockUser = null;
    await renderWithTamagui(<NotAvailable what="release" />);
    expect(screen.getByText(/The bar may not have published it yet/)).toBeTruthy();
    expect(screen.queryByText(/blocked/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign in to find more' })).toBeTruthy();
  });
});
