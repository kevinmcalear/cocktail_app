import { RankCameraButton } from './RankFindParts';
import { useSnapMenu } from './useSnapMenu';

/**
 * The camera in home's "What did you have?" field. Its own chunk: the
 * menu-from-a-photo code stays off Tonight's first load, and it has to be
 * loaded before the tap (the web's file input opens only straight from one).
 */
export function RankCamera() {
  const snap = useSnapMenu();
  return snap ? <RankCameraButton onPress={snap} /> : null;
}
