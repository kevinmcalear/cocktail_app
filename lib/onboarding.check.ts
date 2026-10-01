// Checks for lib/onboarding.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { afterAgeCheck, authRedirect, barNameError, drinkNameError, handleError, menuNameError, nameError, needsOnboarding, nextStep, roleError, splitName, venueLabel, yearError } from './onboarding';

assert.equal(needsOnboarding(null), false);
assert.equal(needsOnboarding({}), false);
assert.equal(needsOnboarding({ onboarded: true }), false);
assert.equal(needsOnboarding({ onboarded: false }), true);
assert.equal(needsOnboarding({ onboarded: 'false' }), true);

assert.equal(afterAgeCheck({ onboarded: false }), '/onboarding');
assert.equal(afterAgeCheck({}), '/(tabs)');

assert.equal(nextStep('name'), 'hospitality');
assert.equal(nextStep('hospitality', 'yes'), 'find');
assert.equal(nextStep('hospitality', 'no'), 'units');
assert.equal(nextStep('find', 'claim'), 'units');
assert.equal(nextStep('find', 'new'), 'work');
assert.equal(nextStep('work'), 'past');
assert.equal(nextStep('past'), 'menus');
assert.equal(nextStep('menus'), 'drinks');
assert.equal(nextStep('drinks'), 'units');
assert.equal(nextStep('units'), 'done');

assert.equal(venueLabel({ display_name: 'Attaboy', locality: 'New York' }), 'Attaboy, New York');
assert.equal(venueLabel({ display_name: 'Attaboy', locality: null, is_closed: true }), 'Attaboy, closed');

assert.deepEqual(splitName('  Jo   Juniper '), { firstName: 'Jo', lastName: 'Juniper' });
assert.deepEqual(splitName('Kevin'), { firstName: 'Kevin', lastName: '' });

assert.equal(nameError(''), 'Add the name people will see.');
assert.equal(nameError('Jo'), 'Use a name with at least 3 letters.');
assert.equal(nameError('Kevin'), null);
assert.equal(nameError('Jo Juniper'), null);
assert.match(nameError('x'.repeat(81)) ?? '', /80/);

assert.match(handleError('a') ?? '', /3 to 30/);
assert.equal(handleError('jo.juniper'), undefined);

assert.equal(roleError(''), 'Add your role, like Bartender.');
assert.equal(roleError('Bartender'), null);
assert.match(roleError('x'.repeat(61)) ?? '', /60/);

assert.equal(barNameError('  '), 'Add the bar’s name.');
assert.equal(barNameError('Little Rye'), null);

assert.equal(menuNameError(''), 'Add the menu’s name.');
assert.equal(menuNameError('Summer list'), null);
assert.match(menuNameError('x'.repeat(121)) ?? '', /120/);

assert.equal(drinkNameError(' '), 'Add the cocktail’s name.');
assert.equal(drinkNameError('Penicillin'), null);
assert.match(drinkNameError('x'.repeat(81)) ?? '', /80/);

assert.equal(yearError(''), null);
assert.equal(yearError('2019'), null);
assert.match(yearError('1899') ?? '', /1900/);
assert.match(yearError('nope') ?? '', /1900/);

const base = { hasSession: false, inAuthGroup: false, authScreen: undefined, stayInAuth: false, passwordRecovery: false, segment: undefined, needsOnboarding: false };
assert.equal(authRedirect({ ...base, inAuthGroup: true, authScreen: 'login', segment: 'auth' }), null);
assert.equal(authRedirect(base), '/auth/login');
assert.equal(authRedirect({ ...base, passwordRecovery: true, authScreen: 'login' }), '/auth/reset-password');
assert.equal(authRedirect({ ...base, hasSession: true, passwordRecovery: true, inAuthGroup: true, authScreen: 'reset-password', stayInAuth: true }), null);

assert.equal(authRedirect({ ...base, hasSession: true, inAuthGroup: true, authScreen: 'sign-up' }), '/age-check');
assert.equal(authRedirect({ ...base, hasSession: true, inAuthGroup: true, authScreen: 'login' }), '/(tabs)');
assert.equal(authRedirect({ ...base, hasSession: true, inAuthGroup: true, authScreen: 'login', needsOnboarding: true }), '/onboarding');
// The email link owns the next step; setup waits until the age check.
assert.equal(authRedirect({ ...base, hasSession: true, inAuthGroup: true, authScreen: 'callback', stayInAuth: true, needsOnboarding: true }), null);
assert.equal(authRedirect({ ...base, hasSession: true, segment: '(tabs)', needsOnboarding: true }), '/onboarding');
assert.equal(authRedirect({ ...base, hasSession: true, segment: 'onboarding', needsOnboarding: true }), null);
assert.equal(authRedirect({ ...base, hasSession: true, segment: 'age-check', needsOnboarding: true }), null);
assert.equal(authRedirect({ ...base, hasSession: true, segment: '(tabs)' }), null);
