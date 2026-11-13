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
