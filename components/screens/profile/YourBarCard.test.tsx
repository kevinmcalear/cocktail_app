import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { Position } from '@/hooks/useProfiles';

import { YourBarCard } from './YourBarCard';

const mockPush = jest.fn();
const mockAsk = jest.fn();
let mockBar: { id: string; kind: string; handle: string; display_name: string; avatar_url: null; bar_id: string | null } | null = null;
const mockOmakase = { id: 'omakase', kind: 'bar', handle: 'omakase', display_name: 'Cocktail Omakase', avatar_url: null, bar_id: null };
let mockVenues: { bar_id: string }[] = [];
let mockAsked: { declined_at: string | null } | null = null;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('./useShareLink', () => ({ useShareLink: () => jest.fn() }));
jest.mock('../home/BarMark', () => ({ BarMark: () => null }));
jest.mock('@/hooks/useProfiles', () => ({ useProfile: (id: string | null) => ({ data: id === 'omakase' ? mockOmakase : mockBar }), useMyPersonClaim: () => ({ data: null }) }));
jest.mock('@/ctx/AuthContext', () => ({ useUserId: () => 'me' }));
jest.mock('@/hooks/useBars', () => ({ useBars: () => ({ data: mockVenues }) }));
jest.mock('@/hooks/useJoinRequests', () => ({ useMyJoinRequest: () => ({ data: mockAsked }), useAskToJoin: () => ({ mutate: mockAsk, isPending: false, error: null }) }));

const job = { id: 'j', is_current: true, person_accepted: true, bar: { id: 'moth' } } as unknown as Position;
const moth = { id: 'moth', kind: 'bar', handle: 'pale.moth', display_name: 'Pale Moth', avatar_url: null, bar_id: null };

beforeEach(() => {
  mockPush.mockReset();
  mockAsk.mockReset();
  mockBar = moth;
  mockVenues = [];
  mockAsked = null;
});

test('an unclaimed bar: I run it, or send it to whoever does', async () => {
  await renderWithTamagui(<YourBarCard positions={[job]} />);
  expect(screen.getByText('Pale Moth isn’t claimed yet')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'I run Pale Moth' }));
  expect(mockPush).toHaveBeenCalledWith('/venue-setup?claim=moth');
  expect(screen.getByRole('button', { name: 'Send it to whoever does' })).toBeTruthy();
});

test('two current jobs: the headline one leads', async () => {
  const headline = { id: 'h', is_current: true, person_accepted: true, bar: { id: 'omakase' } } as unknown as Position;
  await renderWithTamagui(<YourBarCard positions={[job, headline]} headlineId="h" />);
  expect(screen.getByText('Cocktail Omakase isn’t claimed yet')).toBeTruthy();
  await renderWithTamagui(<YourBarCard positions={[job, headline]} />);
  expect(screen.getByText('Pale Moth isn’t claimed yet')).toBeTruthy();
});

test('a claimed bar: ask to join, then it says you asked', async () => {
  mockBar = { ...moth, bar_id: 'venue' };
  await renderWithTamagui(<YourBarCard positions={[job]} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Ask to join' }));
  expect(mockAsk).toHaveBeenCalledWith('moth');

  mockAsked = { declined_at: null };
  await renderWithTamagui(<YourBarCard positions={[job]} />);
  expect(screen.getByText('You asked to join Pale Moth’s team')).toBeTruthy();

  mockAsked = { declined_at: '2026-10-25T12:00:00Z' };
  await renderWithTamagui(<YourBarCard positions={[job]} />);
  expect(screen.getByText('Pale Moth’s team said no')).toBeTruthy();
});

test('nothing once you are on the team, or with no current job', async () => {
  mockBar = { ...moth, bar_id: 'venue' };
  mockVenues = [{ bar_id: 'venue' }];
  await renderWithTamagui(<YourBarCard positions={[job]} />);
  expect(screen.queryByText(/Pale Moth/)).toBeNull();

  mockVenues = [];
  await renderWithTamagui(<YourBarCard positions={[{ ...job, is_current: false }]} />);
  expect(screen.queryByText(/Pale Moth/)).toBeNull();
});
