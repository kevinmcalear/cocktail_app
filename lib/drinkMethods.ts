// A drink can have several methods (stirred, then a freezer pour). Methods
// are shared rows, so adding one that exists picks the existing one.

/** A cocktail draft's methods. Drafts saved before this kept one, as methodId. */
export function draftMethodIds(data: { methodIds?: unknown; methodId?: unknown } | null | undefined): string[] {
    if (Array.isArray(data?.methodIds)) return data.methodIds.filter((id): id is string => typeof id === 'string' && !!id);
    return typeof data?.methodId === 'string' && data.methodId ? [data.methodId] : [];
}

/** A drink's item_methods rows as ids, in their saved order. */
export function orderedMethodIds(rows: { method_item_id: string; sort_order?: number | null }[] | null | undefined): string[] {
    return [...(rows ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((r) => r.method_item_id);
}

/** Adds the id at the end, or takes it out if it's there. */
export function toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** An option with the same name, ignoring case and spacing. */
export function findByName<T extends { name: string | null }>(options: T[], name: string): T | undefined {
    return options.find((o) => o.name != null && key(o.name) === key(name));
}
