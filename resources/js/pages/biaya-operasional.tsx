import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Plus, Receipt, Search, SearchX, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DatePicker } from '@/components/gadai/date-picker';
import { DateRangeFilter } from '@/components/gadai/date-range-filter';
import { PageHeader } from '@/components/gadai/page-header';
import {
    WalletField,
    defaultWalletId,
    useWallets,
} from '@/components/gadai/wallet-field';
import { MissingFields } from '@/components/missing-fields';
import { PetugasLink } from '@/components/petugas-link';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

type Expense = {
    id: number;
    date: string;
    category: string;
    categoryLabel: string;
    description: string;
    note: string | null;
    amount: number;
    method: 'cash' | 'transfer' | null;
    walletName: string | null;
    storeName: string | null;
    by: string | null;
};

type Category = { key: string; label: string };

type CategoryTotal = Category & { total: number; count: number };

type PageProps = {
    expenses: Expense[];
    summary: { total: number; count: number; byCategory: CategoryTotal[] };
    categories: Category[];
    period: { from: string; to: string };
};

/** Sentinel for "every category"; Radix Select cannot hold an empty value. */
const ALL = '__semua__';

export default function BiayaOperasional({
    expenses,
    summary,
    categories,
    period,
}: PageProps) {
    const showStore = usePage().props.activeStore === 'all';
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState(ALL);
    const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return expenses.filter((e) => {
            if (category !== ALL && e.category !== category) {
                return false;
            }

            return (
                !q ||
                `${e.description} ${e.note ?? ''} ${e.categoryLabel} ${e.by ?? ''}`
                    .toLowerCase()
                    .includes(q)
            );
        });
    }, [expenses, query, category]);

    const filteredTotal = filtered.reduce((sum, e) => sum + e.amount, 0);
    const narrowed = query.trim() !== '' || category !== ALL;

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

    const periodLabel =
        period.from || period.to
            ? `${period.from ? formatDate(period.from) : '—'} – ${period.to ? formatDate(period.to) : '—'}`
            : 'Semua tanggal';

    const largest = summary.byCategory[0]?.total ?? 0;

    return (
        <>
            <Head title="Biaya Operasional" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Biaya Operasional"
                    description="Pengeluaran rutin toko seperti sewa, listrik, gaji, dan ATK. Otomatis keluar dari Kas Harian dan mengurangi laba di Laporan."
                >
                    <TambahBiayaDialog categories={categories} />
                </PageHeader>

                <DateRangeFilter
                    from={period.from}
                    to={period.to}
                    idPrefix="biaya"
                    onChange={(f, t) =>
                        router.get(
                            '/biaya-operasional',
                            { from: f, to: t },
                            { preserveScroll: true, replace: true },
                        )
                    }
                />

                {/* Summary */}
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-5 shadow-sm">
                        <div>
                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Total Biaya
                            </p>
                            <p className="mt-1 text-2xl font-semibold text-overdue tabular-nums">
                                {formatRupiah(summary.total)}
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {summary.count} pengeluaran · {periodLabel}
                        </p>
                    </div>

                    <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
                        <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Per Kategori
                        </p>
                        {summary.byCategory.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Belum ada biaya di periode ini.
                            </p>
                        ) : (
                            <ul className="grid gap-2.5">
                                {summary.byCategory.map((c) => (
                                    <li key={c.key}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCategory(
                                                    category === c.key
                                                        ? ALL
                                                        : c.key,
                                                );
                                                setPage(1);
                                            }}
                                            className="group grid w-full gap-1 text-left"
                                            title="Saring ke kategori ini"
                                        >
                                            <span className="flex items-baseline justify-between gap-3 text-sm">
                                                <span
                                                    className={cn(
                                                        'truncate group-hover:text-primary',
                                                        category === c.key &&
                                                            'font-semibold text-primary',
                                                    )}
                                                >
                                                    {c.label}
                                                    <span className="ml-1.5 text-xs text-muted-foreground">
                                                        {c.count}x
                                                    </span>
                                                </span>
                                                <span className="shrink-0 font-medium tabular-nums">
                                                    {formatRupiah(c.total)}
                                                </span>
                                            </span>
                                            <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                                                <span
                                                    className="block h-full rounded-full bg-overdue/70"
                                                    style={{
                                                        width: `${Math.max(
                                                            (c.total /
                                                                Math.max(
                                                                    largest,
                                                                    1,
                                                                )) *
                                                                100,
                                                            3,
                                                        )}%`,
                                                    }}
                                                />
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Search + category */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Cari keterangan, catatan, atau petugas…"
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={category}
                        onValueChange={(v) => {
                            setCategory(v);
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-60">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Semua kategori</SelectItem>
                            {categories.map((c) => (
                                <SelectItem key={c.key} value={c.key}>
                                    {c.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {narrowed && (
                        <p className="text-sm text-muted-foreground sm:ml-auto">
                            {filtered.length} pengeluaran ·{' '}
                            <span className="font-medium text-foreground tabular-nums">
                                {formatRupiah(filteredTotal)}
                            </span>
                        </p>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[52rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Tanggal
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Keterangan
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Kategori
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Dompet
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Dicatat oleh
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Nominal
                                    </th>
                                    <th className="w-12 px-3 py-3">
                                        <span className="sr-only">Aksi</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pageItems.map((e) => (
                                    <tr
                                        key={e.id}
                                        className="transition-colors hover:bg-accent/50"
                                    >
                                        <td className="px-5 py-3 whitespace-nowrap tabular-nums">
                                            {formatDate(e.date)}
                                            {showStore && e.storeName && (
                                                <div className="text-xs text-muted-foreground">
                                                    {e.storeName}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="font-medium">
                                                {e.description}
                                            </div>
                                            {e.note && (
                                                <div className="text-xs text-muted-foreground">
                                                    {e.note}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
                                                {e.categoryLabel}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-muted-foreground">
                                            {e.walletName ?? '—'}
                                            <div>
                                                {e.method === 'transfer'
                                                    ? 'Transfer'
                                                    : 'Tunai'}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            {e.by ? (
                                                <PetugasLink name={e.by} />
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right font-semibold whitespace-nowrap text-overdue tabular-nums">
                                            {formatRupiah(e.amount)}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 text-muted-foreground hover:text-overdue"
                                                title="Hapus biaya"
                                                onClick={() =>
                                                    setPendingDelete(e)
                                                }
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {pageItems.length === 0 && (
                        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                            {narrowed ? (
                                <SearchX className="size-8 text-muted-foreground" />
                            ) : (
                                <Receipt className="size-8 text-muted-foreground" />
                            )}
                            <p className="font-medium">
                                {narrowed
                                    ? 'Tidak ada biaya yang cocok'
                                    : 'Belum ada biaya di periode ini'}
                            </p>
                            <p className="max-w-sm text-sm text-muted-foreground">
                                {narrowed
                                    ? 'Coba ubah kata kunci atau kategorinya.'
                                    : 'Catat sewa, listrik, gaji, atau ATK lewat tombol "Tambah Biaya".'}
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

            <Dialog
                open={pendingDelete !== null}
                onOpenChange={(next) => !next && setPendingDelete(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus biaya operasional?</DialogTitle>
                        <DialogDescription>
                            {pendingDelete && (
                                <>
                                    <span className="font-medium text-foreground">
                                        {pendingDelete.description}
                                    </span>{' '}
                                    ({formatRupiah(pendingDelete.amount)},{' '}
                                    {formatDate(pendingDelete.date)}) akan
                                    dihapus dan uangnya kembali dihitung di Kas
                                    Harian. Penghapusan tercatat di Riwayat
                                    Aktivitas untuk diperiksa pemilik.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Batal</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (!pendingDelete) {
                                    return;
                                }

                                router.delete(
                                    `/biaya-operasional/${pendingDelete.id}`,
                                    {
                                        preserveScroll: true,
                                        onFinish: () => setPendingDelete(null),
                                    },
                                );
                            }}
                        >
                            <Trash2 />
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function TambahBiayaDialog({ categories }: { categories: Category[] }) {
    const today = usePage().props.serverDate;
    const wallets = useWallets();
    const [open, setOpen] = useState(false);
    const form = useForm({
        date: today,
        category: '',
        description: '',
        note: '',
        amount: 0,
        method: 'cash' as 'cash' | 'transfer',
        wallet_id: defaultWalletId(wallets),
    });

    const missing = [
        !form.data.category && 'Kategori',
        !form.data.description.trim() && 'Keterangan',
        form.data.amount <= 0 && 'Nominal',
        !form.data.date && 'Tanggal',
    ].filter((label): label is string => typeof label === 'string');

    const submit = () =>
        form.post('/biaya-operasional', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (!next) {
                    form.reset();
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                    <Plus />
                    Tambah Biaya
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tambah Biaya Operasional</DialogTitle>
                    <DialogDescription>
                        Uangnya keluar dari Kas Harian dompet yang dipilih, pada
                        tanggal biaya.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="biaya-kategori">
                                Kategori <Required />
                            </Label>
                            <Select
                                value={form.data.category}
                                onValueChange={(v) =>
                                    form.setData('category', v)
                                }
                            >
                                <SelectTrigger
                                    id="biaya-kategori"
                                    className="w-full"
                                >
                                    <SelectValue placeholder="Pilih kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((c) => (
                                        <SelectItem key={c.key} value={c.key}>
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {form.errors.category && (
                                <p className="text-xs text-destructive">
                                    {form.errors.category}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="biaya-tanggal">
                                Tanggal <Required />
                            </Label>
                            <DatePicker
                                id="biaya-tanggal"
                                value={form.data.date}
                                onChange={(v) => form.setData('date', v)}
                            />
                            {form.errors.date && (
                                <p className="text-xs text-destructive">
                                    {form.errors.date}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="biaya-keterangan">
                            Keterangan <Required />
                        </Label>
                        <Input
                            id="biaya-keterangan"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            placeholder="cth. Bayar listrik PLN Oktober"
                            maxLength={120}
                        />
                        {form.errors.description && (
                            <p className="text-xs text-destructive">
                                {form.errors.description}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="biaya-nominal">
                            Nominal <Required />
                        </Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                Rp
                            </span>
                            <Input
                                id="biaya-nominal"
                                inputMode="numeric"
                                value={
                                    form.data.amount
                                        ? form.data.amount.toLocaleString(
                                              'id-ID',
                                          )
                                        : ''
                                }
                                onChange={(e) =>
                                    form.setData(
                                        'amount',
                                        parseInt(
                                            e.target.value.replace(/\D/g, ''),
                                            10,
                                        ) || 0,
                                    )
                                }
                                placeholder="0"
                                className="pl-9 tabular-nums"
                            />
                        </div>
                        {form.errors.amount && (
                            <p className="text-xs text-destructive">
                                {form.errors.amount}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="biaya-catatan">
                            Catatan <Optional />
                        </Label>
                        <Input
                            id="biaya-catatan"
                            value={form.data.note}
                            onChange={(e) =>
                                form.setData('note', e.target.value)
                            }
                            placeholder="cth. Token 300rb + internet 150rb"
                            maxLength={255}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label>Metode bayar</Label>
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                value={form.data.method}
                                onValueChange={(v) =>
                                    v &&
                                    form.setData(
                                        'method',
                                        v as 'cash' | 'transfer',
                                    )
                                }
                                className="w-full"
                            >
                                <ToggleGroupItem
                                    value="cash"
                                    className="flex-1"
                                >
                                    Tunai
                                </ToggleGroupItem>
                                <ToggleGroupItem
                                    value="transfer"
                                    className="flex-1"
                                >
                                    Transfer
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        <WalletField
                            label="Dibayar dari dompet"
                            value={form.data.wallet_id}
                            onChange={(v) => form.setData('wallet_id', v)}
                        />
                    </div>
                </div>

                <MissingFields fields={missing} />

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={form.processing || missing.length > 0}
                    >
                        <Plus />
                        Simpan Biaya
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Marks a field the form cannot be saved without. */
function Required() {
    return (
        <span className="text-destructive" title="Wajib diisi">
            *
        </span>
    );
}

/** Marks a field that can safely be left empty. */
function Optional() {
    return (
        <span className="font-normal text-muted-foreground">(opsional)</span>
    );
}

BiayaOperasional.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Biaya Operasional', href: '/biaya-operasional' },
    ],
};
