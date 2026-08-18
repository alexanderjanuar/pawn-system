import { Link, router } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Banknote,
    Landmark,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
} from '@/components/ui/dialog';
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

export type CashKind =
    | 'tebus'
    | 'perpanjang'
    | 'lelang'
    | 'pencairan'
    | 'manual';
export type PaymentMethod = 'cash' | 'transfer';
export type CashEntry = {
    id: number;
    source: 'event' | 'manual';
    code: string | null;
    customer: string;
    kind: CashKind;
    direction: 'in' | 'out';
    amount: number;
    method: PaymentMethod | null;
    walletId: number | null;
    walletName: string | null;
    date: string;
    time: string | null;
    clerk: string;
};
export type CashFlow = {
    in: {
        tebus: number;
        perpanjang: number;
        lelang: number;
        manual: number;
        cash: number;
        transfer: number;
        unset: number;
        total: number;
    };
    out: { pencairan: number; manual: number; total: number };
    net: number;
    byWallet: Record<number, { id: number; in: number; out: number; net: number }>;
    entries: CashEntry[];
};

const CASH_KIND_LABEL: Record<CashKind, string> = {
    tebus: 'Tebus',
    perpanjang: 'Perpanjang',
    lelang: 'Lelang',
    pencairan: 'Pencairan',
    manual: 'Manual',
};

/**
 * Money in/out for a period plus the itemised movements, so a clerk can tick
 * each one against the physical cash drawer.
 */
export function CashFlowPanel({
    cashFlow,
    periodLabel,
    title = 'Kas Periode',
}: {
    cashFlow: CashFlow;
    periodLabel: string;
    title?: string;
}) {
    const [view, setView] = useState<'all' | 'in' | 'out'>('all');
    const [pendingDelete, setPendingDelete] = useState<CashEntry | null>(null);
    const filtered = useMemo(
        () =>
            view === 'all'
                ? cashFlow.entries
                : cashFlow.entries.filter((e) => e.direction === view),
        [cashFlow.entries, view],
    );
    const kas = usePagination(filtered, 10);

    return (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4 sm:px-6">
                <h2 className="flex items-center gap-2 font-semibold">
                    <ArrowLeftRight className="size-4 text-primary" />
                    {title}
                </h2>
                <p className="text-xs text-muted-foreground">
                    Uang masuk & keluar untuk dicocokkan dengan uang fisik ·{' '}
                    {periodLabel}
                </p>
            </div>

            <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="flex flex-col gap-1 p-4 sm:p-5">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Uang Masuk
                    </span>
                    <span className="text-lg font-semibold text-primary tabular-nums sm:text-xl">
                        {formatRupiah(cashFlow.in.total)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        Tebus {formatRupiah(cashFlow.in.tebus)} · Perpanjang{' '}
                        {formatRupiah(cashFlow.in.perpanjang)} · Lelang{' '}
                        {formatRupiah(cashFlow.in.lelang)}
                        {cashFlow.in.manual > 0 && (
                            <> · Manual {formatRupiah(cashFlow.in.manual)}</>
                        )}
                    </span>
                </div>
                <div className="flex flex-col gap-1 p-4 sm:p-5">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Uang Keluar
                    </span>
                    <span className="text-lg font-semibold text-overdue tabular-nums sm:text-xl">
                        {formatRupiah(cashFlow.out.total)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        Pencairan {formatRupiah(cashFlow.out.pencairan)}
                        {cashFlow.out.manual > 0 && (
                            <> · Manual {formatRupiah(cashFlow.out.manual)}</>
                        )}
                    </span>
                </div>
                <div className="flex flex-col gap-1 p-4 sm:p-5">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Kas Bersih
                    </span>
                    <span
                        className={cn(
                            'text-lg font-semibold tabular-nums sm:text-xl',
                            cashFlow.net >= 0 ? 'text-primary' : 'text-overdue',
                        )}
                    >
                        {cashFlow.net >= 0 ? '+' : '−'}
                        {formatRupiah(Math.abs(cashFlow.net))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        uang masuk − keluar
                    </span>
                </div>
            </div>

            {/* Pemasukan per metode — memudahkan hitung tunai vs transfer */}
            <div className="grid grid-cols-2 divide-x border-t">
                <div className="flex flex-col gap-1 p-4 sm:p-5">
                    <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        <Banknote className="size-3.5 text-primary" />
                        Pemasukan Tunai
                    </span>
                    <span className="text-lg font-semibold tabular-nums sm:text-xl">
                        {formatRupiah(cashFlow.in.cash)}
                    </span>
                </div>
                <div className="flex flex-col gap-1 p-4 sm:p-5">
                    <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        <Landmark className="size-3.5 text-aktif" />
                        Pemasukan Transfer
                    </span>
                    <span className="text-lg font-semibold tabular-nums sm:text-xl">
                        {formatRupiah(cashFlow.in.transfer)}
                    </span>
                </div>
            </div>
            {cashFlow.in.unset > 0 && (
                <div className="border-t bg-overdue-soft/30 px-5 py-2 text-xs text-muted-foreground">
                    Belum diisi metode:{' '}
                    <span className="font-semibold text-overdue">
                        {formatRupiah(cashFlow.in.unset)}
                    </span>{' '}
                    — pilih Tunai/Transfer di tabel untuk melengkapi.
                </div>
            )}

            {/* Filter tampilan tabel: pemasukan, pengeluaran, atau keduanya */}
            <div className="flex flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Rincian transaksi
                </span>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={view}
                    onValueChange={(v) =>
                        v && setView(v as 'all' | 'in' | 'out')
                    }
                >
                    <ToggleGroupItem value="all" className="px-3 text-xs">
                        Keduanya
                    </ToggleGroupItem>
                    <ToggleGroupItem value="in" className="px-3 text-xs">
                        Masuk
                    </ToggleGroupItem>
                    <ToggleGroupItem value="out" className="px-3 text-xs">
                        Keluar
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-sm">
                    <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                            <th className="px-5 py-3 font-medium">Waktu</th>
                            <th className="px-5 py-3 font-medium">Kode</th>
                            <th className="px-5 py-3 font-medium">Pelanggan</th>
                            <th className="px-5 py-3 font-medium">Jenis</th>
                            <th className="px-5 py-3 font-medium">Dompet</th>
                            <th className="px-5 py-3 font-medium">Metode</th>
                            <th className="px-5 py-3 font-medium">Petugas</th>
                            <th className="px-5 py-3 text-right font-medium">
                                Jumlah
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {kas.pageItems.length > 0 ? (
                            kas.pageItems.map((e) => (
                                <tr
                                    key={e.id}
                                    className="transition-colors hover:bg-accent"
                                >
                                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                                        {formatDate(e.date)}
                                        {e.time ? ` · ${e.time}` : ''}
                                    </td>
                                    <td className="px-5 py-3">
                                        {e.code ? (
                                            <Link
                                                href={`/transaksi/${e.code}`}
                                                className="font-medium tabular-nums hover:text-primary hover:underline"
                                            >
                                                {e.code}
                                            </Link>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3">{e.customer}</td>
                                    <td className="px-5 py-3">
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                                                e.source === 'manual'
                                                    ? 'bg-muted text-muted-foreground ring-border'
                                                    : e.direction === 'in'
                                                      ? 'bg-primary/10 text-primary ring-primary/20'
                                                      : 'bg-overdue-soft text-overdue ring-overdue/25',
                                            )}
                                        >
                                            {CASH_KIND_LABEL[e.kind]}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        {e.walletName ? (
                                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                {e.walletName}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3">
                                        {e.source === 'manual' ? (
                                            <MethodLabel method={e.method} />
                                        ) : e.direction === 'in' ? (
                                            <MethodSelect entry={e} />
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3">
                                        <PetugasLink name={e.clerk} />
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <span
                                                className={cn(
                                                    'font-medium tabular-nums',
                                                    e.direction === 'in'
                                                        ? 'text-primary'
                                                        : 'text-overdue',
                                                )}
                                            >
                                                {e.direction === 'in'
                                                    ? '+'
                                                    : '−'}
                                                {formatRupiah(e.amount)}
                                            </span>
                                            {e.source === 'manual' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7 text-muted-foreground hover:text-overdue"
                                                    onClick={() =>
                                                        setPendingDelete(e)
                                                    }
                                                    title="Hapus kas manual"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-5 py-10 text-center text-muted-foreground"
                                >
                                    Belum ada uang masuk atau keluar pada periode
                                    ini.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {filtered.length > 0 && (
                <TablePagination
                    page={kas.page}
                    totalPages={kas.totalPages}
                    pageSize={kas.pageSize}
                    total={kas.total}
                    from={kas.from}
                    to={kas.to}
                    onPageChange={kas.setPage}
                    onPageSizeChange={kas.setPageSize}
                />
            )}

            <Dialog
                open={pendingDelete !== null}
                onOpenChange={(next) => !next && setPendingDelete(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus kas manual?</DialogTitle>
                        <DialogDescription>
                            {pendingDelete && (
                                <>
                                    Catatan{' '}
                                    <span className="font-medium text-foreground">
                                        {pendingDelete.customer}
                                    </span>{' '}
                                    (
                                    {pendingDelete.direction === 'in'
                                        ? 'masuk'
                                        : 'keluar'}{' '}
                                    {formatRupiah(pendingDelete.amount)}) akan
                                    dihapus dari kas. Tindakan ini tidak bisa
                                    dibatalkan.
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
                                    `/kas/manual/${pendingDelete.id}`,
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
        </section>
    );
}

/** Static cash/transfer label for a manual entry (its method is fixed). */
function MethodLabel({ method }: { method: PaymentMethod | null }) {
    if (method === 'transfer') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Landmark className="size-3.5 text-aktif" />
                Transfer
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Banknote className="size-3.5 text-primary" />
            Tunai
        </span>
    );
}

/** Inline cash/transfer picker for one movement; saves on change. */
function MethodSelect({ entry }: { entry: CashEntry }) {
    return (
        <Select
            value={entry.method ?? undefined}
            onValueChange={(value) =>
                router.patch(
                    `/kas/entri/${entry.id}/metode`,
                    { payment_method: value },
                    { preserveScroll: true },
                )
            }
        >
            <SelectTrigger className="h-8 w-[132px] text-xs">
                <SelectValue placeholder="Pilih metode" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="cash">
                    <span className="flex items-center gap-1.5">
                        <Banknote className="size-3.5 text-primary" />
                        Tunai
                    </span>
                </SelectItem>
                <SelectItem value="transfer">
                    <span className="flex items-center gap-1.5">
                        <Landmark className="size-3.5 text-aktif" />
                        Transfer
                    </span>
                </SelectItem>
            </SelectContent>
        </Select>
    );
}
