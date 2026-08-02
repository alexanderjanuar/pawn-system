import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Gavel,
    MessageCircle,
    Pencil,
    PlusCircle,
    RefreshCw,
} from 'lucide-react';
import { formatDate, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { HistoryEntry, HistoryKind } from '@/types/gadai';

const META: Record<HistoryKind, { icon: typeof PlusCircle; tone: string }> = {
    created: { icon: PlusCircle, tone: 'text-primary bg-accent' },
    updated: { icon: Pencil, tone: 'text-aktif bg-aktif-soft' },
    reminder: {
        icon: MessageCircle,
        tone: 'text-perpanjang bg-perpanjang-soft',
    },
    extended: { icon: RefreshCw, tone: 'text-aktif bg-aktif-soft' },
    redeemed: { icon: CheckCircle2, tone: 'text-diambil bg-diambil-soft' },
    auctioned: { icon: Gavel, tone: 'text-lelang bg-lelang-soft' },
    flagged: { icon: AlertTriangle, tone: 'text-overdue bg-overdue-soft' },
};

/** Renders a transaction's Riwayat. Items arrive already sorted newest-first. */
export function Timeline({ events }: { events: HistoryEntry[] }) {
    return (
        <ol className="space-y-0">
            {events.map((e, i) => {
                const meta = META[e.kind];
                const Icon = meta.icon;
                const last = i === events.length - 1;

                return (
                    <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                        {!last && (
                            <span
                                className="absolute top-8 bottom-0 left-[15px] w-px bg-border"
                                aria-hidden
                            />
                        )}
                        <span
                            className={cn(
                                'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full',
                                meta.tone,
                            )}
                        >
                            <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1 pt-1">
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-medium">{e.title}</p>
                                {e.amount != null && (
                                    <span className="shrink-0 text-sm font-medium tabular-nums">
                                        {formatRupiah(e.amount)}
                                    </span>
                                )}
                            </div>
                            {e.note && (
                                <p className="text-xs text-muted-foreground">
                                    {e.note}
                                </p>
                            )}

                            {e.changes.length > 0 && (
                                <ul className="mt-2 flex flex-col gap-1">
                                    {e.changes.map((c, j) => (
                                        <li
                                            key={j}
                                            className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-xs"
                                        >
                                            <span className="font-medium">
                                                {c.field}
                                            </span>
                                            <span className="text-muted-foreground line-through">
                                                {c.from || '—'}
                                            </span>
                                            <ArrowRight className="size-3 text-muted-foreground" />
                                            <span className="font-medium text-foreground">
                                                {c.to || '—'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                                {formatDate(e.date)} · {e.time}
                                {e.by ? ` · ${e.by}` : ''}
                            </p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
