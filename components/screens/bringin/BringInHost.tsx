import { Platform } from 'react-native';

import { BringInAnywhere } from '@/components/nav/BringInAnywhere';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';

import { AiConsentSheet } from './AiConsentSheet';
import { BringInSheet } from './BringInSheet';
import { ReadingTray } from './ReadingTray';

/** Bring in's always-there parts, in the venue's colours: its sheet, the AI OK, the tray for a reading in the background, and (web) the drop dialog. */
export function BringInHost() {
  return (
    <VenueBrandProvider>
      <BringInSheet />
      <AiConsentSheet />
      <ReadingTray />
      {Platform.OS === 'web' ? <BringInAnywhere /> : null}
    </VenueBrandProvider>
  );
}
