import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { StaffRoundScreen } from '@/components/screens/firstRound/StaffRoundScreen';

/** Your first round: a new bartender's three things before their first shift. */
export default function FirstRoundRoute() {
  return (
    <VenueBrandProvider>
      <StaffRoundScreen />
    </VenueBrandProvider>
  );
}
