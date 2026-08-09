import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Center coordinates of dot `n` (1-9) on a 120x120 viewBox. */
function center(n: number): { cx: number; cy: number } {
    const i = n - 1;

    return { cx: 20 + (i % 3) * 40, cy: 20 + Math.floor(i / 3) * 40 };
}

/** Parse a "1-2-3" sequence into a validated list of dot numbers. */
export function parsePattern(value: string): number[] {
    return value
        .split('-')
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 9);
}

/**
 * A 3x3 Android-style unlock pattern. Tap dots in order to build the pattern
 * (tap the last dot again to undo). Omit `onChange` to render read-only.
 */
export function PatternLock({
    value,
    onChange,
    size = 196,
    className,
}: {
    value: string;
    onChange?: (value: string) => void;
    size?: number;
    className?: string;
}) {
    const seq = useMemo(() => parsePattern(value), [value]);
    const readOnly = !onChange;

    const order = useMemo(() => {
        const map = new Map<number, number>();
        seq.forEach((n, i) => map.set(n, i + 1));

        return map;
    }, [seq]);

    const tap = (n: number) => {
        if (!onChange) {
            return;
        }

        if (order.has(n)) {
            // Only the most recent dot can be undone.
            if (seq[seq.length - 1] === n) {
                onChange(seq.slice(0, -1).join('-'));
            }

            return;
        }

        onChange([...seq, n].join('-'));
    };

    return (
        <div className={cn('flex flex-col items-start gap-2', className)}>
            <svg
                viewBox="0 0 120 120"
                width={size}
                height={size}
                className="max-w-full touch-none rounded-lg border bg-muted/30 select-none"
            >
                {seq.slice(1).map((n, i) => {
                    const a = center(seq[i]);
                    const b = center(n);

                    return (
                        <line
                            key={`${seq[i]}-${n}`}
                            x1={a.cx}
                            y1={a.cy}
                            x2={b.cx}
                            y2={b.cy}
                            className="stroke-primary"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                        />
                    );
                })}

                {DOTS.map((n) => {
                    const { cx, cy } = center(n);
                    const active = order.has(n);

                    return (
                        <g
                            key={n}
                            onClick={() => tap(n)}
                            className={cn(!readOnly && 'cursor-pointer')}
                        >
                            <circle cx={cx} cy={cy} r={18} fill="transparent" />
                            <circle
                                cx={cx}
                                cy={cy}
                                r={active ? 9 : 5}
                                className={cn(
                                    active
                                        ? 'fill-primary'
                                        : 'fill-muted-foreground/30',
                                )}
                            />
                            {active && (
                                <text
                                    x={cx}
                                    y={cy}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    className="fill-primary-foreground"
                                    fontSize={9}
                                    fontWeight={600}
                                >
                                    {order.get(n)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {!readOnly && (
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onChange('')}
                        disabled={seq.length === 0}
                    >
                        Ulangi
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        {seq.length > 0
                            ? `Urutan: ${seq.join(' → ')}`
                            : 'Ketuk titik sesuai pola'}
                    </span>
                </div>
            )}
        </div>
    );
}
