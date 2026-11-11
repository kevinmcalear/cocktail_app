// The technique library's data: every technique and the equipment they call
// for (~150 KB). It is its own lazy chunk on the web, loaded by
// loadTechniques() in lib/techniques/index.ts, so no page's first load carries
// it. Import it only from there (and from lib/techniques/testing.ts): a static
// import anywhere else copies it into that route's chunk.
import { AGE, KITCHEN } from './data/age';
import { CLARIFY, WASH } from './data/clarify';
import { COOK } from './data/cook';
import { FERMENT } from './data/ferment';
import { FOAM } from './data/foam';
import { GARNISH } from './data/garnish';
import { INFUSE } from './data/infuse';
import { LAB } from './data/lab';
import { CARBONATE, COLD, DISTIL, PRESERVE } from './data/more';
import { SHAKE } from './data/shake';
import { SYRUP } from './data/syrup';
import { TEXTURE } from './data/texture';
import type { Technique } from './types';

export { EQUIPMENT } from './equipment';

export const TECHNIQUES: Technique[] = [
  ...SHAKE, ...FOAM, ...CLARIFY, ...WASH, ...INFUSE, ...SYRUP, ...TEXTURE, ...CARBONATE, ...COLD, ...PRESERVE, ...DISTIL,
  ...LAB, ...FERMENT, ...COOK, ...GARNISH, ...AGE, ...KITCHEN,
];
