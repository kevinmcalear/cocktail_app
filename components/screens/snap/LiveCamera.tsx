import type { CameraView } from 'expo-camera';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { optionalNative } from '@/lib/optionalNative';

import type { CameraState, LiveCameraHandle } from './cameraTypes';

type CameraModule = typeof import('expo-camera');
// Builds from 2.1 on have it. 2.0.0 (reached by update) has no module, and Snap opens the system camera there.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where the native module exists
const cam = Platform.OS === 'web' ? null : optionalNative<CameraModule>('ExpoCamera', () => require('expo-camera'));

/** Whether this build can show a live viewfinder (it has expo-camera's native module). */
export function hasLiveCamera(): boolean {
  return !!cam;
}

/**
 * The back camera, live, filling its parent (expo-camera). Asks for the
 * camera when it mounts; `onState` hears whether it's live or off.
 */
export function LiveCamera({ ref, torch, onState }: { ref: Ref<LiveCameraHandle>; torch: boolean; onState: (state: CameraState, canTorch: boolean) => void }) {
  const view = useRef<CameraView>(null);
  const [allowed, setAllowed] = useState(false);
  const told = useRef(onState);
  useEffect(() => {
    told.current = onState;
  });

  useEffect(() => {
    if (!cam) return;
    let live = true;
    void (async () => {
      try {
        const before = await cam.Camera.getCameraPermissionsAsync();
        const granted = before.granted || (before.canAskAgain && (await cam.Camera.requestCameraPermissionsAsync()).granted);
        if (!live) return;
        if (granted) setAllowed(true);
        else told.current('off', false);
      } catch {
        if (live) told.current('failed', false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    snap: async () => {
      const picture = await view.current?.takePictureAsync({ quality: 0.5 });
      return picture ? { uri: picture.uri, mimeType: 'image/jpeg' } : null;
    },
  }));

  if (!cam || !allowed) return null;
  const { CameraView: View } = cam;
  return <View ref={view} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} animateShutter={false} onCameraReady={() => onState('live', true)} onMountError={() => onState('failed', false)} />;
}
