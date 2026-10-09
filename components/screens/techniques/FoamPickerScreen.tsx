import { Body } from '@/components/ds';
import { FoamPicker } from '@/components/techniques/FoamPicker';
import { TechniquePage } from '@/components/techniques/TechniquePage';

/** Foam from anything, as its own page in the technique library. */
export function FoamPickerScreen() {
  return (
    <TechniquePage eyebrow="Foams and airs" title="Foam from anything" intro={<Body tone="muted">Any flavourful liquid can foam. Answer four questions and pick one foamer.</Body>}>
      <FoamPicker />
    </TechniquePage>
  );
}
