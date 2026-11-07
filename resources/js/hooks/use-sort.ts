import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

/** How one sortable column orders its rows. */
export type SortColumn<T> = {
    /** Ascending comparator. */
    compare: (a: T, b: T) => number;
    /**
     * Direction of the first click on this column. Use 'desc' for dates and
     * amounts (newest/largest first). Defaults to 'asc' (A→Z).
     */
    firstDir?: SortDir;
    /**
     * Rows with no value for this column (e.g. not sold yet) stay at the
     * bottom in both directions instead of sorting as zero/empty.
     */
    isBlank?: (row: T) => boolean;
};

/** Current sort plus the toggle a <SortableHead> calls. */
export type SortState<K extends string> = {
    key: K;
    dir: SortDir;
    toggle: (key: K) => void;
};

/**
 * Client-side table sorting. Clicking the active column flips its direction;
 * clicking another column starts at that column's `firstDir`. Keep `columns`
 * and `tieBreak` at module level so the sorted list stays memoized.
 */
export function useSort<T, K extends string>(
    rows: T[],
    columns: Record<K, SortColumn<T>>,
    initial: { key: NoInfer<K>; dir: SortDir },
    tieBreak?: (a: T, b: T) => number,
): SortState<K> & { rows: T[] } {
    const [key, setKey] = useState<K>(initial.key);
    const [dir, setDir] = useState<SortDir>(initial.dir);

    const sorted = useMemo(() => {
        const { compare, isBlank } = columns[key];
        const sign = dir === 'asc' ? 1 : -1;

        return [...rows].sort(
            (a, b) =>
                (isBlank ? Number(isBlank(a)) - Number(isBlank(b)) : 0) ||
                compare(a, b) * sign ||
                (tieBreak?.(a, b) ?? 0),
        );
    }, [rows, columns, key, dir, tieBreak]);

    const toggle = (next: K) => {
        if (next === key) {
            setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setKey(next);
            setDir(columns[next].firstDir ?? 'asc');
        }
    };

    return { rows: sorted, key, dir, toggle };
}

/** Locale-aware A→Z comparator for text columns (nullish sorts as empty). */
export function byText<T>(
    pick: (row: T) => string | null | undefined,
): (a: T, b: T) => number {
    return (a, b) =>
        (pick(a) ?? '').localeCompare(pick(b) ?? '', 'id', {
            numeric: true,
            sensitivity: 'base',
        });
}

/** Ascending comparator for numeric columns (nullish sorts as 0). */
export function byNumber<T>(
    pick: (row: T) => number | null | undefined,
): (a: T, b: T) => number {
    return (a, b) => (pick(a) ?? 0) - (pick(b) ?? 0);
}
