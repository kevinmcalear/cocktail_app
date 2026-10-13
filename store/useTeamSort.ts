import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { TeamSort } from '@/lib/team';

interface TeamSortState {
  sort: TeamSort;
  setSort: (sort: TeamSort) => void;
}

/** My team's order (by role or A to Z), remembered per device. Starts by role. */
export const useTeamSort = create<TeamSortState>()(
  persist((set) => ({ sort: 'role', setSort: (sort) => set({ sort }) }), {
    name: 'team-sort',
    storage: createJSONStorage(() => AsyncStorage),
  })
);
