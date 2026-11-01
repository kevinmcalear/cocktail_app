import { lazy } from 'react';

// Loaded when Add opens, as one chunk: reading photos and links stays out of every page's first load (budget B13).
const layer = () => import('./addLayersAll');
export const AddSheet = lazy(() => layer().then((m) => ({ default: m.AddSheet })));
export const AddFabMenu = lazy(() => layer().then((m) => ({ default: m.AddFabMenu })));
export const CreateSheet = lazy(() => layer().then((m) => ({ default: m.CreateSheet })));
