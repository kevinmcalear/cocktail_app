import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { PosterScreen } from '@/components/screens/poster/PosterScreen';
import { WebHead } from '@/components/WebHead';

/**
 * Share as a picture: `?menu=<menu id>` for a menu's poster, `?list=<drink id>`
 * for your top three of that drink. Its own route, so the web loads the
 * renderer only when someone shares.
 */
export default function PosterRoute() {
  const { menu, list } = useLocalSearchParams<{ menu?: string; list?: string }>();
  if (!menu && !list) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Share' }} />
      <WebHead>
        <title>Share</title>
      </WebHead>
      {menu ? <PosterScreen menuId={menu} /> : <PosterScreen listId={list!} />}
    </>
  );
}
