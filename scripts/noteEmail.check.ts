import assert from 'node:assert/strict';

import { noteEmail, sentAt, sentryFeedbackUrl } from '../supabase/functions/_shared/noteEmail';

// The email the team gets for each note (feedback-email): what it says, and
// that what someone typed can't become HTML.

const note = {
  id: '6f1c2a9e-0000-4000-8000-000000000001',
  kind: 'broken',
  screen: 'Settings › Report a problem',
  body: 'The Save button <b>does nothing</b>\nafter I add ice.',
  drinkName: null,
  barName: 'Little Rye',
  appVersion: '1.5.0',
  device: 'ios 26.1',
  createdAt: '2026-10-29T01:14:00Z',
  senderId: 'u1',
  senderName: 'Sam',
  photoUrl: 'https://example.test/sign/feedback/u1/a.jpg?token=t&x=1',
};

const email = noteEmail(note);
assert.equal(email.subject, 'Something’s broken: Settings › Report a problem · Little Rye');
assert.match(email.text, /^Something’s broken\n\nThe Save button <b>does nothing<\/b>\nafter I add ice\./);
assert.match(email.text, /From: Sam \(u1\)/);
assert.match(email.text, /Device: ios 26\.1/);
assert.match(email.text, /Photo \(link works for 7 days\): https:\/\/example\.test/);
// Typed words are escaped, never markup; the photo link's & is escaped in attributes.
assert.ok(email.html.includes('The Save button &lt;b&gt;does nothing&lt;/b&gt;'));
assert.ok(!email.html.includes('<b>does nothing'));
assert.ok(email.html.includes('token=t&amp;x=1'));
assert.ok(email.html.includes(sentryFeedbackUrl(note.id)));
assert.equal(sentryFeedbackUrl('abc'), 'https://cocktail-z3.sentry.io/feedback/?query=note_id%3Aabc');

// New York time, where the team is (01:14 UTC is 9:14 PM the evening before).
assert.equal(sentAt('2026-10-29T01:14:00Z'), 'Oct 28, 2026, 9:14 PM');

// No words, no photo, no name: it still says so plainly, and leaves out what isn't there.
const bare = noteEmail({ ...note, kind: 'tell_us', body: '  ', barName: null, senderName: null, photoUrl: null, drinkName: 'Ash Garden' });
assert.equal(bare.subject, 'Tell us: Settings › Report a problem · Ash Garden');
assert.match(bare.text, /\(No words\)/);
assert.match(bare.text, /From: u1\n/);
assert.ok(!bare.text.includes('Photo'));
assert.ok(!bare.text.includes('Bar:'));
assert.ok(!bare.html.includes('<img'));

console.log('noteEmail.check: ok');
