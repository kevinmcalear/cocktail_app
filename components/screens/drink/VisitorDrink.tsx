import { usePublishedDrink } from '@/hooks/usePublished';
import { recentEntry, useTrackRecent } from '@/hooks/useTrackRecent';
import { visitorDrink } from '@/lib/visitorDrink';

import { CouldNotLoad, NotAvailable } from '../safety/NotAvailable';
import { ItemLoading } from './LoadingBar';
import { DrinkScreen } from './DrinkScreen';

/**
 * Another bar's drink for someone signed in (p02): the in-app drink page,
 * not the website's /d page, read from what the bar published. A drink it
 * hasn't published (or has hidden) is Not available, as /d says.
 */
export function VisitorDrink({ id }: { id: string }) {
  const query = usePublishedDrink(id);
  const drink = query.data?.drink;
  useTrackRecent(!!drink, drink ? recentEntry('cocktail', drink.id, drink.name, { imageUrl: drink.imageUrl, barId: drink.barId }) : null);
  if (query.isPending) return <ItemLoading seed={null} />;
  if (query.error) return <CouldNotLoad what="drink" failed={{ retry: () => void query.refetch() }} />;
  if (!query.data) return <NotAvailable what="drink" />;
  const { item, lock } = visitorDrink(query.data);
  return (
    <DrinkScreen
      item={item}
      visitorLock={lock}
      canEdit={false}
      onEdit={() => {}}
    />
  );
}
