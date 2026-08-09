import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronRight,
    Clock,
    Gavel,
    MessageCircle,
    PlusCircle,
    RefreshCw,
    Send,
    ShieldCheck,
    X,
} from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '@/components/gadai/page-header';
import { ReminderDialog } from '@/components/gadai/reminder-dialog';
import { PetugasLink } from '@/components/petugas-link';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
    daysUntil,
    dueLabel,
    formatDate,
    formatDateLong,
    formatRupiah,
    relativeDay,
    TODAY,
} from '@/lib/format';
import { STATUS_META, STATUS_ORDER } from '@/lib/gadai';
import { countByStatus, runningTransactions } from '@/lib/selectors';
import { cn } from '@/lib/utils';
import type { TimelineType, Transaction } from '@/types/gadai';

const ACTIVITY_ICON: Record<
    TimelineType,
    { icon: typeof PlusCircle; chip: string }
> = {
    created: { icon: PlusCircle, chip: 'text-primary bg-accent' },
    reminder: {
        icon: MessageCircle,
        chip: 'text-perpanjang bg-perpanjang-soft',
    },
    extended: { icon: RefreshCw, chip: 'text-aktif bg-aktif-soft' },
    redeemed: { icon: CheckCircle2, chip: 'text-diambil bg-diambil-soft' },
    auctioned: { icon: Gavel, chip: 'text-lelang bg-lelang-soft' },
    flagged: { icon: AlertTriangle, chip: 'text-overdue bg-overdue-soft' },
};

function initials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function DueRow({ t }: { t: Transaction }) {
    const d = daysUntil(t.dueDate);
    const meta = STATUS_META[t.status];
    const urgent = d <= 0;
    const DueIcon = d < 0 ? AlertTriangle : Clock;

    return (
        <li className="group relative">
            {/* whole-row click target */}
            <Link
                href={`/transaksi/${t.id}`}
                className="absolute inset-0 z-10"
                aria-label={`Detail ${t.customer.name}`}
            />
            <div className="relative flex items-center gap-3 px-5 py-3 transition-colors group-hover:bg-accent/50">
                {/* avatar with status indicator */}
                <span className="relative shrink-0">
                    <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground/80">
                        {initials(t.customer.name)}
                    </span>
                    <span
                        className={cn(
                            'absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-card',
                            meta.dot,
                        )}
                        aria-hidden
                    />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                            {t.customer.name}
                        </span>
                        <StatusBadge status={t.status} size="sm" />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                        {t.device.name} ·{' '}
                        <span className="tabular-nums">{t.id}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">
                            {formatRupiah(t.principal)}
                        </div>
                        <span
                            className={cn(
                                'mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                                urgent
                                    ? 'bg-overdue-soft text-overdue ring-overdue/25'
                                    : 'bg-muted text-muted-foreground ring-transparent',
                            )}
                        >
                            <DueIcon className="size-3" />
                            {dueLabel(t.dueDate)}
                        </span>
                    </div>

                    <ReminderDialog tx={t}>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Kirim pengingat WhatsApp"
                            className="relative z-20 size-8 shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        >
                            <Send className="size-4" />
                        </Button>
                    </ReminderDialog>
                    <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground sm:block" />
                </div>
            </div>
        </li>
    );
}

export default function Dashboard({
    transactions,
    pendingApprovals,
}: {
    transactions: Transaction[];
    pendingApprovals: Transaction[];
}) {
    const page = usePage().props;
    const role = page.auth.user?.role;
    const canApprove = role === 'owner' || role === 'admin';
    const approvalThreshold = page.approvalThreshold;

    const data = useMemo(() => {
        // Only approved (disbursed) loans count toward the operational book;
        // pending/rejected are handled in the approval queue.
        const book = transactions.filter(
            (t) => t.approvalStatus === 'approved',
        );
        const running = runningTransactions(book);
        const runningPrincipal = running.reduce((s, t) => s + t.principal, 0);
        const runningFee = running.reduce((s, t) => s + t.fee, 0);

        const feeIncome =
            book
                .filter((t) => t.status === 'DIAMBIL')
                .reduce((s, t) => s + t.fee, 0) +
            book
                .flatMap((t) => t.history)
                .filter((e) => e.type === 'extended')
                .reduce((s, e) => s + (e.amount ?? 0), 0);

        const counts = countByStatus(book);

        const attention =
            counts.TIDAK_DIAMBIL +
            running.filter((t) => daysUntil(t.dueDate) <= 0).length;

        // Due soon + overdue, sorted by due date ascending
        const dueList = [
            ...book.filter((t) => t.status === 'TIDAK_DIAMBIL'),
            ...running.filter((t) => daysUntil(t.dueDate) <= 7),
        ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        const activity = transactions
            .flatMap((t) =>
                t.history.map((e) => ({
                    ...e,
                    txId: t.id,
                    customer: t.customer.name,
                })),
            )
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);

        return {
            running,
            runningPrincipal,
            potensiTebus: runningPrincipal + runningFee,
            feeIncome,
            counts,
            total: book.length,
            attention,
            dueList,
            overdue: dueList.filter((t) => daysUntil(t.dueDate) < 0).length,
            activity,
        };
    }, [transactions]);

    const stats = [
        {
            label: 'Dana Titipan Berjalan',
            value: formatRupiah(data.runningPrincipal),
            hint: `${data.running.length} barang aktif berjalan`,
        },
        {
            label: 'Pemasukan Biaya · Juli',
            value: formatRupiah(data.feeIncome),
            hint: 'biaya titipan + perpanjangan',
        },
        {
            label: 'Potensi Tebus',
            value: formatRupiah(data.potensiTebus),
            hint: 'dana titipan + biaya bila ditebus',
        },
        {
            label: 'Perlu Perhatian',
            value: String(data.attention),
            hint: 'jatuh tempo hari ini & terlambat',
            tone: 'text-overdue',
        },
    ];

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Dashboard"
                    description={`Ringkasan usaha · ${formatDateLong(TODAY.toISOString())}`}
                >
                    <Button asChild>
                        <Link href="/gadai/baru">
                            <PlusCircle />
                            Gadai Baru
                        </Link>
                    </Button>
                </PageHeader>

                {/* Summary strip */}
                <div className="grid grid-cols-2 rounded-xl border bg-card shadow-sm lg:grid-cols-4">
                    {stats.map((s, i) => (
                        <div
                            key={s.label}
                            className={cn(
                                'flex min-w-0 flex-col gap-1 p-4 sm:p-5',
                                i % 2 === 1 && 'border-l',
                                i >= 2 && 'border-t lg:border-t-0',
                                i === 2 && 'lg:border-l',
                                i === 3 && 'lg:border-l',
                            )}
                        >
                            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {s.label}
                            </span>
                            <span
                                className={cn(
                                    'truncate text-lg font-semibold tabular-nums sm:text-xl lg:text-2xl',
                                    s.tone,
                                )}
                            >
                                {s.value}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {s.hint}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Menunggu persetujuan pencairan */}
                {pendingApprovals.length > 0 && (
                    <section className="overflow-hidden rounded-xl border border-overdue/30 bg-overdue-soft/40 shadow-sm">
                        <div className="flex items-center gap-2 border-b border-overdue/20 px-5 py-4">
                            <ShieldCheck className="size-4 text-overdue" />
                            <h2 className="font-semibold">
                                Menunggu Persetujuan
                            </h2>
                            <span className="inline-flex items-center rounded-full bg-overdue px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
                                {pendingApprovals.length}
                            </span>
                            <p className="ml-1 hidden text-xs text-muted-foreground sm:block">
                                Pinjaman di atas{' '}
                                {formatRupiah(approvalThreshold)} perlu
                                persetujuan Pemilik sebelum cair
                            </p>
                        </div>
                        <ul className="divide-y divide-overdue/15">
                            {pendingApprovals.map((t) => (
                                <li
                                    key={t.id}
                                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                                href={`/transaksi/${t.id}`}
                                                className="font-medium hover:text-primary hover:underline"
                                            >
                                                {t.customer.name}
                                            </Link>
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {t.id}
                                            </span>
                                        </div>
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                            {t.device.name} · diajukan{' '}
                                            <PetugasLink name={t.clerk} /> ·{' '}
                                            {formatDate(t.startDate)}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                                        <span className="text-lg font-semibold text-overdue tabular-nums">
                                            {formatRupiah(t.principal)}
                                        </span>
                                        {canApprove ? (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        router.post(
                                                            `/transaksi/${t.id}/reject`,
                                                            {},
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        )
                                                    }
                                                >
                                                    <X />
                                                    Tolak
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        router.post(
                                                            `/transaksi/${t.id}/approve`,
                                                            {},
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        )
                                                    }
                                                >
                                                    <Check />
                                                    Setujui
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                                Menunggu Pemilik
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Jatuh tempo terdekat */}
                    <section className="overflow-hidden rounded-xl border bg-card shadow-sm lg:col-span-2">
                        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-semibold">
                                        Jatuh Tempo Terdekat
                                    </h2>
                                    {data.overdue > 0 && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-overdue-soft px-2 py-0.5 text-[11px] font-medium text-overdue ring-1 ring-overdue/25 ring-inset">
                                            {data.overdue} terlambat
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Barang yang akan dan sudah lewat jatuh tempo
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="shrink-0"
                            >
                                <Link href="/jatuh-tempo">
                                    Lihat semua
                                    <ArrowRight />
                                </Link>
                            </Button>
                        </div>
                        {data.dueList.length > 0 ? (
                            <ul className="divide-y">
                                {data.dueList.slice(0, 6).map((t) => (
                                    <DueRow key={t.id} t={t} />
                                ))}
                            </ul>
                        ) : (
                            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                                <CheckCircle2 className="size-6 text-diambil" />
                                <p className="text-sm text-muted-foreground">
                                    Tidak ada barang mendekati jatuh tempo.
                                </p>
                            </div>
                        )}
                    </section>

                    {/* Aside: status + activity (side by side on tablet, stacked in the rail on desktop) */}
                    <aside className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="rounded-xl border bg-card p-5 shadow-sm">
                            <h2 className="font-semibold">Barang per Status</h2>
                            <p className="text-xs text-muted-foreground">
                                {data.total} transaksi total
                            </p>

                            {/* composition bar */}
                            <div className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
                                {STATUS_ORDER.map((status) => {
                                    const count = data.counts[status];

                                    if (count === 0) {
                                        return null;
                                    }

                                    return (
                                        <div
                                            key={status}
                                            className={cn(
                                                'h-full first:rounded-l-full last:rounded-r-full',
                                                STATUS_META[status].dot,
                                            )}
                                            style={{
                                                width: `${(count / data.total) * 100}%`,
                                            }}
                                            title={`${STATUS_META[status].label}: ${count}`}
                                        />
                                    );
                                })}
                            </div>

                            {/* legend */}
                            <ul className="mt-4 space-y-2.5">
                                {STATUS_ORDER.map((status) => {
                                    const count = data.counts[status];
                                    const pct = Math.round(
                                        (count / data.total) * 100,
                                    );
                                    const meta = STATUS_META[status];

                                    return (
                                        <li
                                            key={status}
                                            className="flex items-center justify-between gap-2 text-sm"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className={cn(
                                                        'size-2 rounded-full',
                                                        meta.dot,
                                                    )}
                                                    aria-hidden
                                                />
                                                {meta.label}
                                            </span>
                                            <span className="flex items-center gap-2 tabular-nums">
                                                <span className="text-xs text-muted-foreground">
                                                    {pct}%
                                                </span>
                                                <span className="w-5 text-right font-medium">
                                                    {count}
                                                </span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <div className="rounded-xl border bg-card p-5 shadow-sm">
                            <h2 className="mb-4 font-semibold">
                                Aktivitas Terakhir
                            </h2>
                            <ol className="relative">
                                {data.activity.map((e, i) => {
                                    const meta = ACTIVITY_ICON[e.type];
                                    const Icon = meta.icon;
                                    const last = i === data.activity.length - 1;

                                    return (
                                        <li
                                            key={`${e.txId}-${i}`}
                                            className="group/act relative flex gap-3 pb-4 last:pb-0"
                                        >
                                            {!last && (
                                                <span
                                                    className="absolute top-8 bottom-0 left-[15px] w-px bg-border"
                                                    aria-hidden
                                                />
                                            )}
                                            <span
                                                className={cn(
                                                    'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full',
                                                    meta.chip,
                                                )}
                                            >
                                                <Icon className="size-4" />
                                            </span>
                                            <Link
                                                href={`/transaksi/${e.txId}`}
                                                className="min-w-0 flex-1 pt-1"
                                            >
                                                <p className="text-sm leading-tight font-medium transition-colors group-hover/act:text-primary">
                                                    {e.title}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {e.customer} ·{' '}
                                                    {relativeDay(e.date)}
                                                </p>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: '/dashboard' }],
};
