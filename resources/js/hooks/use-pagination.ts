import { useMemo, useState } from 'react';

export type PageSize = number | 'all';

export const PAGE_SIZE_OPTIONS: PageSize[] = [10, 20, 50, 'all'];

/**
 * Client-side pagination state for a list. Returns the current page's slice
 * plus everything a <TablePagination> needs. Page is clamped when the list
 * shrinks (e.g. after filtering); changing page size resets to page 1.
 */
export function usePagination<T>(items: T[], initialSize: PageSize = 10) {
    const [pageSize, setPageSizeRaw] = useState<PageSize>(initialSize);
    const [page, setPage] = useState(1);

    const total = items.length;
    const size = pageSize === 'all' ? Math.max(total, 1) : pageSize;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const current = Math.min(page, totalPages);

    const pageItems = useMemo(
        () =>
            pageSize === 'all'
                ? items
                : items.slice((current - 1) * size, current * size),
        [items, pageSize, current, size],
    );

    const setPageSize = (next: PageSize) => {
        setPageSizeRaw(next);
        setPage(1);
    };

    return {
        page: current,
        setPage,
        pageSize,
        setPageSize,
        pageItems,
        total,
        totalPages,
        from: total === 0 ? 0 : (current - 1) * size + 1,
        to: Math.min(current * size, total),
    };
}
