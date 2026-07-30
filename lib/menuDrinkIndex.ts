import type { SearchItem } from '../components/SearchList';
import { calculateDraftProgress } from './draftProgress';
import { capitalize } from './stringUtils';

/** Build id → drink map for menu tiles/picker. Drafts first so menu draft selections resolve. */
export function buildMenuDrinkIndex(opts: {
    drafts: any[];
    cocktails?: any[] | null;
    beers?: any[] | null;
    wines?: any[] | null;
}): Map<string, SearchItem> {
    const map = new Map<string, SearchItem>();
    for (const d of opts.drafts) {
        const data = d.draft_data || {};
        const img = data.localImages?.[0]?.url ? { uri: data.localImages[0].url } : undefined;
        const draftProgress = calculateDraftProgress(d, opts.drafts);
        if (d.entity_type === 'cocktail') {
            map.set(d.id, {
                id: d.id,
                name: capitalize(data.name || 'Untitled Cocktail'),
                description: data.description,
                category: 'Cocktail',
                isDraft: true,
                draftProgress,
                recipes: data.recipeItems?.map((ri: any) => ({
                    ingredient: { name: capitalize(ri.name || '') },
                })),
                image: img,
                price: data.price,
            });
        } else if (d.entity_type === 'beer') {
            map.set(`beer-${d.id}`, {
                id: `beer-${d.id}`,
                name: capitalize(data.name || 'Untitled Beer'),
                description: data.description,
                category: 'Beer',
                isDraft: true,
                draftProgress,
                image: img,
                price: data.price,
            });
        } else if (d.entity_type === 'wine') {
            map.set(`wine-${d.id}`, {
                id: `wine-${d.id}`,
                name: capitalize(data.name || 'Untitled Wine'),
                description: data.description,
                category: 'Wine',
                isDraft: true,
                draftProgress,
                image: img,
                price: data.price,
            });
        }
    }
    for (const c of opts.cocktails || []) {
        map.set(c.id, {
            id: c.id,
            name: capitalize(c.name),
            description: c.description,
            category: 'Cocktail',
            recipes: c.recipes,
            item_images: c.item_images,
            price: c.price,
        });
    }
    for (const b of opts.beers || []) {
        map.set(`beer-${b.id}`, {
            id: `beer-${b.id}`,
            name: capitalize(b.name),
            description: b.description,
            category: 'Beer',
            price: b.price,
            image: b.item_images?.[0]?.images?.url
                ? { uri: b.item_images[0].images.url }
                : undefined,
        });
    }
    for (const w of opts.wines || []) {
        map.set(`wine-${w.id}`, {
            id: `wine-${w.id}`,
            name: capitalize(w.name),
            description: w.description,
            category: 'Wine',
            price: w.price,
            image: w.item_images?.[0]?.images?.url
                ? { uri: w.item_images[0].images.url }
                : undefined,
        });
    }
    return map;
}
