import { AddDrinkScreen, type AddDrinkProps } from '@/components/drink/AddDrinkScreen';

export default function AddWineScreen(props: AddDrinkProps = {}) {
  return <AddDrinkScreen kind="wine" {...props} />;
}
