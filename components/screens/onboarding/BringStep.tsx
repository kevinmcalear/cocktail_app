import * as Device from 'expo-device';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { pickReadFiles, type ReadFile } from '@/lib/readAnything';
import { takeMenuPhoto } from '@/lib/readMenu';

interface BringStepProps {
  /** Photos or PDFs to read once setup is done; empty to open Bring in to paste. */
  onBring: (files: ReadFile[]) => void;
  onSkip: () => void;
  pending: boolean;
  error?: string;
}

/**
 * The last step: hand over a spec book, a menu or a shelf now, and Bring in
 * reads it as soon as setup is done. Or not now; it's always on the + button.
 */
export function BringStep({ onBring, onSkip, pending, error }: BringStepProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const web = Platform.OS === 'web';
  // The simulator has no camera, and launching it there crashes the app.
  const camera = !web && Device.isDevice;
  const from = async (get: () => Promise<ReadFile[]>) => {
    setProblem(null);
    try {
      const files = await get();
      if (files.length) onBring(files);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };
  return (
    <View style={styles.stack}>
      {camera ? <Button label="Snap it" icon="camera.fill" onPress={() => void from(takeMenuPhoto)} disabled={pending} /> : null}
      <Button label={web ? 'Photos or a PDF' : 'Photos'} icon="photo" variant={camera ? 'secondary' : 'primary'} onPress={() => void from(pickReadFiles)} disabled={pending} />
      <Button label="Paste or type it" icon="doc.on.doc" variant="secondary" onPress={() => onBring([])} disabled={pending} />
      {problem || error ? <Caption tone="accent">{problem ?? error}</Caption> : null}
      <Button label={pending ? 'Saving…' : 'Not now'} variant="ghost" onPress={onSkip} disabled={pending} />
      <Caption tone="muted">You can always bring things in later from the + button.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
});
