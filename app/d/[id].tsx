import { useLocalSearchParams } from 'expo-router';

import { PublishedDrinkScreen } from '@/components/screens/published/PublishedDrinkScreen';

/** A published drink's public page: /d/<id>, from a release with ?release=<id>. Opens signed out. */
export default function PublishedDrinkRoute() {
  const { id, release } = useLocalSearchParams<{ id: string; release?: string }>();
  return <PublishedDrinkScreen id={id} releaseId={release ?? null} />;
}
