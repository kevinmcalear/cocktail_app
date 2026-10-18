import { AddBeerWineRoute, type AddDrinkProps } from '@/components/screens/addBeerWine/AddBeerWineRoute';

export default function AddBeerScreen(props: AddDrinkProps = {}) {
  return <AddBeerWineRoute kind="beer" {...props} />;
}
