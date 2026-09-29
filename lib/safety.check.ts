import assert from 'node:assert/strict';

import { countries, countryName, searchCountries } from './countries';
import { localeCountry, parseBirthDate, REPORT_REASONS, reportErrorMessage, reportRow } from './safety';

// Every reason the reports table takes, once, each with words.
assert.deepEqual(
  REPORT_REASONS.map((r) => r.value).sort(),
  ['fake_rankings', 'harassment', 'hate', 'impersonation', 'misleading', 'other', 'self_harm', 'sexual', 'spam', 'under_age', 'violence']
);
assert.ok(REPORT_REASONS.every((r) => r.label && r.detail));

// Only the target columns for the kind (the table's CHECK), details trimmed.
assert.deepEqual(reportRow({ kind: 'profile', profileId: 'p' }, 'spam', '  '), { target_kind: 'profile', reason: 'spam', details: null, profile_id: 'p' });
assert.deepEqual(reportRow({ kind: 'ranking', itemId: 'list', profileId: 'bar' }, 'fake_rankings', ' bought '), {
  target_kind: 'ranking',
  reason: 'fake_rankings',
  details: 'bought',
  item_id: 'list',
  profile_id: 'bar',
});
assert.equal(reportRow({ kind: 'item', itemId: 'i' }, 'other', 'x'.repeat(2000)).details?.length, 1000);

// The limits, in words.
assert.match(reportErrorMessage({ code: '23505' }, 0), /already reported/);
assert.match(reportErrorMessage({ code: '42501' }, 20), /20 reports today/);
assert.match(reportErrorMessage({ code: '42501' }, 3), /can't be reported/);
assert.match(reportErrorMessage(null, null), /connection/);

// Birth dates: real calendar dates only, never in the future.
const today = new Date(2026, 8, 29);
assert.deepEqual(parseBirthDate('7', '4', '1990', today), { date: '1990-04-07' });
assert.deepEqual(parseBirthDate('29', '2', '2004', today), { date: '2004-02-29' });
assert.ok('error' in parseBirthDate('29', '2', '2005', today));
assert.ok('error' in parseBirthDate('31', '4', '1990', today));
assert.ok('error' in parseBirthDate('', '4', '1990', today));
assert.ok('error' in parseBirthDate('7', '4', '90', today));
assert.ok('error' in parseBirthDate('7', 'Apr', '1990', today));
assert.ok('error' in parseBirthDate('30', '9', '2026', today));
assert.deepEqual(parseBirthDate('29', '9', '2026', today), { date: '2026-09-29' });
assert.ok('error' in parseBirthDate('1', '1', '1899', today));

// The device's country, when it has a real one.
assert.equal(localeCountry([{ regionCode: null }, { regionCode: 'au' }]), 'AU');
assert.equal(localeCountry([{ regionCode: '419' }]), null);
assert.equal(localeCountry([]), null);

// The country list: unique two-letter codes, searchable by name or code.
const codes = countries().map((c) => c.code);
assert.equal(new Set(codes).size, codes.length);
assert.ok(codes.length > 240 && codes.every((c) => /^[A-Z]{2}$/.test(c)));
assert.ok(['US', 'AU', 'JP', 'KR', 'CA', 'AE', 'IS', 'TH', 'GB'].every((c) => codes.includes(c)));
assert.equal(countryName('JP'), 'Japan');
assert.equal(searchCountries('aus')[0].code, 'AU');
assert.equal(searchCountries('us')[0].code, 'US');
assert.ok(searchCountries('zealand').some((c) => c.code === 'NZ'));
