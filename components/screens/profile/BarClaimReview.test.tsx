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
  setup: null,
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
  claimant: { name: 'Sam Okafor', email: null, handle: 'sam.okafor', works_here: [] },
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

test('an Instagram claim from venue setup is checked in our messages, not the bio', async () => {
  await renderWithTamagui(<BarClaimCard claim={claim({ evidence: { instagram: 'palemoth', instagram_dm: true } })} busy={false} onOpen={jest.fn()} onReview={onReview} />);
  expect(screen.getByText(/messages for one from @palemoth with 482 913/)).toBeTruthy();
  expect(screen.queryByText(/in the bio/)).toBeNull();
});

test('a person’s Instagram claim: who, their email, no venue and no bar phone', async () => {
  const mat = claim({
    evidence: { instagram: 'drink_smith', instagram_dm: true },
    profile: { id: 'mr', kind: 'person', handle: 'mathew.resler', display_name: 'Mathew Resler', website: null, instagram: 'drink_smith', social_links: null, locality: null, city: 'New York', country_code: null, is_closed: false },
    claimant: { name: 'Matt Reisler', email: 'matt@example.test', handle: null, works_here: [] },
  });
  await renderWithTamagui(<BarClaimCard claim={mat} busy={false} onOpen={jest.fn()} onReview={onReview} />);
  expect(screen.getByText(/a person’s page$/)).toBeTruthy();
  expect(screen.queryByText(/makes a new venue/)).toBeNull();
  expect(screen.queryByText('Find its number')).toBeNull();
  expect(screen.getByText('Matt Reisler (no profile yet)')).toBeTruthy();
  expect(screen.getByText('matt@example.test')).toBeTruthy();
});

test('a bar claim shows the claimant’s job there', async () => {
  const works = { person: 'Mathew Resler', title: 'Head bartender', is_current: true, start_year: 2026, start_month: 3, claimed: true };
  await renderWithTamagui(<BarClaimCard claim={claim({ claimant: { name: 'Matt Reisler', email: null, handle: 'mathew.resler', works_here: [works] } })} busy={false} onOpen={jest.fn()} onReview={onReview} />);
  expect(screen.getByText('Mathew Resler, Head bartender, since Mar 2026 (their page)')).toBeTruthy();
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

test('a handle the claimant typed shows as theirs, not the page’s, and is checked first', async () => {
  const page = { ...claim({}).profile!, instagram: null, website: null };
  const typed = claim({ profile: page, evidence: { instagram: 'harbourroom', instagram_dm: true, typed: { instagram: 'harbourroom' } } });
  await renderWithTamagui(<BarClaimCard claim={typed} busy={false} onOpen={jest.fn()} onReview={onReview} />);
  expect(screen.getAllByText('None')).toHaveLength(2);
  expect(screen.getByText('Instagram they typed')).toBeTruthy();
  expect(screen.getByText(/They typed @harbourroom, so first check it’s the bar’s own account/)).toBeTruthy();
});
