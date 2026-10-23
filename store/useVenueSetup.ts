import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ClaimSetup } from '@/hooks/useProfiles';
import type { VenueStep } from '@/lib/venueSetup';

/**
 * Page details typed before there's a claim (hours, phone, website, Instagram,
 * who sees the page). They go onto the claim when it's sent, and onto the page
 * once it's checked.
 */
export type HeldSetup = ClaimSetup;

/** One venue's setup on this device: what's done, so Tonight can pick it up. */
export interface SetupRun {
  /** The bar page being claimed or set up. */
  profileId: string | null;
  /** The venue made for it (create_new_bar), once there is one. */
  barId: string | null;
  name: string;
  done: VenueStep[];
  /** Saw the summary and opened Tonight. Tonight stops showing the banner. */
  finished: boolean;
  /** Typed before the claim, waiting for it (cleared once it's sent). */
  held?: HeldSetup;
}

interface VenueSetupState {
  /** Keyed by the venue once there is one, else 'new' while finding the bar. */
  runs: Record<string, SetupRun>;
  save: (key: string, run: Partial<SetupRun>) => void;
  markDone: (key: string, step: VenueStep) => void;
  /** Keeps page details on the run until the claim is sent; null clears them. */
  hold: (key: string, change: HeldSetup | null) => void;
  /** Moves the 'new' run under its venue once it's made. */
  rekey: (from: string, to: string) => void;
}

const BLANK: SetupRun = { profileId: null, barId: null, name: '', done: [], finished: false };

/**
 * Venue setup progress, per device. ponytail: kept on the device, not in the
 * database; setup started on a phone and picked up on a laptop starts at the
 * first step there (everything it saved is still saved). A setup_progress
 * column on bars is the upgrade if people switch devices mid-setup.
 */
export const useVenueSetup = create<VenueSetupState>()(
  persist(
    (set) => ({
      runs: {},
      save: (key, run) => set((s) => ({ runs: { ...s.runs, [key]: { ...BLANK, ...s.runs[key], ...run } } })),
      markDone: (key, step) =>
        set((s) => {
          const run = { ...BLANK, ...s.runs[key] };
          return run.done.includes(step) ? s : { runs: { ...s.runs, [key]: { ...run, done: [...run.done, step] } } };
        }),
      hold: (key, change) =>
        set((s) => {
          const run = { ...BLANK, ...s.runs[key] };
          return { runs: { ...s.runs, [key]: { ...run, held: change ? { ...run.held, ...change } : undefined } } };
        }),
      rekey: (from, to) =>
        set((s) => {
          const { [from]: run, ...rest } = s.runs;
          return run ? { runs: { ...rest, [to]: { ...run, ...rest[to], done: [...new Set([...(rest[to]?.done ?? []), ...run.done])] } } } : s;
        }),
    }),
    { name: 'venue-setup', storage: createJSONStorage(() => AsyncStorage) }
  )
);
