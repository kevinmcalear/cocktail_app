import { Stack, useLocalSearchParams } from 'expo-router';

import { RunLinkScreen } from '@/components/screens/takeover/RunLinkScreen';
import { WebHead } from '@/components/WebHead';

/** A party's run sheet behind its secret link: /run/<token>. Opens signed out (run_sheet_link). */
export default function RunLinkRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Your run sheet' }} />
      <WebHead>
        <title>Your run sheet</title>
        <meta name="robots" content="noindex" />
      </WebHead>
      <RunLinkScreen token={token} />
    </>
  );
}
