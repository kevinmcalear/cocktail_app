import { CollectionDrinks } from '@/components/screens/home/CollectionDrinks';
import { YouPage } from '@/components/screens/profile/YouPage';

/** Saved drinks, from You's Kept: what you had out, what's to make and what you've made. */
export default function SavedDrinks() {
  return (
    <YouPage title="Saved drinks" wide>
      <CollectionDrinks />
    </YouPage>
  );
}
