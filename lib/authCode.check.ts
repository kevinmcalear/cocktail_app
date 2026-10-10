import assert from 'node:assert/strict';

import { CODE_LENGTH, cleanCode, emailLooksRight, isFirstSignIn, sendProblem, verifyProblem } from './authCode';

// Pasted codes keep their digits only, cut to the code's length.
assert.equal(cleanCode('482 913'), '482913');
assert.equal(cleanCode('482-913\n'), '482913');
assert.equal(cleanCode('12345678'), '12345678'.slice(0, CODE_LENGTH));
assert.equal(cleanCode('abc'), '');

assert.equal(emailLooksRight(' jo@example.com '), true);
assert.equal(emailLooksRight('jo@example'), false);
assert.equal(emailLooksRight('jo example@x.com'), false);
assert.equal(emailLooksRight(''), false);

// Auth's error codes become words a person can act on.
assert.match(sendProblem({ message: 'x', code: 'over_email_send_rate_limit' }), /Wait a minute/);
assert.match(sendProblem({ message: 'x', code: 'email_address_invalid' }), /doesn’t look right/);
assert.equal(sendProblem({ message: 'Network down' }), 'Network down');
assert.match(verifyProblem({ message: 'Token has expired or is invalid', code: 'otp_expired' }), /doesn’t match/);
assert.match(verifyProblem({ message: 'Token has expired or is invalid' }), /newest email/);
assert.match(verifyProblem({ message: 'x', code: 'over_request_rate_limit' }), /Too many tries/);

// A first sign-in confirms the email at the same moment; a returning one confirmed it long ago.
assert.equal(isFirstSignIn({ email_confirmed_at: '2026-10-10T12:00:00.100Z', last_sign_in_at: '2026-10-10T12:00:00.400Z' }), true);
assert.equal(isFirstSignIn({ email_confirmed_at: '2026-09-01T12:00:00Z', last_sign_in_at: '2026-10-10T12:00:00Z' }), false);
assert.equal(isFirstSignIn({ last_sign_in_at: '2026-10-10T12:00:00Z' }), false);
