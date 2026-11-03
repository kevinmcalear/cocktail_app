import { createContext, useContext } from 'react';

import type { DrawingGlass } from '@/lib/sketch/barGlass';

/** The glassware of the bar a screen shows (DrawingBar), or null: drinks drawn as stored. */
export const DrawingGlassesContext = createContext<readonly DrawingGlass[] | null>(null);

/** The glasses drawings here are drawn in (lib/sketch/barGlass.ts inBarGlass). Safe without a query client. */
export const useDrawingGlasses = () => useContext(DrawingGlassesContext);
