import { draftHref } from '@/lib/draftList';
import { itemHref } from '@/lib/itemRoutes';
import type { SearchItem } from '@/types/search';

const DRAFT_TYPE: Partial<Record<NonNullable<SearchItem['category']>, string>> = {
  Menu: 'menu',
  Beer: 'beer',
  Wine: 'wine',
  Ingredient: 'ingredient',
};

/** Open a search result: a draft in its editor (or Drafts, when no editor opens it), a menu in the menu editor, anything else on its page. */
export function openSearchItem(item: SearchItem, push: (href: string) => void) {
  if (item.isDraft) {
    const draftId = item.id.replace(/^(beer|wine|menu)-/, '');
    const entityType = (item.category && DRAFT_TYPE[item.category]) || 'cocktail';
    push(draftHref({ id: draftId, entity_type: entityType }) ?? '/drafts');
    return;
  }
  if (item.category === 'Menu') {
    push(`/menus/${encodeURIComponent(item.id.replace('menu-', ''))}`);
    return;
  }
  push(itemHref(item.category === 'Category' ? undefined : item.category, item.id));
}
