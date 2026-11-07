import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SortState } from '@/hooks/use-sort';
import { cn } from '@/lib/utils';

/**
 * Table header cell that sorts its column on click: ↑/↓ on the active
 * column, a faint ↕ on the others. Text style comes from the header row.
 * `onSort` runs after toggling, e.g. to jump back to page 1.
 */
export function SortableHead<K extends string>({
    sort,
    column,
    align,
    className,
    onSort,
    children,
}: {
    sort: SortState<K>;
    column: NoInfer<K>;
    align?: 'right';
    className?: string;
    onSort?: () => void;
    children: ReactNode;
}) {
    const active = sort.key === column;
    const Icon = active
        ? sort.dir === 'asc'
            ? ArrowUp
            : ArrowDown
        : ArrowUpDown;

    return (
        <th
            aria-sort={
                active
                    ? sort.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                    : undefined
            }
            className={cn(
                'px-5 py-3',
                align === 'right' && 'text-right',
                className,
            )}
        >
            <button
                type="button"
                onClick={() => {
                    sort.toggle(column);
                    onSort?.();
                }}
                className={cn(
                    'inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground',
                    active && 'text-foreground',
                    align === 'right' && 'flex-row-reverse',
                )}
            >
                {children}
                <Icon
                    className={cn(
                        'size-3 shrink-0',
                        active ? 'opacity-100' : 'opacity-40',
                    )}
                />
            </button>
        </th>
    );
}
