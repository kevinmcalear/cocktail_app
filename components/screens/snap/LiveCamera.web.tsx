import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';

import type { CameraState, LiveCameraHandle } from './cameraTypes';

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/** Whether the browser can show a live viewfinder (getUserMedia, which needs https). Without it Snap opens the file chooser. */
export function hasLiveCamera(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * The back camera, live, filling its parent (getUserMedia). The browser asks
 * for the camera when it mounts; `onState` hears whether it's live or off.
 */
export function LiveCamera({ ref, torch, onState }: { ref: Ref<LiveCameraHandle>; torch: boolean; onState: (state: CameraState, canTorch: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const told = useRef(onState);
  useEffect(() => {
    told.current = onState;
  });

  useEffect(() => {
    let live = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (!live) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
        const track = s.getVideoTracks()[0];
        told.current('live', !!(track?.getCapabilities?.() as TorchCapabilities | undefined)?.torch);
      })
      .catch((e: unknown) => {
        if (!live) return;
        const name = e instanceof Error ? e.name : '';
        told.current(name === 'NotAllowedError' || name === 'SecurityError' ? 'off' : 'failed', false);
      });
    return () => {
      live = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || !(track.getCapabilities?.() as TorchCapabilities).torch) return;
    void track.applyConstraints({ advanced: [{ torch } as MediaTrackConstraintSet] }).catch(() => {});
  }, [torch]);

  useImperativeHandle(ref, () => ({
    snap: async () => {
      const v = video.current;
      if (!v?.videoWidth) return null;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d')?.drawImage(v, 0, 0);
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.8));
      return blob ? { uri: URL.createObjectURL(blob), mimeType: 'image/jpeg', name: 'snap.jpg' } : null;
    },
  }));

  return <video ref={video} autoPlay playsInline muted aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
}
