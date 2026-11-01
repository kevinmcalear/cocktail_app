import { StudyScreen } from '@/components/screens/StudyScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** Study (its route is still /test, so old links keep working). */
export default function StudyTab() {
  return (
    <MountOnFocus>
      <StudyScreen />
    </MountOnFocus>
  );
}
