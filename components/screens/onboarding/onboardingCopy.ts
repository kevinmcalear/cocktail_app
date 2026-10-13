import type { OnboardingStep } from '@/lib/onboarding';

/** Each setup step's title and the line under it. */
export const COPY: Record<OnboardingStep, { title: string; intro?: string }> = {
  invite: { title: 'You’re invited' },
  name: { title: 'Your name', intro: 'How you show up on your profile and on drinks.' },
  hospitality: { title: 'Do you work in hospitality?' },
  find: {
    title: 'Do we already have you?',
    intro: 'If this is your profile, claim it. If not, you’ll add where you’ve worked, the menus, and the cocktails.',
  },
  work: { title: 'Where do you work?', intro: 'Pick a bar, even one that has closed.' },
  past: { title: 'Where you’ve worked', intro: 'Your profile shows where you work now. Past jobs stay hidden unless you choose to show them.' },
  menus: { title: 'Menus you worked on', intro: 'Name the list and the bar. A closed bar is fine.' },
  drinks: {
    title: 'Cocktails you worked on',
    intro: 'A drink you made or helped make. It shows as a suggested credit. A closed bar can still be where it started.',
  },
  taste: {
    title: 'What do you like to drink?',
    intro: 'A few quick answers start your palate. Every drink you rank shapes it from there.',
  },
  units: { title: 'How do you measure?', intro: 'New specs, and the amounts you read. You can change this in Settings.' },
  bring: {
    title: 'Bring your bar in',
    intro: 'Got a spec book, a menu or a back bar? Give it to us and we’ll set up your drinks, menus and bottles while you finish here.',
  },
};

export const HOME_BRING = {
  title: 'What’s on your shelf?',
  intro: 'Snap your bottles, or bring in recipes you’ve saved elsewhere. We’ll read them in as soon as you’re set up, and you check them before they’re saved.',
};
