import type { OnboardingStep } from '@/lib/onboarding';

/** Each setup step's title and the line under it. */
export const COPY: Record<OnboardingStep, { title: string; intro?: string }> = {
  invite: { title: 'You’re invited' },
  name: { title: 'Your full name', intro: 'First and last, so people can find you and credit your drinks. It shows on your profile and on drinks.' },
  you: { title: 'Is this you?' },
  hospitality: { title: 'What brings you here?', intro: 'So we start you in the right place. You can do the rest later.' },
  bar: { title: 'Find your bar', intro: 'Its name, or the street it’s on.' },
  addbar: { title: 'Add your bar', intro: 'Its name and address, once. Then set it up.' },
  find: {
    title: 'Find your bar or your name',
    intro: 'Most bars and bartenders are already here, with their menus and who made each drink.',
  },
  work: { title: 'Where do you work?', intro: 'Pick a bar, even one that has closed.' },
  past: { title: 'Where you’ve worked', intro: 'Your profile shows where you work now. Past jobs stay hidden unless you choose to show them.' },
  menus: { title: 'Menus you worked on', intro: 'Name the list and the bar. A closed bar is fine.' },
  drinks: {
    title: 'Cocktails you worked on',
    intro: 'A drink you made or helped make. It shows as a suggested credit. A closed bar can still be where it started.',
  },
  // The first of first run's three taste steps (FirstRunPicks); the pairs and Your taste carry their own words.
  taste: { title: 'Which have you had?', intro: 'Pick five you know. We learn your taste from them, nothing else to fill in.' },
  units: { title: 'How do you measure?', intro: 'New specs, and the amounts you read. You can change this in Settings.' },
};
