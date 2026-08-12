import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarDays,
    ChevronRight,
    FileSpreadsheet,
    FileText,
    Gavel,
    Package,
    Receipt,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarChart } from '@/components/gadai/bar-chart';
import { DateRangeFilter } from '@/components/gadai/date-range-filter';
import { DonutChart } from '@/components/gadai/donut-chart';
import { PageHeader } from '@/components/gadai/page-header';
import { PetugasLink } from '@/components/petugas-link';
import { StatusBadge } from '@/components/status-badge';
import { TablePagination } from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, formatRupiah } from '@/lib/format';
import { STATUS_META, STATUS_ORDER } from '@/lib/gadai';
import { buildReport } from '@/lib/report';
import { countByStatus } from '@/lib/selectors';
import { cn, initials } from '@/lib/utils';
import type { Transaction } from '@/types/gadai';

type Period = { from: string; to: string };
type TrendPoint = { label: string; value: number; current: boolean };
type Overview = {
    uangBeredar: number;
    barangAktif: number;
    lewatTempo: number;
    lelang: number;
};

export default function Laporan({
    transactions,
    period,
    trend,
    dailyTrend,
    overview,
    feeIncome,
}: {
    transactions: Transaction[];
    period: Period;
    trend: TrendPoint[];
    dailyTrend: TrendPoint[];
    overview: Overview;
    feeIncome: number;
}) {
    const report = useMemo(() => buildReport(transactions), [transactions]);

    const [activeClerk, setActiveClerk] = useState<string | null>(null);
    const rincian = usePagination(transactions, 10);
    const labaBulanIni = trend.find((m) => m.current)?.value ?? 0;

    const statusSegments = report.perStatus.map((row) => ({
        label: STATUS_META[row.status].label,
        value: row.count,
        sub: formatRupiah(row.principal),
        colorClassName: STATUS_META[row.status].text,
    }));

    const overviewCards = [
        {
            label: 'Uang Beredar',
            value: formatRupiah(overview.uangBeredar),
            hint: 'dana titipan di pelanggan',
            icon: Wallet,
        },
        {
            label: 'Laba Bulan Ini',
            value: formatRupiah(labaBulanIni),
            hint: 'biaya titipan bulan ini',
            icon: TrendingUp,
            tone: 'text-primary',
        },
        {
            label: 'Barang Aktif',
            value: String(overview.barangAktif),
            hint: 'gadai sedang berjalan',
            icon: Package,
        },
        {
            label: 'Lewat Jatuh Tempo',
            value: String(overview.lewatTempo),
            hint: 'jatuh tempo & terlambat',
            icon: AlertTriangle,
            tone: 'text-overdue',
        },
        {
            label: 'Barang Lelang',
            value: String(overview.lelang),
            hint: 'ditandai untuk lelang',
            icon: Gavel,
            tone: 'text-lelang',
        },
    ];

    const params = new URLSearchParams({
        from: period.from,
        to: period.to,
    }).toString();

    const periodLabel =
        period.from || period.to
            ? `${period.from ? formatDate(period.from) : '—'} – ${period.to ? formatDate(period.to) : '—'}`
            : 'Semua tanggal';

    const kpis = [
        {
            label: 'Total Transaksi',
            value: String(report.total),
            hint: `${report.ditebus} ditebus · ${report.lelang} lelang`,
        },
        {
            label: 'Dana Tersalurkan',
            value: formatRupiah(report.danaTersalurkan),
            hint: `rata-rata ${formatRupiah(report.avgPrincipal)}/transaksi`,
        },
        {
            label: 'Pemasukan Biaya',
            value: formatRupiah(feeIncome),
            hint: 'bunga dibayar periode ini (termasuk perpanjang)',
            tone: 'text-primary',
        },
        {
            label: 'Dana Berjalan',
            value: formatRupiah(report.runningPrincipal),
            hint: 'masih di tangan pelanggan',
        },
    ];

    return (
        <>
            <Head title="Laporan" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Laporan"
                    description="Ringkasan transaksi, pemasukan biaya titipan, dan barang per status."
                >
                    <Button variant="outline" asChild>
                        <Link href="/laporan/lelang">
                            <Gavel />
                            Barang Lelang
                        </Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <a href={`/laporan/export?${params}`}>
                            <FileSpreadsheet />
                            Excel
                        </a>
                    </Button>
                    <Button variant="outline" asChild>
                        <a
                            href={`/laporan/cetak?${params}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <FileText />
                            PDF
                        </a>
                    </Button>
                </PageHeader>

                {/* Ringkasan usaha (snapshot, lepas dari filter periode) */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {overviewCards.map((c) => {
                        const Icon = c.icon;

                        return (
                            <div
                                key={c.label}
                                className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
                            >
                                <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    <Icon className="size-3.5 shrink-0" />
                                    <span className="truncate">{c.label}</span>
                                </span>
                                <span
                                    className={cn(
                                        'truncate text-base font-semibold tabular-nums sm:text-lg lg:text-xl',
                                        c.tone,
                                    )}
                                >
                                    {c.value}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {c.hint}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Period */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <DateRangeFilter
                        from={period.from}
                        to={period.to}
                        idPrefix="lap"
                        onChange={(from, to) =>
                            router.get(
                                '/laporan',
                                { from, to },
                                { preserveScroll: true, replace: true },
                            )
                        }
                    />
                    <p className="text-sm text-muted-foreground sm:text-right">
                        <span className="font-medium text-foreground tabular-nums">
                            {report.total}
                        </span>{' '}
                        transaksi
                        <span className="hidden sm:inline">
                            {' '}
                            · {periodLabel}
                        </span>
                    </p>
                </div>

                {/* KPI strip */}
                <div className="grid grid-cols-2 rounded-xl border bg-card shadow-sm lg:grid-cols-4">
                    {kpis.map((k, i) => (
                        <div
                            key={k.label}
                            className={cn(
                                'flex min-w-0 flex-col gap-1 p-4 sm:p-5',
                                i % 2 === 1 && 'border-l',
                                i >= 2 && 'border-t lg:border-t-0',
                                (i === 2 || i === 3) && 'lg:border-l',
                            )}
                        >
                            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {k.label}
                            </span>
                            <span
                                className={cn(
                                    'truncate text-base font-semibold tabular-nums sm:text-lg lg:text-xl',
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

                <div className="grid gap-5 lg:grid-cols-5">
                    {/* Fee income + trend */}
                    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="flex items-center gap-2 font-semibold">
                                    <TrendingUp className="size-4 text-primary" />
                                    Pemasukan Biaya Titipan
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Biaya titipan · 6 bulan terakhir
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-semibold text-primary tabular-nums">
                                    {formatRupiah(feeIncome)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    periode ini
                                </p>
                            </div>
                        </div>

                        {/* trend */}
                        <div className="mt-6">
                            <BarChart data={trend} />
                        </div>
                    </section>

                    {/* Per status */}
                    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
                        <h2 className="font-semibold">Barang per Status</h2>
                        <p className="mb-4 text-xs text-muted-foreground">
                            Jumlah & dana per status pada periode
                        </p>
                        <DonutChart
                            segments={statusSegments}
                            centerLabel="Barang"
                        />
                    </section>
                </div>

                {/* Grafik harian */}
                <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="flex items-center gap-2 font-semibold">
                                <CalendarDays className="size-4 text-muted-foreground" />
                                Grafik Harian
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Dana disalurkan · 14 hari terakhir
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-semibold tabular-nums">
                                {formatRupiah(
                                    dailyTrend.reduce((s, d) => s + d.value, 0),
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                14 hari terakhir
                            </p>
                        </div>
                    </div>
                    <div className="mt-6">
                        <BarChart data={dailyTrend} showValues={false} />
                    </div>
                </section>

                {/* Per petugas */}
                <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-5 py-4">
                        <h2 className="font-semibold">Ringkasan per Petugas</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[36rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Petugas
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Transaksi
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Dana Tersalurkan
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Biaya Titipan
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {report.clerks.length > 0 ? (
                                    report.clerks.map((c) => (
                                        <tr
                                            key={c.clerk}
                                            onClick={() =>
                                                setActiveClerk(c.clerk)
                                            }
                                            className="group cursor-pointer transition-colors hover:bg-accent"
                                        >
                                            <td className="px-5 py-3 font-medium">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <PetugasLink
                                                        name={c.clerk}
                                                    />
                                                    <ChevronRight className="size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right tabular-nums">
                                                {c.count}
                                            </td>
                                            <td className="px-5 py-3 text-right tabular-nums">
                                                {formatRupiah(c.dana)}
                                            </td>
                                            <td className="px-5 py-3 text-right tabular-nums">
                                                {formatRupiah(c.biaya)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-5 py-8 text-center text-muted-foreground"
                                        >
                                            Tidak ada data pada periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <ClerkDetailDialog
                    clerk={activeClerk}
                    transactions={transactions}
                    open={activeClerk !== null}
                    onOpenChange={(v) => {
                        if (!v) {
                            setActiveClerk(null);
                        }
                    }}
                />

                {/* Rincian transaksi */}
                <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                        <h2 className="flex items-center gap-2 font-semibold">
                            <Receipt className="size-4 text-muted-foreground" />
                            Rincian Transaksi
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            {report.total} baris
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[52rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Kode
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Pelanggan
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Barang
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Status
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Dana
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Biaya
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rincian.pageItems.length > 0 ? (
                                    rincian.pageItems.map((t) => (
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
                                                <div className="text-xs text-muted-foreground tabular-nums">
                                                    {formatDate(t.startDate)}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                {t.customer.name}
                                            </td>
                                            <td className="px-5 py-3 text-muted-foreground">
                                                {t.device.name}
                                            </td>
                                            <td className="px-5 py-3">
                                                <StatusBadge
                                                    status={t.status}
                                                    size="sm"
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-right font-medium tabular-nums">
                                                {formatRupiah(t.principal)}
                                            </td>
                                            <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                                                {formatRupiah(t.fee)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-5 py-12 text-center text-muted-foreground"
                                        >
                                            Tidak ada transaksi pada periode
                                            ini.
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
                </section>
            </div>
        </>
    );
}

function ClerkDetailDialog({
    clerk,
    transactions,
    open,
    onOpenChange,
}: {
    clerk: string | null;
    transactions: Transaction[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const txs = useMemo(
        () => (clerk ? transactions.filter((t) => t.clerk === clerk) : []),
        [clerk, transactions],
    );

    const dana = txs.reduce((s, t) => s + t.principal, 0);
    const biaya = txs.reduce((s, t) => s + t.fee, 0);
    const avg = txs.length ? Math.round(dana / txs.length) : 0;
    const counts = countByStatus(txs);

    const stats = [
        { label: 'Transaksi', value: String(txs.length) },
        { label: 'Dana Tersalurkan', value: formatRupiah(dana) },
        {
            label: 'Biaya Titipan',
            value: formatRupiah(biaya),
            tone: 'text-primary',
        },
        { label: 'Rata-rata Dana', value: formatRupiah(avg) },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl lg:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground/80">
                            {clerk ? initials(clerk) : '—'}
                        </span>
                        {clerk ?? 'Petugas'}
                    </DialogTitle>
                    <DialogDescription>
                        Rincian transaksi yang ditangani pada periode ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {stats.map((s) => (
                        <div
                            key={s.label}
                            className="rounded-lg border bg-muted/30 p-3"
                        >
                            <p className="text-xs text-muted-foreground">
                                {s.label}
                            </p>
                            <p
                                className={cn(
                                    'font-semibold tabular-nums',
                                    s.tone,
                                )}
                            >
                                {s.value}
                            </p>
                        </div>
                    ))}
                </div>

                {txs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {STATUS_ORDER.filter((st) => counts[st] > 0).map((st) => (
                            <span
                                key={st}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                                    STATUS_META[st].badge,
                                    STATUS_META[st].ring,
                                )}
                            >
                                <span
                                    className={cn(
                                        'size-1.5 rounded-full',
                                        STATUS_META[st].dot,
                                    )}
                                    aria-hidden
                                />
                                {STATUS_META[st].label} · {counts[st]}
                            </span>
                        ))}
                    </div>
                )}

                <div className="max-h-[26rem] overflow-auto rounded-lg border">
                    <table className="w-full min-w-[34rem] text-sm">
                        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                                <th className="px-3 py-2 font-medium">Kode</th>
                                <th className="px-3 py-2 font-medium">Tanggal</th>
                                <th className="px-3 py-2 font-medium">
                                    Pelanggan
                                </th>
                                <th className="px-3 py-2 font-medium">Status</th>
                                <th className="px-3 py-2 text-right font-medium">
                                    Dana
                                </th>
                                <th className="px-3 py-2">
                                    <span className="sr-only">Aksi</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {txs.map((t) => (
                                <tr
                                    key={t.id}
                                    onClick={() =>
                                        router.visit(`/transaksi/${t.id}`)
                                    }
                                    className="group cursor-pointer transition-colors hover:bg-accent"
                                >
                                    <td className="px-3 py-2">
                                        <div className="font-medium tabular-nums transition-colors group-hover:text-primary">
                                            {t.id}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t.device.name}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                                        {formatDate(t.startDate)}
                                    </td>
                                    <td className="px-3 py-2">
                                        {t.customer.name}
                                    </td>
                                    <td className="px-3 py-2">
                                        <StatusBadge
                                            status={t.status}
                                            size="sm"
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                                        {formatRupiah(t.principal)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                            className="h-7 gap-1 px-2 text-xs text-muted-foreground group-hover:text-primary"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Link href={`/transaksi/${t.id}`}>
                                                Detail
                                                <ChevronRight className="size-3.5" />
                                            </Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
}

Laporan.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Laporan', href: '/laporan' },
    ],
};
