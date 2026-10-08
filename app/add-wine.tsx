import type { AddDrinkProps } from '@/components/drink/AddDrinkScreen';
import { AddBeerWineRoute } from '@/components/screens/addBeerWine/AddBeerWineRoute';

export default function AddWineScreen(props: AddDrinkProps = {}) {
  return <AddBeerWineRoute kind="wine" {...props} />;
}
