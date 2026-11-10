// Loads the technique library synchronously, for check scripts and Jest
// (jest.setup.tsx): import it before anything that reads the library.
import { installTechniques } from './index';
import * as library from './library';

installTechniques(library);
