import { useIsFocused, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useDs } from '@/components/ds';

/**
 * The New item in the tab bar. Pressing it opens the New
 * sheet over the tab you're on and never shows this screen; native tabs need
 * a route behind every item. A link straight here goes home.
 */
export default function NewTab() {
  const ds = useDs();
  const router = useRouter();
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) router.replace('/');
  }, [focused, router]);
  return <View style={{ flex: 1, backgroundColor: ds.c.ground }} />;
}
