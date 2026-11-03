import { lazyOnWeb } from '@/components/lazyOnWeb';

/*
 * A bar's page (the public link, quality budget B13, /p/[id]) doesn't need the
 * person, maker or supplier pages, so on the web they load from one chunk when
 * a profile of that kind is shown. One chunk, not four: each lazy chunk carries
 * its own copy of the code few routes share.
 */
export const MakerProfile = lazyOnWeb(() => import('./OtherProfiles').then((m) => m.MakerProfile));
export const PersonProfile = lazyOnWeb(() => import('./OtherProfiles').then((m) => m.PersonProfile));
export const SupplierProfile = lazyOnWeb(() => import('./OtherProfiles').then((m) => m.SupplierProfile));
export const UnclaimedPerson = lazyOnWeb(() => import('./OtherProfiles').then((m) => m.UnclaimedPerson));
