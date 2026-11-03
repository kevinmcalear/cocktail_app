import type { ComponentProps } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme } from '@/components/ds';

import { DrinkLoading } from './DrinkLoading';
import { useItemHeader } from './ItemHeader';
import { MaterialBar } from './MaterialBar';
import { PageControls } from './PageControls';

/**
 * Back, and only Back, while an item page loads or can't (Kevin, 3 Nov: Back
 * always shows). A page that never loads (offline, a paused query) still has a
 * way out, in the spot the page's own Back takes: iOS's bar, Android's
 * Material bar, the drawn one on the web.
 */
export function LoadingBar() {
  const top = useSafeAreaInsets().top;
  const { width, height } = useWindowDimensions();
  const scrollY = useSharedValue(0);
  useItemHeader({ name: '', on: Platform.OS === 'ios', pane: false, controls: {} });
  if (Platform.OS === 'ios') return null;
  // `hero`: the whole window, so the bar stays clear over the empty page.
  if (Platform.OS === 'android') return <MaterialBar name="" top={top} photo={false} hero={height} width={width} scrollY={scrollY} controls={{}} drawing={null} />;
  return <PageControls top={top} scrollY={scrollY} tuck={Number.MAX_SAFE_INTEGER} title="" />;
}

/**
 * A drink, beer or wine page while it loads: DrinkLoading and Back. Beside
 * Drinks' list it's DrinkLoading alone, which keeps this bar's Reanimated off
 * the web's first load (check-web-chunks).
 */
export function ItemLoading(props: ComponentProps<typeof DrinkLoading>) {
  return (
    <>
      <DrinkLoading {...props} />
      <BackbarTheme>
        <LoadingBar />
      </BackbarTheme>
    </>
  );
}
