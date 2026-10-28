import assert from 'node:assert/strict';

import { claimApprovedEmail, claimArrivedEmail, claimDeclinedEmail, claimToConfirmEmail, cocktailSender, methodLine, type ClaimFacts } from '../supabase/functions/_shared/claimEmail';

const site = 'https://babyvom.it';
const person: ClaimFacts = {
  page: { id: '00000000-0000-0000-0000-000000000001', kind: 'person', name: 'Rob Hale', handle: 'robhale' },
  claimant: 'Robert Hale',
  method: 'note',
  instagram: null,
  note: 'I ran the bar at Little Rye.',
  confirmBar: null,
  confirmedByBar: false,
  declineReason: null,
  rival: false,
};
const bar: ClaimFacts = { ...person, page: { ...person.page, kind: 'bar', name: 'Little Rye', handle: 'littlerye' }, claimant: null, method: 'instagram', instagram: 'littlerye', note: null };

// Moderators: who, which page, how, the note, and Review claims.
const arrived = claimArrivedEmail(person, site);
assert.equal(arrived.subject, 'Robert Hale claims Rob Hale');
assert.match(arrived.text, /Robert Hale says they're Rob Hale/);
assert.match(arrived.text, /How we check: A note\./);
assert.match(arrived.text, /Their note: I ran the bar at Little Rye\./);
assert.match(arrived.text, /Review claims: https:\/\/babyvom\.it\/p\/review-claims/);
assert.match(arrived.text, /https:\/\/babyvom\.it\/p\/robhale/);
const barArrived = claimArrivedEmail(bar, site);
assert.equal(barArrived.subject, 'Someone claims Little Rye');
assert.match(barArrived.text, /A code sent from @littlerye on Instagram\./);
assert.doesNotMatch(barArrived.html, /Their note/);
assert.equal(methodLine({ ...bar, method: 'phone' }), 'A call to the bar with a code.');
assert.equal(methodLine({ ...person, confirmBar: 'Little Rye' }), 'Asked Little Rye to confirm them.');
assert.match(claimArrivedEmail({ ...person, confirmBar: 'Little Rye' }, site).text, /Little Rye can't confirm it just now, so a moderator decides\./);

// The bar's Admins: in the bar's look, pointing at My team.
const look = { name: 'Little Rye', logoUrl: null, color: '#D0643B', face: 'fraunces' };
const confirm = claimToConfirmEmail({ ...person, confirmBar: 'Little Rye' }, look, site);
assert.equal(confirm.subject, "Robert Hale says they're Rob Hale");
assert.match(confirm.text, /Is this Rob Hale\?/);
assert.match(confirm.text, /the page and its drinks become theirs, and if they still work here they join the team as a Bartender\./, 'as the Team screen says it');
assert.match(confirm.text, /Open My team: https:\/\/babyvom\.it\/team/);
assert.match(confirm.html, /#D0643B/);

// Approved: a person goes to You, a bar to its page.
const yours = claimApprovedEmail(person, site, null);
assert.equal(yours.subject, "Rob Hale's page is yours now");
assert.match(yours.text, /It's you\nWe checked, and Rob Hale's page is yours now\./);
assert.match(yours.text, /Open You: https:\/\/babyvom\.it\/profile/);
assert.match(claimApprovedEmail({ ...person, confirmBar: 'Little Rye', confirmedByBar: true }, site, null).text, /Little Rye confirmed it, and/);
const barYours = claimApprovedEmail(bar, site, look);
assert.match(barYours.text, /Open Little Rye: https:\/\/babyvom\.it\/p\/littlerye/);

// Turned down: the reason and the way back; a rival's win says so plainly.
const no = claimDeclinedEmail({ ...person, declineReason: 'We could not match the Instagram.' }, site);
assert.equal(no.subject, 'Your claim on Rob Hale');
assert.match(no.text, /We couldn't confirm it's you/);
assert.match(no.text, /Why: We could not match the Instagram\./);
assert.match(no.text, /Try again: https:\/\/babyvom\.it\/p\/robhale/);
assert.doesNotMatch(claimDeclinedEmail(person, site).html, />Why</);
const rival = claimDeclinedEmail({ ...bar, rival: true, declineReason: 'Someone else claimed this page first.' }, site);
assert.match(rival.text, /Someone else claimed Little Rye first/);
assert.match(rival.text, /Get help: https:\/\/babyvom\.it\/support/);

// What people typed is text, never markup.
const sly = claimArrivedEmail({ ...person, claimant: '<img src=x>', note: '<script>x</script>' }, site);
assert.doesNotMatch(sly.html, /<script>|<img src=x>/);
assert.equal(cocktailSender('invites@babyvom.it'), '"Cocktail" <invites@babyvom.it>');
