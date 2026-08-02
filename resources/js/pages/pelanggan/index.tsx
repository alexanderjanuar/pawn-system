import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Search,
    SearchX,
    ShieldAlert,
    UserPlus,
    Users,
    Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '@/components/gadai/page-header';
import { TablePagination } from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, formatRupiah } from '@/lib/format';
import { customerStats, customerTransactions } from '@/lib/selectors';
import { cn, initials } from '@/lib/utils';
import type { Customer, Transaction } from '@/types/gadai';

export default function PelangganIndex({
    customers,
    transactions,
}: {
    customers: Customer[];
    transactions: Transaction[];
}) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'blacklist'>('all');

    const rows = useMemo(
        () =>
            customers.map((c) => ({
                customer: c,
                stats: customerStats(
                    customerTransactions(transactions, c.phone),
                ),
            })),
        [customers, transactions],
    );

    const blacklistCount = useMemo(
        () => rows.filter((r) => r.customer.blacklisted).length,
        [rows],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return rows.filter(({ customer }) => {
            if (filter === 'blacklist' && !customer.blacklisted) {
                return false;
            }

            if (
                q &&
                !`${customer.name} ${customer.phone} ${customer.id}`
                    .toLowerCase()
                    .includes(q)
            ) {
                return false;
            }

            return true;
        });
    }, [rows, query, filter]);

    const {
        page,
        setPage,
        pageSize,
        setPageSize,
        pageItems,
        total,
        totalPages,
        from,
        to,
    } = usePagination(filtered, 10);

    const summary = useMemo(() => {
        const withActive = rows.filter((r) => r.stats.active > 0).length;
        const running = rows.reduce((s, r) => s + r.stats.runningPrincipal, 0);

        return { total: rows.length, withActive, running };
    }, [rows]);

    return (
        <>
            <Head title="Pelanggan" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Pelanggan"
                    description="Data pelanggan gadai. Cari dan pilih pelanggan saat membuat transaksi baru."
                >
                    <AddCustomerDialog />
                </PageHeader>

                {/* Summary */}
                <div className="grid grid-cols-1 divide-y rounded-xl border bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <Stat
                        icon={Users}
                        label="Total Pelanggan"
                        value={String(summary.total)}
                    />
                    <Stat
                        label="Punya Gadai Aktif"
                        value={String(summary.withActive)}
                    />
                    <Stat
                        icon={Wallet}
                        label="Dana Berjalan"
                        value={formatRupiah(summary.running)}
                    />
                </div>

                {/* Filter pills */}
                <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                    {(
                        [
                            { key: 'all', label: 'Semua', count: rows.length },
                            {
                                key: 'blacklist',
                                label: 'Blacklist',
                                count: blacklistCount,
                            },
                        ] as const
                    ).map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => {
                                setFilter(tab.key);
                                setPage(1);
                            }}
                            className={cn(
                                'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                                filter === tab.key
                                    ? tab.key === 'blacklist'
                                        ? 'border-transparent bg-lelang text-white'
                                        : 'border-transparent bg-primary text-primary-foreground'
                                    : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                        >
                            {tab.key === 'blacklist' && (
                                <ShieldAlert className="size-3.5" />
                            )}
                            {tab.label}
                            <span
                                className={cn(
                                    'rounded-full px-1.5 text-xs tabular-nums',
                                    filter === tab.key
                                        ? 'bg-white/20'
                                        : 'bg-muted',
                                )}
                            >
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Cari nama, nomor HP, atau kode pelanggan…"
                        className="pl-9"
                    />
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[46rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Pelanggan
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Kontak
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Gadai Aktif
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Dana Berjalan
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Aktivitas Terakhir
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pageItems.map(({ customer, stats }) => (
                                    <tr
                                        key={customer.id}
                                        onClick={() =>
                                            router.visit(
                                                `/pelanggan/${customer.id}`,
                                            )
                                        }
                                        className={cn(
                                            'cursor-pointer transition-colors',
                                            customer.blacklisted
                                                ? 'bg-lelang-soft/40 hover:bg-lelang-soft/60'
                                                : 'hover:bg-accent',
                                        )}
                                    >
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground/80">
                                                    {initials(customer.name)}
                                                </span>
                                                <div className="min-w-0">
                                                    <span className="flex items-center gap-1.5">
                                                        <Link
                                                            href={`/pelanggan/${customer.id}`}
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                            className="font-medium hover:text-primary hover:underline"
                                                        >
                                                            {customer.name}
                                                        </Link>
                                                        {customer.blacklisted && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-lelang-soft px-1.5 py-0.5 text-[10px] font-medium text-lelang ring-1 ring-lelang/25 ring-inset">
                                                                <ShieldAlert className="size-3" />
                                                                Blacklist
                                                            </span>
                                                        )}
                                                    </span>
                                                    <div className="text-xs text-muted-foreground tabular-nums">
                                                        {customer.id}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground tabular-nums">
                                            {customer.phone}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            {stats.active > 0 ? (
                                                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-aktif-soft px-1.5 py-0.5 text-xs font-medium text-aktif tabular-nums ring-1 ring-aktif/25 ring-inset">
                                                    {stats.active}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium tabular-nums">
                                            {stats.runningPrincipal > 0
                                                ? formatRupiah(
                                                      stats.runningPrincipal,
                                                  )
                                                : '—'}
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground tabular-nums">
                                            {stats.lastActivity
                                                ? formatDate(stats.lastActivity)
                                                : 'Belum ada'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filtered.length === 0 && (
                        <div className="flex flex-col items-center gap-2 py-16 text-center">
                            <SearchX className="size-8 text-muted-foreground" />
                            <p className="font-medium">
                                Pelanggan tidak ditemukan
                            </p>
                            <p className="max-w-xs text-sm text-muted-foreground">
                                Coba kata kunci lain, atau tambahkan pelanggan
                                baru.
                            </p>
                        </div>
                    )}

                    <TablePagination
                        page={page}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        total={total}
                        from={from}
                        to={to}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                </div>
            </div>
        </>
    );
}

function Stat({
    icon: Icon,
    label,
    value,
    className,
}: {
    icon?: typeof Users;
    label: string;
    value: string;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-1 p-5', className)}>
            <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {Icon && <Icon className="size-3.5" />}
                {label}
            </span>
            <span className="text-xl font-semibold tabular-nums">{value}</span>
        </div>
    );
}

function AddCustomerDialog() {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        phone: '',
        address: '',
        id_number: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/pelanggan', {
            onSuccess: () => {
                reset();
                setOpen(false);
            },
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                setOpen(v);

                if (!v) {
                    reset();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button>
                    <UserPlus />
                    Tambah Pelanggan
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>Tambah Pelanggan</DialogTitle>
                        <DialogDescription>
                            Simpan data pelanggan agar bisa dipilih cepat saat
                            gadai baru.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="c-nama">Nama</Label>
                            <Input
                                id="c-nama"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder="cth. Budi Santoso"
                            />
                            {errors.name && (
                                <p className="text-xs text-destructive">
                                    {errors.name}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="c-hp">Nomor HP</Label>
                                <Input
                                    id="c-hp"
                                    inputMode="numeric"
                                    value={data.phone}
                                    onChange={(e) =>
                                        setData('phone', e.target.value)
                                    }
                                    placeholder="0812-…"
                                />
                                {errors.phone && (
                                    <p className="text-xs text-destructive">
                                        {errors.phone}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="c-ktp">No. KTP</Label>
                                <Input
                                    id="c-ktp"
                                    inputMode="numeric"
                                    value={data.id_number}
                                    onChange={(e) =>
                                        setData('id_number', e.target.value)
                                    }
                                    placeholder="16 digit"
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="c-alamat">Alamat</Label>
                            <Input
                                id="c-alamat"
                                value={data.address}
                                onChange={(e) =>
                                    setData('address', e.target.value)
                                }
                                placeholder="Jl. …, Tanah Merah"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Batal
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            <UserPlus />
                            Simpan Pelanggan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

PelangganIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Pelanggan', href: '/pelanggan' },
    ],
};
