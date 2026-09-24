import { EditDrinkScreen, type EditDrinkProps } from '@/components/drink/EditDrinkScreen';

export default function EditBeerScreen(props: EditDrinkProps = {}) {
  return <EditDrinkScreen kind="beer" {...props} />;
}
