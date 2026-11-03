import { PrepScreen } from '@/components/screens/PrepScreen';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** Prep, at a venue: the prep list and orders, opened on the tab you're in (Tonight folds it in next). */
export default function PrepRoute() {
  return (
    <FeatureGate feature="prep">
      <PrepScreen />
    </FeatureGate>
  );
}
