import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Gavel, PackageOpen } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '@/components/gadai/page-header';
import { TablePagination } from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types/gadai';

/** Net result of an auction sale relative to the loan value (principal). */
function saleNet(t: Transaction): number | null {
    if (t.saleValue == null) {
        return null;
    }

    return t.saleValue - t.principal;
}

export default function LaporanLelang({
    transactions,
}: {
    transactions: Transaction[];
}) {
    const rincian = usePagination(transactions, 10);

    const totals = useMemo(() => {
        let pinjaman = 0;
        let nilaiJual = 0;
        let keuntungan = 0;
        let kerugian = 0;
        let terjual = 0;

        for (const t of transactions) {
            pinjaman += t.principal;

            const net = saleNet(t);

            if (net !== null) {
                terjual += 1;
                nilaiJual += t.saleValue ?? 0;

                if (net >= 0) {
                    keuntungan += net;
                } else {
                    kerugian += -net;
                }
            }
        }

        return {
            count: transactions.length,
            terjual,
            belum: transactions.length - terjual,
            pinjaman,
            nilaiJual,
            keuntungan,
            kerugian,
            net: keuntungan - kerugian,
        };
    }, [transactions]);

    const kpis = [
        {
            label: 'Barang Lelang',
            value: String(totals.count),
            hint: `${totals.terjual} terjual · ${totals.belum} belum`,
        },
        {
            label: 'Nilai Pinjaman',
            value: formatRupiah(totals.pinjaman),
            hint: 'modal tertahan di barang lelang',
        },
        {
            label: 'Nilai Jual',
            value: formatRupiah(totals.nilaiJual),
            hint: 'total hasil penjualan',
        },
        {
            label: 'Keuntungan',
            value: formatRupiah(totals.keuntungan),
            hint: 'hasil jual di atas pinjaman',
            tone: 'text-primary',
        },
        {
            label: 'Kerugian',
            value: formatRupiah(totals.kerugian),
            hint: 'hasil jual di bawah pinjaman',
            tone: 'text-lelang',
        },
    ];

    return (
        <>
            <Head title="Laporan Barang Lelang" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="mb-2 -ml-2 text-muted-foreground"
                    >
                        <Link href="/laporan">
                            <ArrowLeft />
                            Laporan
                        </Link>
                    </Button>
                    <PageHeader
                        title="Laporan Barang Lelang"
                        description="Barang yang dilelang, hasil penjualan, dan keuntungan/kerugiannya. Terpisah dari transaksi biasa."
                    />
                </div>

                {/* KPI strip */}
                <div className="grid grid-cols-2 rounded-xl border bg-card shadow-sm lg:grid-cols-5">
                    {kpis.map((k, i) => (
                        <div
                            key={k.label}
                            className={cn(
                                'flex min-w-0 flex-col gap-1 p-4 sm:p-5',
                                i % 2 === 1 && 'border-l',
                                i >= 2 && 'border-t lg:border-t-0',
                                i >= 2 && 'lg:border-l',
                            )}
                        >
                            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {k.label}
                            </span>
                            <span
                                className={cn(
                                    'truncate text-base font-semibold tabular-nums sm:text-lg',
                                    k.tone,
                                )}
                            >
                                {k.value}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {k.hint}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Net summary */}
                <div className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Gavel className="size-4 text-lelang" />
                        <span className="font-medium">Hasil Bersih Lelang</span>
                    </div>
                    <span
                        className={cn(
                            'text-lg font-semibold tabular-nums sm:text-xl',
                            totals.net >= 0 ? 'text-primary' : 'text-lelang',
                        )}
                    >
                        {totals.net >= 0 ? '+' : '−'}
                        {formatRupiah(Math.abs(totals.net))}
                    </span>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[56rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Kode / Barang
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Jatuh Tempo
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Nilai Pinjaman
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Nilai Jual
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Untung / Rugi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rincian.pageItems.length > 0 ? (
                                    rincian.pageItems.map((t) => {
                                        const net = saleNet(t);

                                        return (
                                            <tr
                                                key={t.id}
                                                className="transition-colors hover:bg-accent"
                                            >
                                                <td className="px-5 py-3">
                                                    <Link
                                                        href={`/transaksi/${t.id}`}
                                                        className="font-medium tabular-nums hover:text-primary hover:underline"
                                                    >
                                                        {t.id}
                                                    </Link>
                                                    <div className="text-xs text-muted-foreground">
                                                        {t.device.name} ·{' '}
                                                        {t.customer.name}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                                                    {formatDate(t.dueDate)}
                                                </td>
                                                <td className="px-5 py-3 text-right font-medium tabular-nums">
                                                    {formatRupiah(t.principal)}
                                                </td>
                                                <td className="px-5 py-3 text-right tabular-nums">
                                                    {t.saleValue != null ? (
                                                        formatRupiah(t.saleValue)
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">
                                                            Belum terjual
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-right font-medium tabular-nums">
                                                    {net === null ? (
                                                        <span className="text-muted-foreground">
                                                            —
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className={cn(
                                                                net >= 0
                                                                    ? 'text-primary'
                                                                    : 'text-lelang',
                                                            )}
                                                        >
                                                            {net >= 0
                                                                ? '+'
                                                                : '−'}
                                                            {formatRupiah(
                                                                Math.abs(net),
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-5 py-12 text-center text-muted-foreground"
                                        >
                                            <PackageOpen className="mx-auto mb-2 size-8" />
                                            Belum ada barang lelang.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <TablePagination
                        page={rincian.page}
                        totalPages={rincian.totalPages}
                        pageSize={rincian.pageSize}
                        total={rincian.total}
                        from={rincian.from}
                        to={rincian.to}
                        onPageChange={rincian.setPage}
                        onPageSizeChange={rincian.setPageSize}
                    />
                </div>
            </div>
        </>
    );
}

LaporanLelang.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Laporan', href: '/laporan' },
        { title: 'Barang Lelang', href: '/laporan/lelang' },
    ],
};
