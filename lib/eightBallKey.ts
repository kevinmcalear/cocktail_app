/**
 * The eight ball's keyboard shortcut (Kevin, 10 Oct). The desktop app takes ⌘8.
 * In a browser ⌘1 to ⌘8 switch tabs, so the web uses ⇧⌘8. Ctrl stands in for ⌘
 * off Apple. ⌘K "Pick for me" works everywhere.
 */
export type EightBallKeys = { shift: boolean; apple: boolean };

export function eightBallLabel({ shift, apple }: EightBallKeys): string {
  if (apple) return shift ? '⇧⌘8' : '⌘8';
  return shift ? 'Shift Ctrl 8' : 'Ctrl 8';
}

type KeyLike = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey'>;

/** Matches on Digit8 too, so layouts with 8 on a shifted key work, and Shift turning 8 into * doesn't miss. */
export function isEightBallKey(e: KeyLike, shift: boolean): boolean {
  if (!(e.metaKey || e.ctrlKey) || Boolean(e.shiftKey) !== shift) return false;
  return e.code === 'Digit8' || e.key === '8' || (shift && e.key === '*');
}
