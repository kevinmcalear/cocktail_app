import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import type { Venue } from '@/hooks/useActiveVenue';
import { space } from '@/constants/tokens';

import { SetupChecklist } from './SetupChecklist';

/** The end of setup's mark: the venue's logo, over the title (eddie-oct22-wave2, fix 15). */
export function DoneMark({ venue }: { venue: Venue }) {
  return (
    <View style={styles.head} aria-hidden>
      <VenueMark venue={venue} size={52} />
    </View>
  );
}

/**
 * The end of venue setup: "Set up <bar>" (owner-setup step 5), the checklist
 * that then stays on top of the bar until it's done, and Open <bar>.
 */
export function DoneStep({ barId, name, onOpen }: { barId: string; name: string; onOpen: () => void }) {
  const bar = name || 'your bar';
  return <SetupChecklist barId={barId} name={bar} footer={<Button label={`Open ${bar}`} size="lg" variant="secondary" onPress={onOpen} />} />;
}

const styles = StyleSheet.create({
  head: { marginBottom: space.md },
});
