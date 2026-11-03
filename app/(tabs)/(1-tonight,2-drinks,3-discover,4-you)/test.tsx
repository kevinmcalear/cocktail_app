import { StudyScreen } from '@/components/screens/StudyScreen';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** Study, opened on the tab you're in (its route is still /test, so old links keep working; Tonight folds it in next). */
export default function StudyRoute() {
  return (
    <FeatureGate feature="study">
      <StudyScreen />
    </FeatureGate>
  );
}
