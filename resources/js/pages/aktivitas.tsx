import { Head, Link } from '@inertiajs/react';
import { ArrowRight, History, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/gadai/page-header';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Activity, ActivityAction } from '@/types/gadai';

const ACTION_META: Record<ActivityAction, { icon: LucideIcon; tone: string }> =
    {
        created: { icon: PlusCircle, tone: 'text-diambil bg-diambil-soft' },
        updated: { icon: Pencil, tone: 'text-aktif bg-aktif-soft' },
        deleted: { icon: Trash2, tone: 'text-lelang bg-lelang-soft' },
    };

const SUBJECT_NOUN: Record<Activity['subjectType'], string> = {
    transaction: 'Transaksi',
    customer: 'Pelanggan',
    petugas: 'Petugas',
    user: 'Akun',
    store: 'Toko',
    rak: 'Rak',
};

function subjectHref(a: Activity): string | null {
    if (a.action === 'deleted' || !a.subjectCode) {
        return null;
    }

    if (a.subjectType === 'transaction') {
        return `/transaksi/${a.subjectCode}`;
    }

    if (a.subjectType === 'customer') {
        return `/pelanggan/${a.subjectCode}`;
    }

    // Petugas roster entries and login accounts have no dedicated detail page.
    return null;
}

export default function Aktivitas({ activities }: { activities: Activity[] }) {
    // Preserve incoming (newest-first) order while grouping by day.
    const groups: { date: string; items: Activity[] }[] = [];

    for (const a of activities) {
        const last = groups[groups.length - 1];

        if (last && last.date === a.date) {
            last.items.push(a);
        } else {
            groups.push({ date: a.date, items: [a] });
        }
    }

    return (
        <>
            <Head title="Aktivitas" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Riwayat Aktivitas"
                    description="Jejak audit setiap transaksi dan pelanggan: siapa membuat, mengubah, atau menghapus data, beserta waktunya."
                />

                {groups.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-12 text-center">
                        <History className="size-8 text-muted-foreground" />
                        <p className="font-medium">Belum ada aktivitas</p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            Setiap kali data dibuat, diubah, atau dihapus,
                            catatannya akan muncul di sini.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {groups.map((group) => (
                            <section key={group.date}>
                                <div className="sticky top-0 z-10 -mx-1 mb-3 bg-background/80 px-1 py-1 backdrop-blur">
                                    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        {formatDate(group.date)}
                                    </h2>
                                </div>
                                <ol className="overflow-hidden rounded-xl border bg-card shadow-sm">
                                    {group.items.map((a, i) => (
                                        <ActivityRow
                                            key={a.id}
                                            activity={a}
                                            last={i === group.items.length - 1}
                                        />
                                    ))}
                                </ol>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

function ActivityRow({
    activity: a,
    last,
}: {
    activity: Activity;
    last: boolean;
}) {
    const meta = ACTION_META[a.action];
    const Icon = meta.icon;
    const href = subjectHref(a);
    const subjectNoun = SUBJECT_NOUN[a.subjectType];

    return (
        <li
            className={cn(
                'flex gap-3 p-4 sm:gap-4 sm:p-5',
                !last && 'border-b',
            )}
        >
            <span className="w-10 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground tabular-nums sm:w-12 sm:text-sm">
                {a.time}
            </span>
            <span
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    meta.tone,
                )}
            >
                <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm">
                    <span className="font-semibold">{a.actor}</span>{' '}
                    <span className="text-muted-foreground">
                        {a.description.toLowerCase()}
                    </span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{subjectNoun}</span>
                    {a.subjectCode &&
                        (href ? (
                            <Link
                                href={href}
                                className="font-medium text-foreground tabular-nums hover:text-primary hover:underline"
                            >
                                {a.subjectCode}
                            </Link>
                        ) : (
                            <span
                                className={cn(
                                    'font-medium text-foreground tabular-nums',
                                    a.action === 'deleted' && 'line-through',
                                )}
                            >
                                {a.subjectCode}
                            </span>
                        ))}
                    {a.subjectLabel && (
                        <span className="truncate">· {a.subjectLabel}</span>
                    )}
                </div>

                {a.changes.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                        {a.changes.map((c, i) => (
                            <li
                                key={i}
                                className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-xs"
                            >
                                <span className="font-medium">{c.field}</span>
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
            </div>
        </li>
    );
}

Aktivitas.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Aktivitas', href: '/aktivitas' },
    ],
};
