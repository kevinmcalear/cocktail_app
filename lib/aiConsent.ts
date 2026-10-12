import { create } from 'zustand';

import { BRAND } from '@/constants/brand';
import { confirmAsync } from '@/lib/dialogs';
import { deviceStore } from '@/lib/deviceStore';

export const AI_CONSENT_KEY = 'ai_consent_v1';

/** The "Read it with AI?" sheet's open question, answered by components/screens/bringin/AiConsentSheet. */
export const useAiConsentAsk = create<{ ask: ((agreed: boolean) => void) | null; hosts: number }>(() => ({ ask: null, hosts: 0 }));

/** Whether the person has said yes to Google AI on this device. */
export async function hasAiConsent(): Promise<boolean> {
  return (await deviceStore.getItem(AI_CONSENT_KEY)) === 'granted';
}

/** Settings' switch: yes, or take it back (the next AI feature asks again). */
export async function setAiConsent(on: boolean): Promise<void> {
  if (on) await deviceStore.setItem(AI_CONSENT_KEY, 'granted');
  else await deviceStore.removeItem(AI_CONSENT_KEY);
}

/**
 * Asks once, before an AI feature first sends anything to Google's Gemini API
 * (App Store guideline 5.1.2(i): disclose and get permission before sharing
 * data with a third-party AI). Resolves true if the person has agreed, now or
 * before. The question is its own sheet ("Read it with AI?"); where none is
 * mounted (tests), a plain dialog. Cleared on sign-out, and from Settings.
 */
export async function ensureAiConsent(): Promise<boolean> {
  if (await hasAiConsent()) return true;
  const { hosts, ask } = useAiConsentAsk.getState();
  // A second ask while one is open waits on the same answer.
  const agreed = hosts
    ? await new Promise<boolean>((resolve) => {
        useAiConsentAsk.setState({
          ask: (yes) => {
            ask?.(yes);
            resolve(yes);
          },
        });
      })
    : await confirmAsync({
        title: 'Use Google AI?',
        message: `${BRAND.productName} sends what you ask it to read (a photo, a file or text), or a drink's name and ingredients, to Google's Gemini AI to create the result. Nothing else is shared. More in the privacy policy.`,
        confirmText: 'Continue',
      });
  if (agreed) await setAiConsent(true);
  return agreed;
}
