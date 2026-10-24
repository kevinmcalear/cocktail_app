import { useStudyPile } from '@/hooks/useStudyPile';
import { usePublishedDrink } from '@/hooks/usePublished';
import { visitorDrink } from '@/lib/visitorDrink';

import { CouldNotLoad, NotAvailable } from '../safety/NotAvailable';
import { DrinkLoading } from './DrinkLoading';
import { DrinkScreen } from './DrinkScreen';

/**
 * Another bar's drink for someone signed in (p02): the in-app drink page,
 * not the website's /d page, read from what the bar published. A drink it
 * hasn't published (or has hidden) is Not available, as /d says.
 */
export function VisitorDrink({ id }: { id: string }) {
  const query = usePublishedDrink(id);
  const { toggleStudyPile, isInStudyPile } = useStudyPile();
  if (query.isPending) return <DrinkLoading seed={null} />;
  if (query.error) return <CouldNotLoad what="drink" failed={{ retry: () => void query.refetch() }} />;
  if (!query.data) return <NotAvailable what="drink" />;
  const { item, lock } = visitorDrink(query.data);
  return (
    <DrinkScreen
      item={item}
      visitorLock={lock}
      inStudyPile={isInStudyPile(item.id)}
      onToggleStudyPile={() => toggleStudyPile(item.id)}
      canEdit={false}
      onEdit={() => {}}
      sheet
    />
  );
}
