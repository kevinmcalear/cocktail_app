import { useLocalSearchParams } from 'expo-router';

import { ReleaseScreen } from '@/components/screens/published/ReleaseScreen';

/** A bar's live release: /r/<id>. Opens signed out. */
export default function ReleaseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReleaseScreen id={id} />;
}
