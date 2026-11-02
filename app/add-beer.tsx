import { AddBeerWineRoute, type AddDrinkProps } from '@/components/screens/drink/KindRoutesLazy';

export default function AddBeerScreen(props: AddDrinkProps = {}) {
  return <AddBeerWineRoute kind="beer" {...props} />;
}
