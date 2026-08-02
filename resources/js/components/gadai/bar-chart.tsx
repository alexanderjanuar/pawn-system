import { formatCompactRupiah, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

export type BarDatum = { label: string; value: number; current?: boolean };

/**
 * Interactive, dependency-free rupiah bar chart. Bars use the theme's
 * `chart-1` color; hovering a bar highlights it and reveals a tooltip with the
 * exact value. Set `showValues` to print a compact label above each bar.
 */
export function BarChart({
    data,
    showValues = true,
    height = 'h-40',
}: {
    data: BarDatum[];
    showValues?: boolean;
    height?: string;
}) {
    const max = Math.max(1, ...data.map((d) => d.value));

    return (
        <div className={cn('flex items-stretch justify-between gap-1.5', height)}>
            {data.map((d, i) => (
                <div
                    key={i}
                    className="group relative flex flex-1 flex-col items-center gap-2"
                >
                    {/* hover tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 scale-95 rounded-lg border bg-popover px-2.5 py-1.5 text-center opacity-0 shadow-md transition-all group-hover:scale-100 group-hover:opacity-100">
                        <p className="text-[11px] font-medium whitespace-nowrap">
                            {d.label}
                        </p>
                        <p className="text-xs font-semibold whitespace-nowrap tabular-nums">
                            {formatRupiah(d.value)}
                        </p>
                    </div>

                    {showValues && (
                        <span
                            className={cn(
                                'text-[10px] tabular-nums transition-colors',
                                d.current
                                    ? 'font-semibold text-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {d.value > 0 ? formatCompactRupiah(d.value) : '–'}
                        </span>
                    )}

                    <div className="flex w-full flex-1 items-end">
                        <div
                            className={cn(
                                'w-full rounded-t transition-all group-hover:bg-chart-1 group-hover:brightness-110',
                                d.current ? 'bg-chart-1' : 'bg-chart-1/40',
                            )}
                            style={{
                                height: `${Math.max((d.value / max) * 100, 2)}%`,
                            }}
                        />
                    </div>

                    <span
                        className={cn(
                            'truncate text-[10px] transition-colors',
                            d.current
                                ? 'font-semibold text-foreground'
                                : 'text-muted-foreground group-hover:text-foreground',
                        )}
                    >
                        {d.label}
                    </span>
                </div>
            ))}
        </div>
    );
}
