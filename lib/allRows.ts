/** PostgREST's max_rows: a request never returns more, and says nothing when it cuts. */
export const PAGE_ROWS = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Every row of a query, ordered by id, a page at a time: each page starts
 * after the last id (keyset), so the last page costs what the first does
 * (an offset page redoes every row before it). `page` gets the last id seen
 * (null first) and the page size, and adds `.gt('id', after)` when there is
 * one, `.order('id')` and `.limit(size)`. Sort by anything else on the device.
 */
export async function allRowsById<T extends { id: string }>(page: (after: string | null, size: number) => Page<T>): Promise<T[]> {
    const rows: T[] = [];
    for (;;) {
        const { data, error } = await page(rows.length ? rows[rows.length - 1].id : null, PAGE_ROWS);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data ?? []).length < PAGE_ROWS) return rows;
    }
}

/**
 * Every row of a query, a page at a time by offset. The query needs a stable
 * order (end it on a unique column) or rows can repeat or go missing between
 * pages. Prefer allRowsById for big lists: late offset pages get slow.
 */
export async function allRows<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE_ROWS) {
        const { data, error } = await page(from, from + PAGE_ROWS - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data ?? []).length < PAGE_ROWS) return rows;
    }
}
