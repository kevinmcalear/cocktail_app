import { AddDrinkScreen, type AddDrinkProps } from '@/components/drink/AddDrinkScreen';

export default function AddBeerScreen(props: AddDrinkProps = {}) {
  return <AddDrinkScreen kind="beer" {...props} />;
}
