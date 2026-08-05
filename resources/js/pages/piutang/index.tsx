import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { HandCoins, Plus, Search, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DatePicker } from '@/components/gadai/date-picker';
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
import { Textarea } from '@/components/ui/textarea';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, formatRupiah, TODAY } from '@/lib/format';
import { cn } from '@/lib/utils';

type PiutangStatus = 'berjalan' | 'lunas';

type Row = {
    id: number;
    code: string;
    debtorName: string;
    deviceName: string;
    price: number;
    downPayment: number;
    financed: number;
    paid: number;
    remaining: number;
    status: PiutangStatus;
    terminCount: number;
    late: boolean;
    date: string;
    storeName: string | null;
    detailUrl: string;
};

type PageProps = {
    piutangs: Row[];
    summary: { berjalan: number; outstanding: number; collected: number };
    petugasList: string[];
};

type Filter = 'all' | 'berjalan' | 'lunas';

export function StatusPill({ status }: { status: PiutangStatus }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                status === 'lunas'
                    ? 'bg-diambil-soft text-diambil'
                    : 'bg-perpanjang-soft text-perpanjang',
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    status === 'lunas' ? 'bg-diambil' : 'bg-perpanjang',
                )}
                aria-hidden
            />
            {status === 'lunas' ? 'Lunas' : 'Berjalan'}
        </span>
    );
}

export default function PiutangIndex({
    piutangs,
    summary,
    petugasList,
}: PageProps) {
    const showStore = usePage().props.activeStore === 'all';
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('all');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return piutangs.filter((p) => {
            if (filter !== 'all' && p.status !== filter) {
                return false;
            }

            if (!q) {
                return true;
            }

            return `${p.code} ${p.debtorName} ${p.deviceName}`
                .toLowerCase()
                .includes(q);
        });
    }, [piutangs, query, filter]);

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

    const tabs: { key: Filter; label: string; count: number }[] = [
        { key: 'all', label: 'Semua', count: piutangs.length },
        {
            key: 'berjalan',
            label: 'Berjalan',
            count: piutangs.filter((p) => p.status === 'berjalan').length,
        },
        {
            key: 'lunas',
            label: 'Lunas',
            count: piutangs.filter((p) => p.status === 'lunas').length,
        },
    ];

    return (
        <>
            <Head title="Piutang" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Piutang"
                    description="HP yang diambil secara kredit. Catat pembayaran sampai lunas."
                >
                    <TambahPiutangDialog petugasList={petugasList} />
                </PageHeader>

                {/* Summary */}
                <div className="grid grid-cols-1 divide-y rounded-xl border bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <Stat label="Piutang Berjalan" value={String(summary.berjalan)} />
                    <Stat
                        label="Sisa Piutang"
                        value={formatRupiah(summary.outstanding)}
                        tone={summary.outstanding > 0 ? 'text-perpanjang' : undefined}
                    />
                    <Stat
                        label="Sudah Tertagih"
                        value={formatRupiah(summary.collected)}
                        tone="text-primary"
                    />
                </div>

                {/* Filter pills */}
                <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                    {tabs.map((tab) => (
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

                {/* Search */}
                <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Cari kode, peminjam, atau HP…"
                        className="pl-9"
                    />
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[46rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">Kode</th>
                                    <th className="px-5 py-3 font-medium">
                                        Peminjam
                                    </th>
                                    <th className="px-5 py-3 font-medium">HP</th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Total
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Sisa
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pageItems.map((p) => (
                                    <tr
                                        key={p.id}
                                        onClick={() => router.visit(p.detailUrl)}
                                        className="cursor-pointer transition-colors hover:bg-accent"
                                    >
                                        <td className="px-5 py-3">
                                            <Link
                                                href={p.detailUrl}
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                className="font-medium tabular-nums hover:text-primary hover:underline"
                                            >
                                                {p.code}
                                            </Link>
                                            <div className="text-xs text-muted-foreground">
                                                {formatDate(p.date)}
                                                {p.downPayment > 0
                                                    ? ` · DP ${formatRupiah(p.downPayment)}`
                                                    : ''}
                                                {showStore && p.storeName
                                                    ? ` · ${p.storeName}`
                                                    : ''}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 font-medium">
                                            {p.debtorName}
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground">
                                            {p.deviceName}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums">
                                            {formatRupiah(p.price)}
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium tabular-nums">
                                            {p.remaining > 0 ? (
                                                formatRupiah(p.remaining)
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <StatusPill status={p.status} />
                                                {p.late && (
                                                    <span className="inline-flex items-center rounded-full bg-overdue-soft px-2 py-0.5 text-[11px] font-medium text-overdue ring-1 ring-overdue/25 ring-inset">
                                                        Telat
                                                    </span>
                                                )}
                                                {p.terminCount > 0 && (
                                                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                                                        {p.terminCount}x
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {pageItems.length === 0 && (
                        <div className="flex flex-col items-center gap-2 py-16 text-center">
                            <SearchX className="size-8 text-muted-foreground" />
                            <p className="font-medium">Tidak ada piutang</p>
                            <p className="max-w-xs text-sm text-muted-foreground">
                                Catat piutang HP lewat tombol "Tambah Piutang".
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
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: string;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1 p-4 sm:p-5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </span>
            <span
                className={cn(
                    'truncate text-base font-semibold tabular-nums sm:text-lg',
                    tone,
                )}
            >
                {value}
            </span>
        </div>
    );
}

function TambahPiutangDialog({ petugasList }: { petugasList: string[] }) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        debtor_name: '',
        device_name: '',
        price: 0,
        down_payment: 0,
        date: TODAY.toISOString().slice(0, 10),
        termin_count: 0,
        notes: '',
    });

    const financed = Math.max(0, form.data.price - form.data.down_payment);
    const perTermin =
        form.data.termin_count >= 2
            ? Math.floor(financed / form.data.termin_count)
            : financed;

    const submit = () => {
        // 0/1 = no schedule; the backend expects null or >= 2.
        form.transform((data) => ({
            ...data,
            termin_count: data.termin_count >= 2 ? data.termin_count : null,
        }));
        form.post('/piutang', {
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);

                if (!o) {
                    form.reset();
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                    <HandCoins />
                    Tambah Piutang
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tambah Piutang HP</DialogTitle>
                    <DialogDescription>
                        Catat HP yang diambil secara kredit oleh karyawan atau
                        pelanggan.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="peminjam">Peminjam</Label>
                        <Input
                            id="peminjam"
                            list="piutang-petugas"
                            value={form.data.debtor_name}
                            onChange={(e) =>
                                form.setData('debtor_name', e.target.value)
                            }
                            placeholder="cth. Rina (karyawan) / nama pelanggan"
                            autoFocus
                        />
                        <datalist id="piutang-petugas">
                            {petugasList.map((p) => (
                                <option key={p} value={p} />
                            ))}
                        </datalist>
                        {form.errors.debtor_name && (
                            <p className="text-xs text-destructive">
                                {form.errors.debtor_name}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="hp">Nama HP</Label>
                        <Input
                            id="hp"
                            value={form.data.device_name}
                            onChange={(e) =>
                                form.setData('device_name', e.target.value)
                            }
                            placeholder="cth. Vivo Y17S"
                        />
                        {form.errors.device_name && (
                            <p className="text-xs text-destructive">
                                {form.errors.device_name}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="harga">Total harga</Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                    Rp
                                </span>
                                <Input
                                    id="harga"
                                    inputMode="numeric"
                                    value={
                                        form.data.price
                                            ? form.data.price.toLocaleString(
                                                  'id-ID',
                                              )
                                            : ''
                                    }
                                    onChange={(e) =>
                                        form.setData(
                                            'price',
                                            parseInt(
                                                e.target.value.replace(
                                                    /\D/g,
                                                    '',
                                                ),
                                                10,
                                            ) || 0,
                                        )
                                    }
                                    placeholder="0"
                                    className="pl-9 tabular-nums"
                                />
                            </div>
                            {form.errors.price && (
                                <p className="text-xs text-destructive">
                                    {form.errors.price}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="dp">DP / uang muka</Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                    Rp
                                </span>
                                <Input
                                    id="dp"
                                    inputMode="numeric"
                                    value={
                                        form.data.down_payment
                                            ? form.data.down_payment.toLocaleString(
                                                  'id-ID',
                                              )
                                            : ''
                                    }
                                    onChange={(e) =>
                                        form.setData(
                                            'down_payment',
                                            parseInt(
                                                e.target.value.replace(
                                                    /\D/g,
                                                    '',
                                                ),
                                                10,
                                            ) || 0,
                                        )
                                    }
                                    placeholder="0"
                                    className="pl-9 tabular-nums"
                                />
                            </div>
                            {form.errors.down_payment && (
                                <p className="text-xs text-destructive">
                                    {form.errors.down_payment}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="tgl">Tanggal ambil</Label>
                            <DatePicker
                                id="tgl"
                                value={form.data.date}
                                onChange={(v) => form.setData('date', v)}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="termin">
                                Jumlah termin (opsional)
                            </Label>
                            <Input
                                id="termin"
                                type="number"
                                min={0}
                                value={form.data.termin_count || ''}
                                onChange={(e) =>
                                    form.setData(
                                        'termin_count',
                                        parseInt(e.target.value, 10) || 0,
                                    )
                                }
                                placeholder="cth. 3"
                                className="no-spinner tabular-nums"
                            />
                        </div>
                    </div>
                    <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        Sisa dicicil:{' '}
                        <span className="font-medium text-foreground tabular-nums">
                            {formatRupiah(financed)}
                        </span>
                        {form.data.termin_count >= 2
                            ? ` · ${form.data.termin_count}x @ ± ${formatRupiah(perTermin)}, jatuh tempo tiap bulan`
                            : ' · bayar bebas tanpa jadwal termin'}
                    </p>
                    <div className="grid gap-1.5">
                        <Label htmlFor="catatan">Catatan</Label>
                        <Textarea
                            id="catatan"
                            value={form.data.notes}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                            placeholder="Keterangan tambahan (opsional)"
                            rows={2}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={
                            form.processing ||
                            !form.data.debtor_name.trim() ||
                            !form.data.device_name.trim() ||
                            form.data.price <= 0
                        }
                    >
                        <Plus />
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

PiutangIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Piutang', href: '/piutang' },
    ],
};
