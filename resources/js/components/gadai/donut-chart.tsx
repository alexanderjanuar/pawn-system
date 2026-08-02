import { useState } from 'react';
import { cn } from '@/lib/utils';

export type DonutSegment = {
    label: string;
    value: number; // drives the arc size (e.g. item count)
    sub?: string; // secondary text in the legend (e.g. formatted rupiah)
    colorClassName: string; // text-* token; stroke/dot read it via currentColor
};

/**
 * Interactive donut chart with legend. Hovering a segment or a legend row
 * highlights the arc and shows that segment's value in the center; otherwise
 * the center shows the total. Colors come from `text-*` tokens.
 */
export function DonutChart({
    segments,
    centerLabel = 'Total',
}: {
    segments: DonutSegment[];
    centerLabel?: string;
}) {
    const [active, setActive] = useState<number | null>(null);

    const total = segments.reduce((sum, s) => sum + s.value, 0);
    const size = 168;
    const stroke = 20;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const activeSeg = active !== null ? segments[active] : null;

    let acc = 0;

    return (
        <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div
                className="relative shrink-0"
                style={{ width: size, height: size }}
            >
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="-rotate-90"
                >
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        stroke="currentColor"
                        className="text-muted"
                    />
                    {total > 0 &&
                        segments.map((s, i) => {
                            if (s.value === 0) {
                                return null;
                            }

                            const len = (s.value / total) * circumference;
                            const seg = (
                                <circle
                                    key={s.label}
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    fill="none"
                                    stroke="currentColor"
                                    className={cn(
                                        s.colorClassName,
                                        'cursor-pointer transition-[opacity,stroke-width]',
                                    )}
                                    strokeWidth={active === i ? stroke + 5 : stroke}
                                    strokeDasharray={`${len} ${circumference - len}`}
                                    strokeDashoffset={-acc}
                                    opacity={
                                        active === null || active === i ? 1 : 0.3
                                    }
                                    onMouseEnter={() => setActive(i)}
                                    onMouseLeave={() => setActive(null)}
                                />
                            );

                            acc += len;

                            return seg;
                        })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums">
                        {activeSeg ? activeSeg.value : total}
                    </span>
                    <span className="max-w-[6rem] truncate text-xs text-muted-foreground">
                        {activeSeg ? activeSeg.label : centerLabel}
                    </span>
                </div>
            </div>

            <ul className="w-full flex-1 space-y-1">
                {segments.map((s, i) => (
                    <li
                        key={s.label}
                        onMouseEnter={() => setActive(i)}
                        onMouseLeave={() => setActive(null)}
                        className={cn(
                            'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                            active === i ? 'bg-accent' : 'hover:bg-accent/50',
                        )}
                    >
                        <span className="flex items-center gap-2">
                            <span
                                className={cn(
                                    'size-2.5 rounded-full bg-current',
                                    s.colorClassName,
                                )}
                                aria-hidden
                            />
                            {s.label}
                            <span className="text-xs text-muted-foreground tabular-nums">
                                ({s.value})
                            </span>
                        </span>
                        {s.sub && (
                            <span className="font-medium tabular-nums">
                                {s.sub}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
