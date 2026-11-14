/**
 * How many writes saved on this phone are waiting to send, or didn't
 * (components/OfflineBanner.tsx, components/UnsentWrites.tsx, Sta-errors:
 * "2 changes didn't send"). Each row's words are in lib/unsentRows.ts.
 */

const changes = (n: number) => (n === 1 ? '1 change' : `${n} changes`);

/** "2 changes waiting to send". */
export const waitingWords = (n: number) => `${changes(n)} waiting to send`;

/** "2 changes didn't send". */
export const didntSendWords = (n: number) => `${changes(n)} didn’t send`;

/**
 * Said of a drink that was refused: Send would refuse it again, it's saved again from Add (its row in
 * components/UnsentWrites.tsx, and its alert, hooks/useCreateDrink.ts). Here, not with the rows: both are loaded
 * apart, and a module they share lands in every page's first load.
 */
export const STILL_IN_ADD = 'It’s still in Add, under Pick up where you left off.';
