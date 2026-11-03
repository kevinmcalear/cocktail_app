import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// ponytail: no mic on the web for now. vercel.json sends `Permissions-Policy: microphone=()`, which
// blocks it, and that file is gated. Set this to true when the vercel.json PR lands.
const WEB_MIC: boolean = false;

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
  WEB_MIC && Platform.OS === 'web' && typeof window !== 'undefined' ? ((window as unknown as Record<string, new () => WebRecognition>).SpeechRecognition ?? (window as unknown as Record<string, new () => WebRecognition>).webkitSpeechRecognition ?? null) : null;

const NOT_HEARD = 'Couldn’t hear that. Try again, or type it.';

/**
 * Whether this device can turn speech into text now: the native module is in
 * the build and has a speech service to talk to, or the browser has its own.
 * Asks the device, so it's for when Add opens, not for every render.
 */
export function canDictate(): boolean {
  if (WebSpeech) return true;
  try {
    return !!native?.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/**
 * Say it (Add's mic, Android's Say it): speech to text, on the device where
 * it can (expo-speech-recognition; the browser's SpeechRecognition on the
 * web). `onText` gets the words so far as they're heard, then the final ones.
 */
export function useDictation(onText: (text: string, final: boolean) => void) {
  const [available] = useState(canDictate);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const web = useRef<WebRecognition | null>(null);
  // Gone while the permission prompt was up: don't start listening with nothing to show it.
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);
  // The latest onText, for listeners set up once.
  const said = useRef(onText);
  useEffect(() => {
    said.current = onText;
  });
  const heard = (text: string, final: boolean) => said.current(text, final);

  // The one native recogniser is shared: its events reach every mounted hook, so each takes only its own
  // (Add's sheet closing aborts, which would otherwise show an error on the viewfinder opening under it).
  const mine = useRef(false);
  useEffect(() => {
    if (!native) return;
    const subs = [
      native.addListener('result', (e) => {
        const text = e.results?.[0]?.transcript;
        if (mine.current && text) heard(text, !!e.isFinal);
      }),
      native.addListener('end', () => {
        if (!mine.current) return;
        mine.current = false;
        setListening(false);
      }),
      native.addListener('error', () => {
        if (!mine.current) return;
        mine.current = false;
        setListening(false);
        setError(NOT_HEARD);
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      if (mine.current) native.abort();
    };
  }, []);
  useEffect(() => () => web.current?.stop(), []);

  const start = async () => {
    setError(null);
    if (native) {
      try {
        const allowed = await native.requestPermissionsAsync();
        if (gone.current) return;
        if (!allowed.granted) return setError('Turn on the microphone and speech recognition in Settings.');
        mine.current = true;
        native.start({ lang: 'en-US', interimResults: true, continuous: false });
        setListening(true);
      } catch {
        setError(NOT_HEARD);
      }
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
        setError(NOT_HEARD);
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
  return { available, listening, error, start, stop };
}
