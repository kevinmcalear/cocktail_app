import { BRAND } from '@/constants/brand';
import { confirmAsync } from '@/lib/dialogs';
import { deviceStore } from '@/lib/deviceStore';

export const AI_CONSENT_KEY = 'ai_consent_v1';

/**
 * Asks once, before an AI feature first sends anything to Google's Gemini API
 * (App Store guideline 5.1.2(i): disclose and get permission before sharing
 * data with a third-party AI). Resolves true if the user has agreed, now or
 * before. Cleared on sign-out.
 */
export async function ensureAiConsent(): Promise<boolean> {
  if ((await deviceStore.getItem(AI_CONSENT_KEY)) === 'granted') return true;
  const agreed = await confirmAsync({
    title: 'Use Google AI?',
    message: `${BRAND.productName} sends the drink's name and ingredients, or your glassware photo, to Google's Gemini AI to create the result. Nothing else is shared. More in the privacy policy.`,
    confirmText: 'Continue',
  });
  if (agreed) await deviceStore.setItem(AI_CONSENT_KEY, 'granted');
  return agreed;
}
