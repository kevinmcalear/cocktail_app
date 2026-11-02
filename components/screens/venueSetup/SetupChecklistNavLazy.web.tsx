import { lazy, Suspense } from 'react';

const Card = lazy(() => import('./SetupChecklistNav').then((m) => ({ default: m.ChecklistCard })));
const Row = lazy(() => import('./SetupChecklistNav').then((m) => ({ default: m.SetupNavRow })));

/*
 * On the web, the checklist (and the hooks it reads: the claim, page, brand,
 * publishing, calendars) loads only for a venue with a setup run, not with
 * Library and the sidebar on every page. Until it has, nothing shows, as
 * while its data loads.
 */

export function ChecklistCard(props: { barId: string }) {
  return (
    <Suspense fallback={null}>
      <Card {...props} />
    </Suspense>
  );
}

export function SetupNavRow(props: { barId: string; name: string }) {
  return (
    <Suspense fallback={null}>
      <Row {...props} />
    </Suspense>
  );
}
