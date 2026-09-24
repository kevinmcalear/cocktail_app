import { EditDrinkScreen, type EditDrinkProps } from '@/components/drink/EditDrinkScreen';

export default function EditWineScreen(props: EditDrinkProps = {}) {
  return <EditDrinkScreen kind="wine" {...props} />;
}
