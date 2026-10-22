import { BRAND } from '@/constants/brand';
import type { ClaimState, VenueScreen } from '@/lib/venueSetup';

/** Each venue setup screen's title and the line under it (canvas make-venue-*, and eddie-oct22-wave1 for place, claim and done). */
export function setupCopy(screen: VenueScreen, bar: string, claim: ClaimState = 'none'): { title: string; intro: string } {
  switch (screen) {
    case 'intro':
      return { title: `Bring your bar to ${BRAND.productName}`, intro: 'Set up your venue in about ten minutes. Stop at any step and pick it up later from Tonight.' };
    case 'find':
      return { title: 'Find your bar', intro: 'Most bars are already here. Claim yours and keep its awards, drinks and rankings.' };
    case 'claim':
      return { title: 'Last step: prove it’s yours', intro: `${bar} is set up for your team. To put your hours, drinks and look on its public page, we check you work there.` };
    case 'role':
      return { title: 'You’ll be Admin', intro: `Whoever sets up ${bar} runs it. You can add more Admins, or hand it on, from My team.` };
    case 'place':
      return { title: 'Where, when and how to reach you', intro: 'It shows on your bar page, in Discover and on the map.' };
    case 'look':
      return { title: `Make it look like ${bar}`, intro: 'Your logo, colour and type on every phone and screen at the bar. Change any of it later in Brand.' };
    case 'visibility':
      return { title: 'Who sees your page', intro: `For people outside ${bar}. Your team always sees everything.` };
    case 'bring':
      return {
        title: 'Bring in your spec book and menu',
        intro: 'Give us your spec book, tonight’s menu or a photo of the back bar. We read it while you finish, and set up your drinks, menus and bottles.',
      };
    case 'team':
      return { title: 'Invite your team', intro: `Each person gets an email from ${bar} and lands in the app with your menus and specs already there.` };
    case 'done':
      return {
        title: `${bar} is set up`,
        intro:
          claim === 'none'
            ? 'Your team can use everything now. When you’re ready, prove it’s yours from Tonight’s banner or Venue settings.'
            : 'Here’s what’s done and what’s still on its way. Tonight shows a small banner until it’s all in.',
      };
  }
}

/** The intro's four reasons (canvas make-venue-start). */
export const VALUE_ROWS = [
  { icon: 'doc.on.clipboard', title: 'Specs your team can follow', line: 'Every drink with its spec, prep, glass and garnish, on every phone behind the bar.' },
  { icon: 'list.bullet', title: 'Menus', line: 'Tonight’s menu and every past one, shared as a link that always shows what’s on.' },
  { icon: 'star', title: 'Rankings people trust', line: 'Guests rank what they had against everything else they’ve had. Real people, not stars.' },
  { icon: 'person', title: 'Credit for who made each drink', line: 'Each drink names the bartender who made it, and it follows them when they move.' },
] as const;
