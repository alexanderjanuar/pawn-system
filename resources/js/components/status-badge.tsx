import { STATUS_META } from '@/lib/gadai';
import { cn } from '@/lib/utils';
import type { GadaiStatus } from '@/types/gadai';

/**
 * Single source of truth for how a pawn status looks anywhere in the app.
 * A soft tinted pill with a hairline same-hue ring and a glowing status dot
 * (or the status icon). Color is always paired with the label.
 */
export function StatusBadge({
    status,
    size = 'default',
    withIcon = false,
    pulse = false,
    className,
}: {
    status: GadaiStatus;
    size?: 'default' | 'sm';
    withIcon?: boolean;
    /** live "breathing" dot — use sparingly on prominent, still-running items */
    pulse?: boolean;
    className?: string;
}) {
    const meta = STATUS_META[status];
    const Icon = meta.icon;
    const sm = size === 'sm';

    return (
        <span
            className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset',
                meta.badge,
                meta.ring,
                sm
                    ? 'py-0.5 pr-2 pl-1.5 text-[11px]'
                    : 'py-1 pr-2.5 pl-2 text-xs',
                className,
            )}
        >
            {withIcon ? (
                <Icon className={sm ? 'size-3' : 'size-3.5'} />
            ) : (
                <span
                    className={cn(
                        'relative flex shrink-0 items-center justify-center',
                        sm ? 'size-2' : 'size-2.5',
                    )}
                    aria-hidden
                >
                    {pulse && (
                        <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
                    )}
                    {/* static soft glow */}
                    <span className="absolute inline-flex size-full rounded-full bg-current opacity-25" />
                    {/* solid core */}
                    <span
                        className={cn(
                            'relative rounded-full bg-current',
                            sm ? 'size-1' : 'size-1.5',
                        )}
                    />
                </span>
            )}
            {meta.label}
        </span>
    );
}
