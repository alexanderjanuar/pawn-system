import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatDate, formatRupiah } from '@/lib/format';
import { STATUS_META } from '@/lib/gadai';
import { buildReport } from '@/lib/report';
import type { Transaction } from '@/types/gadai';

type Period = { from: string; to: string };

export default function LaporanCetak({
    transactions,
    period,
}: {
    transactions: Transaction[];
    period: Period;
}) {
    const report = useMemo(() => buildReport(transactions), [transactions]);

    const params = new URLSearchParams({
        from: period.from,
        to: period.to,
    }).toString();

    const periodLabel =
        period.from || period.to
            ? `${period.from ? formatDate(period.from) : '—'} s/d ${period.to ? formatDate(period.to) : '—'}`
            : 'Semua tanggal';

    const summary = [
        { label: 'Total Transaksi', value: String(report.total) },
        {
            label: 'Dana Tersalurkan',
            value: formatRupiah(report.danaTersalurkan),
        },
        {
            label: 'Pemasukan Biaya',
            value: formatRupiah(report.pemasukanBiaya),
        },
        {
            label: 'Dana Berjalan',
            value: formatRupiah(report.runningPrincipal),
        },
        { label: 'Barang Ditebus', value: String(report.ditebus) },
        { label: 'Barang Lelang', value: String(report.lelang) },
    ];

    return (
        <>
            <Head title={`Laporan ${periodLabel}`} />
            <div className="min-h-svh bg-muted/40 py-8 print:min-h-0 print:bg-white print:py-0">
                {/* Toolbar (hidden on print) */}
                <div className="no-print mx-auto mb-6 flex w-full max-w-[860px] items-center justify-between px-4">
                    <Button
                        asChild
                        variant="ghost"
                        className="text-muted-foreground"
                    >
                        <Link href={`/laporan?${params}`}>
                            <ArrowLeft />
                            Kembali ke laporan
                        </Link>
                    </Button>
                    <Button onClick={() => window.print()}>
                        <Printer />
                        Cetak / Simpan PDF
                    </Button>
                </div>

                {/* Print sheet */}
                <div className="print-sheet mx-auto w-full max-w-[860px] bg-white p-8 text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
                    {/* Header */}
                    <div className="flex items-end justify-between border-b-2 border-neutral-900 pb-3">
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight">
                                GULAM CELL II
                            </h1>
                            <p className="text-xs text-neutral-600">
                                Jl. Serayu Tanah Merah No. 57 · Hp : 0852 2387
                                7117
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold uppercase">
                                Laporan Transaksi Gadai
                            </p>
                            <p className="text-xs text-neutral-600">
                                Periode: {periodLabel}
                            </p>
                        </div>
                    </div>

                    {/* Ringkasan */}
                    <section className="mt-5">
                        <h2 className="mb-2 text-sm font-bold uppercase">
                            Ringkasan
                        </h2>
                        <div className="grid grid-cols-3 border border-neutral-400">
                            {summary.map((s, i) => (
                                <div
                                    key={s.label}
                                    className={cellBorder(i, 3, summary.length)}
                                >
                                    <p className="text-[10px] tracking-wide text-neutral-500 uppercase">
                                        {s.label}
                                    </p>
                                    <p className="text-sm font-bold tabular-nums">
                                        {s.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-1 text-[10px] text-neutral-500">
                            Pemasukan biaya = total biaya titipan dari{' '}
                            {report.total} transaksi pada periode.
                        </p>
                    </section>

                    {/* Rekap per status */}
                    <section className="mt-5">
                        <h2 className="mb-2 text-sm font-bold uppercase">
                            Rekap per Status
                        </h2>
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr className="bg-neutral-100">
                                    <Th>Status</Th>
                                    <Th className="text-right">Jumlah</Th>
                                    <Th className="text-right">Dana Titipan</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.perStatus.map((row) => (
                                    <tr key={row.status}>
                                        <Td>{STATUS_META[row.status].label}</Td>
                                        <Td className="text-right tabular-nums">
                                            {row.count}
                                        </Td>
                                        <Td className="text-right tabular-nums">
                                            {formatRupiah(row.principal)}
                                        </Td>
                                    </tr>
                                ))}
                                <tr className="bg-neutral-50 font-bold">
                                    <Td>Total</Td>
                                    <Td className="text-right tabular-nums">
                                        {report.total}
                                    </Td>
                                    <Td className="text-right tabular-nums">
                                        {formatRupiah(report.danaTersalurkan)}
                                    </Td>
                                </tr>
                            </tbody>
                        </table>
                    </section>

                    {/* Rekap per petugas */}
                    {report.clerks.length > 0 && (
                        <section className="mt-5">
                            <h2 className="mb-2 text-sm font-bold uppercase">
                                Rekap per Petugas
                            </h2>
                            <table className="w-full border-collapse text-xs">
                                <thead>
                                    <tr className="bg-neutral-100">
                                        <Th>Petugas</Th>
                                        <Th className="text-right">
                                            Transaksi
                                        </Th>
                                        <Th className="text-right">
                                            Dana Tersalurkan
                                        </Th>
                                        <Th className="text-right">
                                            Biaya Titipan
                                        </Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.clerks.map((c) => (
                                        <tr key={c.clerk}>
                                            <Td>{c.clerk}</Td>
                                            <Td className="text-right tabular-nums">
                                                {c.count}
                                            </Td>
                                            <Td className="text-right tabular-nums">
                                                {formatRupiah(c.dana)}
                                            </Td>
                                            <Td className="text-right tabular-nums">
                                                {formatRupiah(c.biaya)}
                                            </Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    )}

                    {/* Rincian transaksi */}
                    <section className="mt-5">
                        <h2 className="mb-2 text-sm font-bold uppercase">
                            Rincian Transaksi ({report.total})
                        </h2>
                        <table className="w-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-neutral-100">
                                    <Th>Kode</Th>
                                    <Th>Masuk</Th>
                                    <Th>Pelanggan</Th>
                                    <Th>Barang</Th>
                                    <Th>Status</Th>
                                    <Th className="text-right">Dana</Th>
                                    <Th className="text-right">Biaya</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length > 0 ? (
                                    transactions.map((t) => (
                                        <tr key={t.id}>
                                            <Td className="whitespace-nowrap tabular-nums">
                                                {t.id}
                                            </Td>
                                            <Td className="whitespace-nowrap tabular-nums">
                                                {formatDate(t.startDate)}
                                            </Td>
                                            <Td>{t.customer.name}</Td>
                                            <Td>{t.device.name}</Td>
                                            <Td>
                                                {STATUS_META[t.status].label}
                                            </Td>
                                            <Td className="text-right tabular-nums">
                                                {formatRupiah(t.principal)}
                                            </Td>
                                            <Td className="text-right tabular-nums">
                                                {formatRupiah(t.fee)}
                                            </Td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <Td className="text-center" colSpan={7}>
                                            Tidak ada transaksi pada periode
                                            ini.
                                        </Td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </section>

                    <p className="mt-8 text-right text-[10px] text-neutral-500">
                        Dokumen dicetak dari Sistem Gadai Gulam Cell II
                    </p>
                </div>
            </div>
        </>
    );
}

function cellBorder(index: number, cols: number, total: number): string {
    const base = 'p-3';
    const notLastCol = (index + 1) % cols !== 0;
    const notLastRow = index < total - cols;

    return [
        base,
        notLastCol ? 'border-r border-neutral-400' : '',
        notLastRow ? 'border-b border-neutral-400' : '',
    ]
        .filter(Boolean)
        .join(' ');
}

function Th({
    children,
    className = '',
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <th
            className={`border border-neutral-400 px-2 py-1.5 text-left font-bold ${className}`}
        >
            {children}
        </th>
    );
}

function Td({
    children,
    className = '',
    colSpan,
}: {
    children: ReactNode;
    className?: string;
    colSpan?: number;
}) {
    return (
        <td
            colSpan={colSpan}
            className={`border border-neutral-400 px-2 py-1.5 ${className}`}
        >
            {children}
        </td>
    );
}
