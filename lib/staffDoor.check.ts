import assert from 'node:assert/strict';

import { doorLines, doorState, staffLinkHref } from './staffDoor';

// Which door: the link's settings, then their ask.
assert.equal(doorState({ linkOn: true, approve: true, asked: false }), 'ask');
assert.equal(doorState({ linkOn: true, approve: true, asked: true }), 'asked');
assert.equal(doorState({ linkOn: true, approve: false, asked: false }), 'join');
assert.equal(doorState({ linkOn: true, approve: false, asked: true }), 'join', 'approval went off while waiting: just join');
assert.equal(doorState({ linkOn: false, approve: true, asked: false }), 'off');
assert.equal(doorState({ linkOn: false, approve: false, asked: true }), 'asked', 'the link went off while waiting: the ask still stands');

const now = Date.parse('2026-11-01T20:00:00Z');
const base = { bar: 'Caretaker’s', me: 'Sam Whitlock', admin: 'Ana', admins: 2, role: 30, askedAt: '2026-11-01T19:40:00Z', now };

// As drawn (Miss-door).
const ask = doorLines('ask', base);
assert.equal(ask.title, 'Join Caretaker’s');
assert.equal(ask.body, 'You’re signed in as Sam Whitlock. Ask, and an Admin adds you. Then you’ll see tonight’s menu, the specs and the prep list.');
assert.equal(ask.primary, 'Ask to join');
assert.equal(ask.secondary, 'Use a different account');
assert.equal(ask.note, 'You join as a Bartender. Ana can change that.');

const asked = doorLines('asked', base);
assert.equal(asked.title, 'Asked');
assert.equal(asked.body, 'Ana and the other Admins see your name on Team. We’ll tell you when you’re in, and this link opens tonight’s menu from then on.');
assert.deepEqual([asked.primary, asked.secondary], ['Done', 'Take back your ask']);
assert.equal(asked.note, 'Asked 20 minutes ago, as a Bartender.');
assert.equal(asked.noteIcon, 'clock');

const join = doorLines('join', base);
assert.equal(join.body, 'You’re signed in as Sam Whitlock. Anyone with this link joins straight away. You’ll see tonight’s menu, the specs and the prep list.');
assert.equal(join.primary, 'Join as a Bartender');
assert.equal(join.note, 'Ana can change your role, or take you off the team.');

const off = doorLines('off', base);
assert.equal(off.title, 'This link is off');
assert.equal(off.body, 'Caretaker’s turned off its staff link. Ask someone on the team to invite you by email, or for the new link.');
assert.deepEqual([off.primary, off.secondary, off.note], ['Done', null, null]);

// The link's role, with its article; one Admin, or none named.
assert.equal(doorLines('ask', { ...base, role: 20 }).note, 'You join as an Employee. Ana can change that.');
assert.equal(doorLines('join', { ...base, role: 35 }).primary, 'Join as a Drink Creator');
assert.match(doorLines('asked', { ...base, admins: 1 }).body, /^Ana sees your name on Team\./);
assert.match(doorLines('asked', { ...base, admin: null }).body, /^The Admins see your name on Team\./);
assert.equal(doorLines('ask', { ...base, admin: null }).note, 'You join as a Bartender. An Admin can change that.');
assert.equal(doorLines('asked', { ...base, askedAt: '2026-11-01T19:59:30Z' }).note, 'Asked just now, as a Bartender.');

// Their link was replaced while they wait: the ask stands, its role isn't known.
assert.equal(doorLines('asked', { ...base, role: null }).note, 'Asked 20 minutes ago.');
assert.equal(doorLines('off', { ...base, admin: null, role: null }).title, 'This link is off');

// Asked before and the team said no: it says so and offers no ask the server would refuse.
assert.equal(doorState({ linkOn: true, approve: true, asked: false, declined: true }), 'declined');
assert.equal(doorState({ linkOn: true, approve: false, asked: false, declined: true }), 'declined', 'the server refuses before it checks approval');
assert.equal(doorState({ linkOn: false, approve: true, asked: false, declined: true }), 'off');
const no = doorLines('declined', base);
assert.equal(no.note, 'The team said no last time.');
assert.deepEqual([no.primary, no.secondary], ['Done', 'Use a different account']);

// A pasted staff link opens the door; the team link (no secret) and other text do not.
assert.equal(staffLinkHref('https://babyvom.it/v/caretakers?join=abc123'), '/v/caretakers?join=abc123');
assert.equal(staffLinkHref('  https://example.com/v/pale-moth?x=1&join=t%2Bk  '), '/v/pale-moth?join=t%2Bk');
assert.equal(staffLinkHref('https://babyvom.it/v/caretakers'), '/v/caretakers', 'a plain venue link opens the venue page');
assert.equal(staffLinkHref('see https://babyvom.it/v/caretakers?join=abc and more'), null, 'only the link, nothing around it');
assert.equal(staffLinkHref('https://babyvom.it/v/caretakers?join='), null, 'an empty secret is no link');
assert.equal(staffLinkHref('a negroni recipe'), null);
