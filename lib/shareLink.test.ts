// Q31: a shared link arrived twice on iOS, because it went as both the
// message and the url. Each platform gets the link once.
import { Share } from 'react-native';

import { linkShareContent, shareLink } from './shareLink';

// burnt ships untranspiled ESM; the toast isn't what's tested here.
jest.mock('burnt', () => ({ toast: jest.fn() }));

const url = 'https://babyvom.it/m/saturday-at-home';

test('iOS gets the link only as the url', () => {
  expect(linkShareContent('ios', url, 'Saturday at home')).toEqual({ url, title: 'Saturday at home' });
});

test('iOS keeps a lead-in as the message, without the link in it', () => {
  expect(linkShareContent('ios', url, 'Flavor map', 'What goes with gin')).toEqual({ url, title: 'Flavor map', message: 'What goes with gin' });
});

test('Android gets the link once, in the message text', () => {
  expect(linkShareContent('android', url, 'Saturday at home')).toEqual({ message: url, title: 'Saturday at home' });
  expect(linkShareContent('android', url, 'Flavor map', 'What goes with gin')).toEqual({ message: `What goes with gin: ${url}`, title: 'Flavor map' });
});

test('shareLink opens the share sheet once with that payload', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  await expect(shareLink(url, 'Saturday at home')).resolves.toBe('shared');
  expect(share).toHaveBeenCalledTimes(1);
  expect(share).toHaveBeenCalledWith({ url, title: 'Saturday at home' });
  share.mockRestore();
});
