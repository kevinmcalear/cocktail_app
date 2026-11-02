import { AddBeerWineRoute, type AddDrinkProps } from '@/components/screens/drink/KindRoutesLazy';

export default function AddWineScreen(props: AddDrinkProps = {}) {
  return <AddBeerWineRoute kind="wine" {...props} />;
}
