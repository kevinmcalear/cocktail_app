import { act } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { VenueBrandRow } from '@/hooks/useVenueBrand';
import { useToastStore } from '@/store/useToastStore';

import { useBrandDraft } from './useBrandDraft';

const mockPick = jest.fn();
jest.mock('@/hooks/useVenueBrand', () => ({
  pickBrandImage: (...args: unknown[]) => mockPick(...args),
  removeLogoBackground: jest.fn(),
  useSaveVenueBrand: () => ({ mutate: jest.fn(), isPending: false }),
}));

const ROW: VenueBrandRow = {
  id: 'b1',
  name: 'Little Rye',
  slug: null,
  logo_url: null,
  primary_color: '#D0643B',
  secondary_color: null,
  display_face: 'redaction',
  ground_tint: null,
  short_name: null,
  icon_url: null,
  icon_background: null,
};

const seen: { current: ReturnType<typeof useBrandDraft> | null } = { current: null };
function Probe({ into }: { into: typeof seen }) {
  // eslint-disable-next-line react-hooks/immutability -- a test probe handing the hook out
  into.current = useBrandDraft(ROW, true);
  return null;
}

// iOS round 15: a failed logo upload went back to "No logo yet" with its message on the page under the Logo sheet.
test('a failed upload is the drawn error toast, with Try again that picks again', async () => {
  mockPick.mockRejectedValueOnce(new Error('Couldn’t reach the server. Try again in a moment.'));
  await renderWithProviders(<Probe into={seen} />);
  const draft = () => seen.current!;
  await act(() => draft().upload('logo'));
  const toast = useToastStore.getState().toast;
  expect(toast).toMatchObject({ title: 'Couldn’t upload the logo', detail: 'Couldn’t reach the server. Try again in a moment.', tone: 'error' });
  expect(draft().draft.logoUrl).toBeNull();

  mockPick.mockResolvedValueOnce({ url: 'https://x/l.png', colors: ['#aa3300'] });
  await act(async () => toast?.action?.onPress());
  expect(mockPick).toHaveBeenCalledTimes(2);
  expect(draft().draft.logoUrl).toBe('https://x/l.png');
  expect(draft().suggested).toEqual(['#AA3300']);
});
