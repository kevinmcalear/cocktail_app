import assert from 'node:assert/strict';

import { accentOf, barSender, deleteDay, initials, inviteEmail, textOn, venueDeleteEmail } from '../supabase/functions/_shared/barEmail';

const bar = { name: 'Little Rye', logoUrl: null, color: '#D0643B', face: 'fraunces' };

// One email, account or not: the welcome signed by the sender, then the note.
const email = inviteEmail({ bar, role: 'Bartender', sender: 'Rob Hale', welcome: 'Welcome to Little Rye.\nAsk me anything.', note: 'Thursday, with Jo.', joinUrl: 'https://babyvom.it/auth/callback?token_hash=abc&type=invite' });
assert.equal(email.subject, 'Rob invited you to Little Rye');
assert.match(email.html, /Join Little Rye as a Bartender/);
assert.match(email.html, /Rob Hale added you to the team\./);
assert.match(email.html, /Welcome to Little Rye\.<br>Ask me anything\./);
assert.match(email.html, /A note for you/);
assert.match(email.html, /family=Fraunces/);
assert.match(email.html, /href="https:\/\/babyvom\.it\/auth\/callback\?token_hash=abc&amp;type=invite"/);
assert.match(email.html, />LR</, 'no logo: the initials');
assert.match(email.text, /Join Little Rye: https:\/\/babyvom\.it\/auth\/callback\?token_hash=abc&type=invite/);

// No welcome and no note: straight from "added you" to Join; no sender, the bar's name.
const bare = inviteEmail({ bar: { ...bar, color: 'red', face: 'gone' }, role: 'Admin', sender: null, welcome: null, note: null, joinUrl: 'https://babyvom.it/x' });
assert.equal(bare.subject, "You're invited to Little Rye");
assert.match(bare.html, /Join Little Rye as an Admin/);
assert.doesNotMatch(bare.html, /A note for you/);
assert.match(bare.html, /family=Instrument\+Serif/, 'an unknown face falls back to the app default');
assert.match(bare.html, /#E4B062/, 'a bad colour falls back to Cocktail’s accent');

// What the Admin typed is text, never markup.
const sly = inviteEmail({ bar: { ...bar, name: 'Bad <b>Bar</b>' }, role: 'Guest', sender: '<img src=x>', welcome: '<script>x</script>', note: '"quoted"', joinUrl: 'https://babyvom.it/x' });
assert.doesNotMatch(sly.html, /<script>|<img src=x>|<b>Bar/);
assert.match(sly.html, /&lt;script&gt;/);

assert.equal(barSender('Little Rye', 'invites@babyvom.it'), '"Little Rye via Cocktail" <invites@babyvom.it>');
assert.equal(barSender('Bad "Bar" <x>\r\nBcc: y', 'invites@babyvom.it'), '"Bad Bar x Bcc: y via Cocktail" <invites@babyvom.it>');
assert.equal(initials('The Little Rye'), 'TL');
assert.equal(accentOf(null), '#E4B062');
assert.equal(textOn('#FFFFFF'), '#0E0D0C');
assert.equal(textOn('#1A1A1A'), '#F3EEE6');

// The other Admins hear who asked to delete the venue, the day it goes, and where Undo is.
const gone = venueDeleteEmail({ bar, askedBy: 'Rob Hale', deletesAt: '2026-11-03T12:00:00Z', undoUrl: 'https://babyvom.it/settings/bar/b1' });
assert.equal(deleteDay('2026-11-03T12:00:00Z'), 'Tue 3 Nov');
assert.equal(gone.subject, 'Rob asked to delete Little Rye');
assert.match(gone.html, /Little Rye goes on Tue 3 Nov/);
assert.match(gone.html, /Undo, keep Little Rye/);
assert.match(gone.text, /https:\/\/babyvom\.it\/settings\/bar\/b1/);
assert.equal(venueDeleteEmail({ bar, askedBy: null, deletesAt: '2026-11-03T12:00:00Z', undoUrl: 'https://babyvom.it/x' }).subject, 'An Admin asked to delete Little Rye');
