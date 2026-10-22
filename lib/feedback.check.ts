import assert from 'node:assert/strict';

import { canSend, deviceLine, FEEDBACK_MAX, feedbackEmail, feedbackError, feedbackRow, PROBLEM_KINDS, sentWithLine } from './feedback';

// Report a problem's kinds are the table's, once each, and never 'different'.
assert.deepEqual(PROBLEM_KINDS.map((k) => k.id), ['broken', 'wrong', 'slow', 'data', 'other']);

// "Sent with": the screen, the drink, then the bar (only with its id), as the board draws it.
const ice = { screen: 'Adding a drink › Ice', subject: ' Ash Garden ', barId: 'bar', barName: 'Little Rye' };
assert.equal(sentWithLine(ice), 'Adding a drink › Ice · Ash Garden · Little Rye');
assert.equal(sentWithLine({ screen: 'Adding a drink › Ice', subject: '', barId: null, barName: 'the venue' }), 'Adding a drink › Ice');
assert.equal(sentWithLine({ screen: 'Settings › Report a problem' }, true), 'Settings › Report a problem · app version and device');

assert.equal(deviceLine('1.5.0', 'ios', '26.1'), 'App 1.5.0 on ios 26.1');
assert.equal(deviceLine(null, 'web', undefined), 'App unknown on web');
assert.equal(deviceLine('1.5.0', 'web', '0.0.0'), 'App 1.5.0 on web');

// The row: trimmed, cut to the table's limits, the bar's id only.
const row = feedbackRow('different', `  ${'x'.repeat(FEEDBACK_MAX + 5)} `, ice, '/add-drink', 'App 1.5.0 on web');
assert.equal(row.body.length, FEEDBACK_MAX);
assert.deepEqual({ ...row, body: '' }, { kind: 'different', screen: 'Adding a drink › Ice', route: '/add-drink', subject: 'Ash Garden', bar_id: 'bar', body: '', device: 'App 1.5.0 on web' });
assert.equal(feedbackRow('broken', ' ', { screen: ' ' }, '', 'd').screen, 'Somewhere in the app');
assert.equal(feedbackRow('broken', ' ', { screen: 'S' }, '', 'd').route, null);

// A new method needs words; a problem only its kind.
assert.equal(canSend('different', '  '), false);
assert.equal(canSend('different', 'Stacked blocks'), true);
assert.equal(canSend('broken', ''), true);
assert.equal(canSend(null, 'words'), false);

// The daily limit says so; anything else offers the email.
assert.match(feedbackError({ code: '42501' }, 20), /20 notes today/);
assert.match(feedbackError({ code: '42501' }, 3), /email us instead/);
assert.match(feedbackError(null, null), /didn’t send/);

const email = feedbackEmail('Cocktail', 'different', 'Stacked blocks', ice, 'App 1.5.0 on ios 26.1');
assert.equal(email.subject, 'Cocktail: We do it differently');
assert.equal(email.body, 'Stacked blocks\n\n---\nAdding a drink › Ice · Ash Garden · Little Rye\nApp 1.5.0 on ios 26.1');
assert.equal(feedbackEmail('Cocktail', 'slow', '', { screen: 'Settings › Report a problem' }, 'd').subject, 'Cocktail: It’s slow');
