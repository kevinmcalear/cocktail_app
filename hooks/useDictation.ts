import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type Native = ExpoSpeechRecognitionModuleType & {
  addListener: (event: string, listener: (e: { results?: { transcript: string }[]; isFinal?: boolean }) => void) => { remove: () => void };
};

// Builds from before expo-speech-recognition have no native module: no mic there (an update can reach them).
const native = Platform.OS === 'web' ? null : requireOptionalNativeModule<Native>('ExpoSpeechRecognition');

interface WebRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
const WebSpeech: (new () => WebRecognition) | null =
  Platform.OS === 'web' && typeof window !== 'undefined' ? ((window as unknown as Record<string, new () => WebRecognition>).SpeechRecognition ?? (window as unknown as Record<string, new () => WebRecognition>).webkitSpeechRecognition ?? null) : null;

/** Whether this device can turn speech into text here: the native module in the build, or the browser's own. */
export const canDictate = !!native || !!WebSpeech;

/**
 * Say it (Add's mic, Android's Say it): speech to text, on the device where
 * it can (expo-speech-recognition; the browser's SpeechRecognition on the
 * web). `onText` gets the words so far as they're heard, then the final ones.
 */
export function useDictation(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const web = useRef<WebRecognition | null>(null);
  // The latest onText, for listeners set up once.
  const said = useRef(onText);
  useEffect(() => {
    said.current = onText;
  });
  const heard = (text: string, final: boolean) => said.current(text, final);

  useEffect(() => {
    if (!native) return;
    const subs = [
      native.addListener('result', (e) => {
        const text = e.results?.[0]?.transcript;
        if (text) heard(text, !!e.isFinal);
      }),
      native.addListener('end', () => setListening(false)),
      native.addListener('error', () => {
        setListening(false);
        setError('Couldn’t hear that. Try again, or type it.');
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      native.abort();
    };
  }, []);
  useEffect(() => () => web.current?.stop(), []);

  const start = async () => {
    setError(null);
    if (native) {
      const allowed = await native.requestPermissionsAsync();
      if (!allowed.granted) return setError('Turn on the microphone and speech recognition for Cocktail in Settings.');
      native.start({ lang: 'en-US', interimResults: true, continuous: false });
      setListening(true);
    } else if (WebSpeech) {
      const r = new WebSpeech();
      r.lang = 'en-US';
      r.interimResults = true;
      r.continuous = false;
      r.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        heard(Array.from(e.results, (x) => x[0].transcript).join(''), !!last?.isFinal);
      };
      r.onend = () => setListening(false);
      r.onerror = () => {
        setListening(false);
        setError('Couldn’t hear that. Try again, or type it.');
      };
      web.current = r;
      r.start();
      setListening(true);
    }
  };
  const stop = () => {
    if (native) native.stop();
    web.current?.stop();
    setListening(false);
  };
  return { available: canDictate, listening, error, start, stop };
}
