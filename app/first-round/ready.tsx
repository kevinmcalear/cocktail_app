import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { RoundReadyScreen } from '@/components/screens/firstRound/RoundReadyScreen';

/** The end of the first round: ready for your next shift. */
export default function FirstRoundReadyRoute() {
  return (
    <VenueBrandProvider>
      <RoundReadyScreen />
    </VenueBrandProvider>
  );
}
