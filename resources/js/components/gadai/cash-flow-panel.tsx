import { Link } from '@inertiajs/react';
import { ArrowLeftRight } from 'lucide-react';
import { PetugasLink } from '@/components/petugas-link';
import { TablePagination } from '@/components/table-pagination';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

export type CashKind = 'tebus' | 'perpanjang' | 'lelang' | 'pencairan';
export type CashEntry = {
    id: number;
    code: string;
    customer: string;
    kind: CashKind;
    direction: 'in' | 'out';
    amount: number;
    date: string;
    time: string | null;
    clerk: string;
};
export type CashFlow = {
    in: { tebus: number; perpanjang: number; lelang: number; total: number };
    out: { pencairan: number; total: number };
    net: number;
    entries: CashEntry[];
};

const CASH_KIND_LABEL: Record<CashKind, string> = {
    tebus: 'Tebus',
    perpanjang: 'Perpanjang',
    lelang: 'Lelang',
    pencairan: 'Pencairan',
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
    const kas = usePagination(cashFlow.entries, 10);

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
                        pencairan gadai baru
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

            <div className="overflow-x-auto border-t">
                <table className="w-full min-w-[46rem] text-sm">
                    <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                            <th className="px-5 py-3 font-medium">Waktu</th>
                            <th className="px-5 py-3 font-medium">Kode</th>
                            <th className="px-5 py-3 font-medium">Pelanggan</th>
                            <th className="px-5 py-3 font-medium">Jenis</th>
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
                                        <Link
                                            href={`/transaksi/${e.code}`}
                                            className="font-medium tabular-nums hover:text-primary hover:underline"
                                        >
                                            {e.code}
                                        </Link>
                                    </td>
                                    <td className="px-5 py-3">{e.customer}</td>
                                    <td className="px-5 py-3">
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                                                e.direction === 'in'
                                                    ? 'bg-primary/10 text-primary ring-primary/20'
                                                    : 'bg-overdue-soft text-overdue ring-overdue/25',
                                            )}
                                        >
                                            {CASH_KIND_LABEL[e.kind]}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <PetugasLink name={e.clerk} />
                                    </td>
                                    <td
                                        className={cn(
                                            'px-5 py-3 text-right font-medium tabular-nums',
                                            e.direction === 'in'
                                                ? 'text-primary'
                                                : 'text-overdue',
                                        )}
                                    >
                                        {e.direction === 'in' ? '+' : '−'}
                                        {formatRupiah(e.amount)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={6}
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
            {cashFlow.entries.length > 0 && (
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
        </section>
    );
}
