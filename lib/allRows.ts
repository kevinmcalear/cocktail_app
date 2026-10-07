/** PostgREST's max_rows: a request never returns more, and says nothing when it cuts. */
export const PAGE_ROWS = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Every row of a query, a page at a time. The query needs a stable order
 * (end it on a unique column) or rows can repeat or go missing between pages.
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
