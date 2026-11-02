import { useRouter } from 'expo-router';

import { useGuestDrinkAllergens } from '@/hooks/useGuestAllergies';
import { fromGuest } from '@/lib/allergenWords';

import { AllergenList, AllergensFailed } from './AllergenList';

/**
 * A bar drink's Allergens for anyone not on its team, signed out too
 * (guest-allergen-read): every allergen and the unchecked count, whether or
 * not they've set allergies of their own. The public drink page carries this
 * one, so it stays apart from the team's check sheet.
 */
export function GuestAllergens({ itemId, barName }: { itemId: string; barName: string | null }) {
  const router = useRouter();
  const { data, isError } = useGuestDrinkAllergens([itemId]);
  if (isError) return <AllergensFailed />;
  const row = data?.get(itemId);
  // Still loading, or nothing to declare (no spec): no section rather than one about nothing.
  if (!row || (row.lines === 0 && !row.allergens.length)) return null;
  return <AllergenList read={fromGuest(row)} barName={barName} onMine={() => router.push('/settings/allergies')} />;
}
