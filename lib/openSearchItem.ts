import { itemHref } from '@/lib/itemRoutes';
import { openDraftInCreator } from '@/store/useCreatorNavStore';
import type { SearchItem } from '@/types/search';

const DRAFT_TYPE: Partial<Record<NonNullable<SearchItem['category']>, string>> = {
  Menu: 'menu',
  Beer: 'beer',
  Wine: 'wine',
  Ingredient: 'ingredient',
};

/** Open a search result: a draft in its creator, a menu in the menu editor, anything else on its page. */
export function openSearchItem(item: SearchItem, push: (href: string) => void) {
  if (item.isDraft) {
    const draftId = item.id.replace(/^(beer|wine|menu)-/, '');
    const entityType = (item.category && DRAFT_TYPE[item.category]) || 'cocktail';
    openDraftInCreator({ id: draftId, entity_type: entityType, draft_data: { name: item.name } }, push);
    return;
  }
  if (item.category === 'Menu') {
    push(`/menus/${encodeURIComponent(item.id.replace('menu-', ''))}`);
    return;
  }
  push(itemHref(item.category === 'Category' ? undefined : item.category, item.id));
}
