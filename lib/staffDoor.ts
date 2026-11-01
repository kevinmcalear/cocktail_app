import { withArticle } from '@/lib/onboarding';
import { roleLabel } from '@/lib/roles';
import { askedAgo } from '@/lib/team';

/**
 * The staff link door for someone signed in who isn't on the team (boards
 * Miss-door, Miss-door-desk): ask to join, asked, join straight in when
 * nobody approves, and link off.
 */
export type DoorState = 'ask' | 'asked' | 'join' | 'off';

export interface DoorFacts {
  linkOn: boolean;
  approve: boolean;
  /** Their ask, waiting (declined asks don't count: the door lets them try, and says no). */
  asked: boolean;
}

/**
 * A waiting ask still stands when the link goes off (an Admin can still say
 * yes), but not once approval is off: then they can just join.
 */
export function doorState({ linkOn, approve, asked }: DoorFacts): DoorState {
  if (!linkOn) return asked ? 'asked' : 'off';
  if (!approve) return 'join';
  return asked ? 'asked' : 'ask';
}

export interface DoorLines {
  title: string;
  body: string;
  /** The main button; the second is quiet. */
  primary: string;
  secondary: string | null;
  note: string | null;
  noteIcon: 'person.2' | 'clock';
}

export function doorLines(
  state: DoorState,
  x: {
    bar: string;
    /** Your own name. */
    me: string | null;
    /** The first name of the Admin who answers; none when the link is off or nobody is named. */
    admin: string | null;
    admins: number;
    role: number;
    askedAt: string | null;
    now: number;
  },
): DoorLines {
  const signedIn = x.me ? `You’re signed in as ${x.me}.` : 'You’re signed in.';
  const as = withArticle(roleLabel(x.role));
  const who = x.admin ?? 'An Admin';
  if (state === 'off') {
    return {
      title: 'This link is off',
      body: `${x.bar} turned off its staff link. Ask someone on the team to invite you by email, or for the new link.`,
      primary: 'Done',
      secondary: null,
      note: null,
      noteIcon: 'person.2',
    };
  }
  if (state === 'asked') {
    const see = !x.admin ? 'The Admins see' : x.admins > 1 ? `${x.admin} and the other Admins see` : `${x.admin} sees`;
    const ago = askedAgo(x.askedAt, x.now);
    return {
      title: 'Asked',
      body: `${see} your name on Team. We’ll tell you when you’re in, and this link opens tonight’s menu from then on.`,
      primary: 'Done',
      secondary: 'Take back your ask',
      note: ago ? `Asked ${ago}, as ${as}.` : `Asked, as ${as}.`,
      noteIcon: 'clock',
    };
  }
  if (state === 'join') {
    return {
      title: `Join ${x.bar}`,
      body: `${signedIn} Anyone with this link joins straight away. You’ll see tonight’s menu, the specs and the prep list.`,
      primary: `Join as ${as}`,
      secondary: 'Use a different account',
      note: `${who} can change your role, or take you off the team.`,
      noteIcon: 'person.2',
    };
  }
  return {
    title: `Join ${x.bar}`,
    body: `${signedIn} Ask, and an Admin adds you. Then you’ll see tonight’s menu, the specs and the prep list.`,
    primary: 'Ask to join',
    secondary: 'Use a different account',
    note: `You join as ${as}. ${who} can change that.`,
    noteIcon: 'person.2',
  };
}
