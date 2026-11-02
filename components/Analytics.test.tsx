import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { noteSignIn } from '@/lib/analyticsDoor';

import Analytics from './Analytics';

const mockClient = {
  identify: jest.fn(),
  reset: jest.fn(),
  screen: jest.fn(),
  ready: jest.fn(async () => undefined),
  getDistinctId: jest.fn(() => 'anon'),
  getAnonymousId: jest.fn(() => 'anon'),
};
let mockOptions: {
  customAppProperties: (props: object) => Record<string, unknown>;
  before_send: (event: { event: string; properties?: Record<string, unknown> } | null) => { properties?: Record<string, unknown> } | null;
};
let mockAuth: { session: { user: { id: string } } | null; loading: boolean };

jest.mock('expo-router', () => ({ useSegments: () => ['(tabs)'] }));
jest.mock('expo-updates', () => ({ updateId: 'abcdefgh-1234' }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/appVariant', () => ({ appVariant: 'preview' }));
jest.mock('@/lib/analyticsDoor', () => ({ noteSignIn: jest.fn() }));
jest.mock('posthog-react-native', () => ({
  PostHogProvider: ({ children, options }: { children: ReactNode; options: typeof mockOptions }) => {
    mockOptions = options;
    return children;
  },
  usePostHog: () => mockClient,
}));

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.getDistinctId.mockReturnValue('anon');
});

test('tags every event from the client options, where reset() cannot clear them', async () => {
  mockAuth = { session: null, loading: false };
  await render(<Analytics apiKey="k" host="h" />);
  expect(mockOptions.customAppProperties({ $app_version: '2.0.0' })).toEqual({
    $app_version: '2.0.0',
    $geoip_disable: true,
    app_surface: 'ios',
    app_variant: 'preview',
    app_update: 'abcdefgh',
  });
});

test('the link an app opened with goes without its query', async () => {
  mockAuth = { session: null, loading: false };
  await render(<Analytics apiKey="k" host="h" />);
  const opened = mockOptions.before_send({ event: 'Application Opened', properties: { url: 'https://x/auth/callback?token_hash=t&type=magiclink#y' } });
  expect(opened?.properties?.url).toBe('https://x/auth/callback');
  expect(mockOptions.before_send({ event: '$screen', properties: { $screen_name: '/d/[id]' } })?.properties).toEqual({ $screen_name: '/d/[id]' });
});

test('a signed-out launch keeps its anonymous id', async () => {
  mockAuth = { session: null, loading: false };
  await render(<Analytics apiKey="k" host="h" />);
  await flush();
  expect(mockClient.reset).not.toHaveBeenCalled();
});

test('signing out forgets the person', async () => {
  mockAuth = { session: null, loading: false };
  mockClient.getDistinctId.mockReturnValue('user-1');
  await render(<Analytics apiKey="k" host="h" />);
  await flush();
  expect(mockClient.reset).toHaveBeenCalledTimes(1);
});

test('a confirmed session identifies, and an unsettled one does nothing yet', async () => {
  mockAuth = { session: { user: { id: 'user-1' } }, loading: true };
  const view = await render(<Analytics apiKey="k" host="h" />);
  expect(mockClient.identify).not.toHaveBeenCalled();
  mockAuth = { session: { user: { id: 'user-1' } }, loading: false };
  await view.rerender(<Analytics apiKey="k" host="h" />);
  expect(mockClient.identify).toHaveBeenCalledWith('user-1');
  expect(mockClient.reset).not.toHaveBeenCalled();
  // A launch with a saved session is not a sign-in.
  expect(noteSignIn).not.toHaveBeenCalled();
});

test('signing in here, by code or link, is noted once', async () => {
  mockAuth = { session: null, loading: false };
  const view = await render(<Analytics apiKey="k" host="h" />);
  await flush();
  mockAuth = { session: { user: { id: 'user-1' } }, loading: false };
  await view.rerender(<Analytics apiKey="k" host="h" />);
  expect(noteSignIn).toHaveBeenCalledTimes(1);
  expect(noteSignIn).toHaveBeenCalledWith({ id: 'user-1' });
  expect(mockClient.identify).toHaveBeenCalledWith('user-1');
});
