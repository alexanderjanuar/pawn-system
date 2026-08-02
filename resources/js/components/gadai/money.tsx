import { formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Rupiah with tabular figures so columns align. */
export function Money({
    value,
    className,
}: {
    value: number;
    className?: string;
}) {
    return (
        <span className={cn('tabular-nums', className)}>
            {formatRupiah(value)}
        </span>
    );
}
