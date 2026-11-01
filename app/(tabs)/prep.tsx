import { PrepScreen } from '@/components/screens/PrepScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** Prep, in venue mode: the prep list and orders (Tonight folds it in next). */
export default function Prep() {
  return (
    <MountOnFocus>
      <PrepScreen />
    </MountOnFocus>
  );
}
