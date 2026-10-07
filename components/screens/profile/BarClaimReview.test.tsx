import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { ClaimForReview } from '@/hooks/useProfiles';

import { BarClaimCard } from './BarClaimReview';

const onReview = jest.fn();

const claim = (fields: Partial<ClaimForReview>): ClaimForReview => ({
  id: 'c1',
  profile_id: 'p1',
  user_id: 'them',
  bar_id: null,
  message: 'Sam, head bartender',
  status: 'pending',
  created_at: '2026-10-07T12:00:00Z',
  method: 'instagram',
  code: '482913',
  evidence: { instagram: 'palemoth' },
  decline_reason: null,
  profile: {
    id: 'p1',
    kind: 'bar',
    handle: 'pale.moth',
    display_name: 'Pale Moth',
    website: 'https://www.palemoth.com/',
    instagram: 'palemoth',
    social_links: null,
    locality: 'Fitzroy',
    city: 'Melbourne',
    country_code: 'AU',
    is_closed: false,
  },
  bar: null,
  claimant: { display_name: 'Sam', handle: 'sam.okafor' },
  ...fields,
});

beforeEach(() => onReview.mockReset());

test('an Instagram claim puts the page’s handle beside the claimant’s code', async () => {
  await renderWithTamagui(<BarClaimCard claim={claim({})} busy={false} onOpen={jest.fn()} onReview={onReview} />);
  expect(screen.getByText('On the page')).toBeTruthy();
  expect(screen.getByText('From them')).toBeTruthy();
  expect(screen.getByText('palemoth.com')).toBeTruthy();
  expect(screen.getByText('482 913')).toBeTruthy();
  expect(screen.getByText(/look for 482 913 in the bio/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  expect(onReview).toHaveBeenCalledWith({ claimId: 'c1', approve: true, code: undefined });
});

test('a phone claim hides the code and only approves once the moderator types what they heard', async () => {
  await renderWithTamagui(<BarClaimCard claim={claim({ method: 'phone' })} busy={false} onOpen={jest.fn()} onReview={onReview} />);
  expect(screen.queryByText('482 913')).toBeNull();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Code they read out'), '482 913');
  await fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  expect(onReview).toHaveBeenCalledWith({ claimId: 'c1', approve: true, code: '482 913' });
});

test('turning one down sends the reason', async () => {
  await renderWithTamagui(<BarClaimCard claim={claim({ method: 'email', code: null, evidence: { email_domain: 'fourseasons.com', review_reason: 'page_on_larger_site' } })} busy={false} onOpen={jest.fn()} onReview={onReview} />);
  expect(screen.getByText(/bigger site, like a hotel group’s/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Reason, if you turn it down'), 'That address is the hotel group’s.');
  await fireEvent.press(screen.getByRole('button', { name: 'Turn down' }));
  expect(onReview).toHaveBeenCalledWith({ claimId: 'c1', approve: false, reason: 'That address is the hotel group’s.' });
});
