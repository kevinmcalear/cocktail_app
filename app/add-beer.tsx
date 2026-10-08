import type { AddDrinkProps } from '@/components/drink/AddDrinkScreen';
import { AddBeerWineRoute } from '@/components/screens/addBeerWine/AddBeerWineRoute';

export default function AddBeerScreen(props: AddDrinkProps = {}) {
  return <AddBeerWineRoute kind="beer" {...props} />;
}
