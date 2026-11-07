import { Head, Link, router } from '@inertiajs/react';
import { PlusCircle, Search, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DateRangeFilter } from '@/components/gadai/date-range-filter';
import { PageHeader } from '@/components/gadai/page-header';
import { SortableHead } from '@/components/sortable-head';
import { StatusBadge } from '@/components/status-badge';
import { TablePagination } from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePagination } from '@/hooks/use-pagination';
import { byNumber, byText, useSort } from '@/hooks/use-sort';
import type { SortColumn } from '@/hooks/use-sort';
import {
    daysUntil,
    dueLabel,
    formatDate,
    formatPhone,
    formatRupiah,
} from '@/lib/format';
import { STATUS_META, STATUS_ORDER } from '@/lib/gadai';
import { compareByEntry, countByStatus } from '@/lib/selectors';
import { cn } from '@/lib/utils';
import type { GadaiStatus, Transaction } from '@/types/gadai';

type Filter = GadaiStatus | 'ALL';
type SortKey = 'kode' | 'customer' | 'device' | 'principal' | 'due' | 'status';

const SORT_COLUMNS: Record<SortKey, SortColumn<Transaction>> = {
    kode: { compare: compareByEntry, firstDir: 'desc' },
    customer: { compare: byText((t) => t.customer.name) },
    device: { compare: byText((t) => t.device.name) },
    principal: { compare: byNumber((t) => t.principal), firstDir: 'desc' },
    due: { compare: (a, b) => a.dueDate.localeCompare(b.dueDate) },
    status: {
        compare: (a, b) =>
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    },
};

const byCode = (a: Transaction, b: Transaction) => a.id.localeCompare(b.id);

export default function TransaksiIndex({
    transactions,
}: {
    transactions: Transaction[];
}) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('ALL');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const counts = useMemo(() => countByStatus(transactions), [transactions]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return transactions.filter((t) => {
            if (filter !== 'ALL' && t.status !== filter) {
                return false;
            }

            if (from && t.startDate < from) {
                return false;
            }

            if (to && t.startDate > to) {
                return false;
            }

            if (q) {
                const haystack =
                    `${t.id} ${t.customer.name} ${t.customer.phone} ${formatPhone(t.customer.phone)} ${t.device.name}`.toLowerCase();

                if (!haystack.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [transactions, query, filter, from, to]);

    // Default: newest nota first.
    const sort = useSort(
        filtered,
        SORT_COLUMNS,
        { key: 'kode', dir: 'desc' },
        byCode,
    );

    const {
        page,
        setPage,
        pageSize,
        setPageSize,
        pageItems: rows,
        total,
        totalPages,
        from: rangeFrom,
        to: rangeTo,
    } = usePagination(sort.rows, 10);

    const resetPage = () => setPage(1);

    const tabs: { key: Filter; label: string; count: number }[] = [
        { key: 'ALL', label: 'Semua', count: transactions.length },
        ...STATUS_ORDER.map((s) => ({
            key: s,
            label: STATUS_META[s].label,
            count: counts[s],
        })),
    ];

    return (
        <>
            <Head title="Transaksi" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Transaksi"
                    description="Semua transaksi gadai masuk, tebus, dan perpanjangan."
                >
                    <Button asChild>
                        <Link href="/gadai/baru">
                            <PlusCircle />
                            Gadai Baru
                        </Link>
                    </Button>
                </PageHeader>

                {/* Status filter tabs */}
                <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => {
                                setFilter(tab.key);
                                resetPage();
                            }}
                            className={cn(
                                'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                                filter === tab.key
                                    ? 'border-transparent bg-primary text-primary-foreground'
                                    : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                        >
                            {tab.label}
                            <span
                                className={cn(
                                    'rounded-full px-1.5 text-xs tabular-nums',
                                    filter === tab.key
                                        ? 'bg-primary-foreground/15'
                                        : 'bg-muted',
                                )}
                            >
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Search + period */}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="sm:min-w-56 sm:flex-1">
                        <Label htmlFor="cari" className="sr-only">
                            Cari transaksi
                        </Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="cari"
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    resetPage();
                                }}
                                placeholder="Cari nama, kode, HP, atau nomor HP…"
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <DateRangeFilter
                        from={from}
                        to={to}
                        idPrefix="tx"
                        onChange={(f, t) => {
                            setFrom(f);
                            setTo(t);
                            resetPage();
                        }}
                    />
                    {(from || to || query || filter !== 'ALL') && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setFrom('');
                                setTo('');
                                setQuery('');
                                setFilter('ALL');
                                resetPage();
                            }}
                            className="w-full sm:w-auto"
                        >
                            Reset
                        </Button>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[52rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <SortableHead
                                        sort={sort}
                                        column="kode"
                                        onSort={resetPage}
                                        className="px-4"
                                    >
                                        Kode
                                    </SortableHead>
                                    <SortableHead
                                        sort={sort}
                                        column="customer"
                                        onSort={resetPage}
                                        className="px-4"
                                    >
                                        Pelanggan
                                    </SortableHead>
                                    <SortableHead
                                        sort={sort}
                                        column="device"
                                        onSort={resetPage}
                                        className="px-4"
                                    >
                                        Barang
                                    </SortableHead>
                                    <SortableHead
                                        sort={sort}
                                        column="principal"
                                        align="right"
                                        onSort={resetPage}
                                        className="px-4"
                                    >
                                        Dana Titipan
                                    </SortableHead>
                                    <SortableHead
                                        sort={sort}
                                        column="due"
                                        onSort={resetPage}
                                        className="px-4"
                                    >
                                        Jatuh Tempo
                                    </SortableHead>
                                    <SortableHead
                                        sort={sort}
                                        column="status"
                                        onSort={resetPage}
                                        className="px-4"
                                    >
                                        Status
                                    </SortableHead>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rows.map((t) => (
                                    <tr
                                        key={t.id}
                                        onClick={() =>
                                            router.visit(`/transaksi/${t.id}`)
                                        }
                                        className={cn(
                                            'cursor-pointer transition-colors',
                                            t.approvalStatus === 'pending'
                                                ? 'bg-overdue-soft/40 hover:bg-overdue-soft/70'
                                                : 'hover:bg-accent',
                                        )}
                                    >
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/transaksi/${t.id}`}
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                className="font-medium text-foreground tabular-nums hover:text-primary hover:underline"
                                            >
                                                {t.id}
                                            </Link>
                                            <div className="text-xs text-muted-foreground">
                                                {formatDate(t.startDate)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">
                                                {t.customer.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground tabular-nums">
                                                {formatPhone(t.customer.phone)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>{t.device.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {t.device.ram} ·{' '}
                                                {t.device.storage}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-medium tabular-nums">
                                                {formatRupiah(t.principal)}
                                            </div>
                                            <div className="text-xs text-muted-foreground tabular-nums">
                                                +{formatRupiah(t.fee)} biaya
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="tabular-nums">
                                                {formatDate(t.dueDate)}
                                            </div>
                                            {!STATUS_META[t.status]
                                                .terminal && (
                                                <div
                                                    className={cn(
                                                        'text-xs',
                                                        daysUntil(t.dueDate) <=
                                                            0
                                                            ? 'text-overdue'
                                                            : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {dueLabel(t.dueDate)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <StatusBadge
                                                    status={t.status}
                                                />
                                                {t.approvalStatus ===
                                                    'pending' && (
                                                    <span className="inline-flex items-center rounded-full bg-overdue-soft px-2 py-0.5 text-[11px] font-medium text-overdue ring-1 ring-overdue/25 ring-inset">
                                                        Menunggu
                                                    </span>
                                                )}
                                                {t.approvalStatus ===
                                                    'rejected' && (
                                                    <span className="inline-flex items-center rounded-full bg-lelang-soft px-2 py-0.5 text-[11px] font-medium text-lelang ring-1 ring-lelang/25 ring-inset">
                                                        Ditolak
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {rows.length === 0 && (
                        <div className="flex flex-col items-center gap-2 py-16 text-center">
                            <SearchX className="size-8 text-muted-foreground" />
                            <p className="font-medium">
                                Tidak ada transaksi cocok
                            </p>
                            <p className="max-w-xs text-sm text-muted-foreground">
                                Coba ubah kata kunci, rentang tanggal, atau
                                filter status.
                            </p>
                        </div>
                    )}

                    <TablePagination
                        page={page}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        total={total}
                        from={rangeFrom}
                        to={rangeTo}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                </div>
            </div>
        </>
    );
}

TransaksiIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Transaksi', href: '/transaksi' },
    ],
};
