import { AddBeerWineRoute, type AddDrinkProps } from '@/components/screens/addBeerWine/AddBeerWineRoute';

export default function AddWineScreen(props: AddDrinkProps = {}) {
  return <AddBeerWineRoute kind="wine" {...props} />;
}
